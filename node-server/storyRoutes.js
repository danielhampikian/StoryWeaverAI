// node-server/storyRoutes.js
const express = require('express');
const { getProvider } = require('./providers');
const { errorDetail } = require('./providers/openaiCompatible');
const { createCharacterProfiles } = require('./characters');
const {
  DEFAULT_SYSTEM_PROMPT,
  FORMAT_INSTRUCTIONS,
  buildStartPrompt,
  buildContinuePrompt,
  buildOneShotPrompt,
  parseTurn
} = require('./prompts');

const router = express.Router();

const TURN_MAX_TOKENS = 900;
// The opening exchange plus the most recent messages are sent to the model each turn
const MAX_HISTORY_MESSAGES = 16;
const MAX_TEXT = 500;
const MAX_SYSTEM_PROMPT = 8000;
const MODEL_ID = /^[\w.\-/:@]{1,200}$/;

class InputError extends Error {}

// Parse a numeric input and clamp it to [min, max]; returns null if not a number
const toBoundedInt = (value, min, max) => {
  const num = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(num)) {
    return null;
  }
  return Math.min(max, Math.max(min, Math.round(num)));
};

// Map creativity level (1-10) to a sampling temperature (0.3-1.2)
const creativityToTemperature = (creativityLevel) =>
  Number((0.3 + ((creativityLevel - 1) / 9) * 0.9).toFixed(2));

const readText = (value, label, max) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new InputError(`${label} must be text.`);
  const text = value.trim();
  if (text.length > max) throw new InputError(`${label} must be at most ${max} characters.`);
  return text;
};

const readSetup = (setup = {}) => {
  const creativityLevel = toBoundedInt(setup.creativityLevel, 1, 10);
  const numCharacters = toBoundedInt(setup.numCharacters, 1, 10);
  const emotionalVariance = toBoundedInt(setup.emotionalVariance, 1, 10);
  if (creativityLevel === null || numCharacters === null || emotionalVariance === null) {
    throw new InputError('creativityLevel, numCharacters and emotionalVariance must all be numbers between 1 and 10.');
  }
  return { creativityLevel, numCharacters, emotionalVariance, premise: readText(setup.premise, 'Premise', MAX_TEXT) };
};

const readSettings = (settings = {}, creativityLevel) => {
  const systemPrompt = readText(settings.systemPrompt, 'System prompt', MAX_SYSTEM_PROMPT) || DEFAULT_SYSTEM_PROMPT;
  const model = readText(settings.model, 'Model', 200);
  if (model && !MODEL_ID.test(model)) {
    throw new InputError('Model must be a model id such as google/gemma-4-31b-it:free.');
  }
  let temperature = creativityToTemperature(creativityLevel);
  if (settings.temperature !== undefined && settings.temperature !== null && settings.temperature !== '') {
    const value = Number(settings.temperature);
    if (!Number.isFinite(value) || value < 0 || value > 2) {
      throw new InputError('Temperature must be a number from 0 to 2.');
    }
    temperature = value;
  }
  return { systemPrompt, model: model || undefined, temperature };
};

const readHistory = (history) => {
  if (!Array.isArray(history) || history.length < 2 || history.length > 400) {
    throw new InputError('history must be the list of messages returned by earlier turns.');
  }
  return history.map((message) => {
    if (!message || !['user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' || message.content.length > 20000) {
      throw new InputError('Each history message needs a role of "user" or "assistant" and text content.');
    }
    return { role: message.role, content: message.content };
  });
};

const readCharacters = (characters) => (Array.isArray(characters) ? characters : [])
  .slice(0, 10)
  .filter(c => c && typeof c.name === 'string')
  .map(c => ({ name: String(c.name).slice(0, 60), type: String(c.type || '').slice(0, 30), trait: String(c.trait || '').slice(0, 30) }));

const trimHistory = (history) => (history.length <= MAX_HISTORY_MESSAGES
  ? history
  : [...history.slice(0, 2), ...history.slice(-(MAX_HISTORY_MESSAGES - 2))]);

// Turn an upstream failure into a message a player can act on
const describeProviderError = (provider, error) => {
  const status = error.response?.status;
  const detail = errorDetail(error);
  if (status === 429) {
    return /per-day/i.test(detail)
      ? 'You have used today\'s free OpenRouter requests (50 per day until an account has bought $10 of credits). The limit resets at midnight UTC.'
      : 'The free model is busy or rate-limited (free models allow about 20 requests per minute). Wait a moment and try again, or pick another ":free" model in Prompt settings.';
  }
  if (status === 401 || status === 403) {
    return `${provider.name} rejected the API key (${status}). Check the key in node-server/.env and restart the server.`;
  }
  if (status === 402) {
    return 'That model needs paid credits (402). Choose a model whose id ends in ":free" in Prompt settings.';
  }
  if (status === 404) {
    return 'That model was not found (404). Check the model id in Prompt settings; free models change over time.';
  }
  if (error.code === 'ECONNABORTED') {
    return 'The model took too long to answer. Try again, or choose a different model in Prompt settings.';
  }
  if (!status) {
    return `Could not reach ${provider.name} (${error.code || detail}). Check your connection, or use AI_PROVIDER=mock to keep playing offline.`;
  }
  return `${provider.name} returned an error (${status}).`;
};

const sendProviderError = (res, provider, error) => {
  const status = error.response?.status;
  const detail = errorDetail(error);
  console.error(`Story generation failed (${provider.name}):`, status || error.code || '', detail);
  res.status(status === 429 ? 429 : 502).json({
    error: describeProviderError(provider, error),
    detail,
    attempts: error.attempts || []
  });
};

// Runs one story turn and sends { turn, exchange, provider, model, ... }
const runTurn = async (req, res, buildTurn) => {
  const provider = getProvider();
  if (provider.configError) {
    return res.status(500).json({ error: provider.configError });
  }

  let turnInput;
  try {
    turnInput = buildTurn(req.body || {});
  } catch (error) {
    if (error instanceof InputError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Could not build story turn:', error);
    return res.status(500).json({ error: 'Could not build the story prompt.' });
  }

  const { settings, history, userContent, context, extra } = turnInput;
  const messages = [
    { role: 'system', content: settings.systemPrompt },
    ...trimHistory(history),
    { role: 'user', content: userContent }
  ];

  try {
    const result = await provider.complete({
      messages,
      temperature: settings.temperature,
      maxTokens: TURN_MAX_TOKENS,
      model: settings.model,
      context
    });
    res.json({
      ...extra,
      turn: parseTurn(result.text),
      exchange: [
        { role: 'user', content: userContent },
        { role: 'assistant', content: result.text }
      ],
      provider: provider.name,
      model: result.model,
      temperature: settings.temperature,
      skippedModels: (result.attempts || []).map(a => ({ model: a.model, status: a.status })),
      sentMessages: messages.length
    });
  } catch (error) {
    sendProviderError(res, provider, error);
  }
};

// Provider details and prompt defaults for the client's Prompt settings panel
router.get('/config', (req, res) => {
  const provider = getProvider();
  res.json({
    provider: provider.name,
    model: provider.model,
    fallbackModels: provider.fallbackModels || [],
    configError: provider.configError,
    defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    formatInstructions: FORMAT_INSTRUCTIONS,
    maxHistoryMessages: MAX_HISTORY_MESSAGES
  });
});

// Start a story: { setup: { creativityLevel, numCharacters, emotionalVariance, premise }, settings }
router.post('/story/start', (req, res) => runTurn(req, res, (body) => {
  const setup = readSetup(body.setup);
  const settings = readSettings(body.settings, setup.creativityLevel);
  const characters = createCharacterProfiles(setup.numCharacters);
  return {
    settings,
    history: [],
    userContent: buildStartPrompt(setup, characters),
    context: { kind: 'start', setup, characters },
    extra: { characters }
  };
}));

// Continue a story: { setup, characters, history: [{ role, content }], action, settings }
router.post('/story/continue', (req, res) => runTurn(req, res, (body) => {
  const setup = readSetup(body.setup);
  const settings = readSettings(body.settings, setup.creativityLevel);
  const action = readText(body.action, 'Action', MAX_TEXT);
  if (!action) {
    throw new InputError('Say what happens next (action is required).');
  }
  return {
    settings,
    history: readHistory(body.history),
    userContent: buildContinuePrompt(action),
    context: { kind: 'continue', setup, characters: readCharacters(body.characters), action }
  };
}));

// Legacy one-shot endpoint: { creativityLevel, numCharacters, emotionalVariance } -> { story, provider }
router.post('/generateStory', async (req, res) => {
  const provider = getProvider();
  if (provider.configError) {
    return res.status(500).json({ error: provider.configError });
  }

  const body = req.body || {};
  const creativityLevel = toBoundedInt(body.creativityLevel, 1, 10);
  const numCharacters = toBoundedInt(body.numCharacters, 1, 10);
  const emotionalVariance = toBoundedInt(body.emotionalVariance, 1, 10);

  if (creativityLevel === null || numCharacters === null || emotionalVariance === null) {
    return res.status(400).json({
      error: 'creativityLevel, numCharacters and emotionalVariance must all be numbers between 1 and 10.'
    });
  }

  const characters = createCharacterProfiles(numCharacters);

  try {
    const story = await provider.generateStory({
      prompt: buildOneShotPrompt(characters, creativityLevel, emotionalVariance),
      temperature: creativityToTemperature(creativityLevel),
      maxTokens: 800,
      story: { characters, creativityLevel, emotionalVariance }
    });
    res.json({ story, provider: provider.name });
  } catch (error) {
    sendProviderError(res, provider, error);
  }
});

module.exports = router;