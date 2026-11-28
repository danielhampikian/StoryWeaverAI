const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../server');
const { parseTurn, DEFAULT_SYSTEM_PROMPT } = require('../prompts');

// server.js loads node-server/.env; clear provider settings so no real API is ever called
const ENV_VARS = [
  'AI_PROVIDER', 'MOCK_DELAY_MS', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_BASE_URL',
  'OPENROUTER_FALLBACK_MODELS', 'OPENROUTER_SITE_URL'
];

let server;
let upstream;
let upstreamUrl;
let requests;
let reply;

const STORY_REPLY = 'The lighthouse hummed.\n\nMara gripped the rail.\n\n**Choices:**\n1. **Climb** the stairs\n2. Call for Bolt\n3) Wait for dawn';

before(() => {
  server = app.listen(0);
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const request = { url: req.url, headers: req.headers, body: JSON.parse(body) };
      requests.push(request);
      const { status, body: replyBody } = reply(request);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(replyBody));
    });
  }).listen(0);
  upstreamUrl = `http://localhost:${upstream.address().port}`;
});

after(() => {
  server.close();
  upstream.close();
});

beforeEach(() => {
  ENV_VARS.forEach(name => delete process.env[name]);
  process.env.MOCK_DELAY_MS = '0';
  requests = [];
  reply = (request) => ({ status: 200, body: { model: request.body.model, choices: [{ message: { content: STORY_REPLY } }] } });
});

const useOpenRouter = () => {
  process.env.OPENROUTER_API_KEY = 'or-test';
  process.env.OPENROUTER_BASE_URL = `${upstreamUrl}/api/v1`;
};

const post = async (path, payload) => {
  const response = await fetch(`http://localhost:${server.address().port}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return { status: response.status, body: await response.json() };
};

const setup = { creativityLevel: 10, numCharacters: 2, emotionalVariance: 4, premise: 'A lighthouse keeper hears singing' };

test('selects OpenRouter automatically when only OPENROUTER_API_KEY is set', async () => {
  useOpenRouter();
  const response = await fetch(`http://localhost:${server.address().port}/api/config`);
  const config = await response.json();
  assert.strictEqual(config.provider, 'openrouter');
  assert.strictEqual(config.model, 'google/gemma-4-31b-it:free');
  assert.ok(config.fallbackModels.every(model => model.endsWith(':free')));
  assert.strictEqual(config.defaultSystemPrompt, DEFAULT_SYSTEM_PROMPT);
  assert.strictEqual(config.configError, null);
});

test('starting a story sends an OpenRouter chat request and returns the parsed turn', async () => {
  useOpenRouter();
  const { status, body } = await post('/story/start', { setup });

  assert.strictEqual(status, 200);
  const [request] = requests;
  assert.strictEqual(request.url, '/api/v1/chat/completions');
  assert.strictEqual(request.headers.authorization, 'Bearer or-test');
  assert.strictEqual(request.headers['http-referer'], 'https://github.com/danielhampikian/StoryWeaverAI');
  assert.strictEqual(request.headers['x-title'], 'StoryWeaver AI');
  assert.strictEqual(request.body.model, 'google/gemma-4-31b-it:free');
  assert.strictEqual(request.body.temperature, 1.2);
  assert.strictEqual(request.body.max_tokens, 900);
  assert.deepStrictEqual(request.body.messages.map(m => m.role), ['system', 'user']);
  assert.strictEqual(request.body.messages[0].content, DEFAULT_SYSTEM_PROMPT);
  assert.match(request.body.messages[1].content, /Premise or genre: A lighthouse keeper hears singing/);
  assert.match(request.body.messages[1].content, /CHOICES:/);
  body.characters.forEach(char => assert.ok(request.body.messages[1].content.includes(char.name)));

  assert.strictEqual(body.provider, 'openrouter');
  assert.strictEqual(body.model, 'google/gemma-4-31b-it:free');
  assert.deepStrictEqual(body.turn, {
    text: 'The lighthouse hummed.\n\nMara gripped the rail.',
    choices: ['Climb the stairs', 'Call for Bolt', 'Wait for dawn']
  });
  assert.deepStrictEqual(body.exchange.map(m => m.role), ['user', 'assistant']);
  assert.strictEqual(body.exchange[1].content, STORY_REPLY);
});

test('continuing sends the edited system prompt, story history and the reader action', async () => {
  useOpenRouter();
  const history = [];
  for (let i = 0; i < 12; i++) {
    history.push({ role: 'user', content: `prompt ${i}` }, { role: 'assistant', content: `passage ${i}` });
  }
  const { status } = await post('/story/continue', {
    setup,
    history,
    action: 'Mara opens the trapdoor',
    settings: { systemPrompt: 'Write only in rhyme.', model: 'nvidia/nemotron-3-ultra-550b-a55b:free', temperature: 0.4 }
  });

  assert.strictEqual(status, 200);
  const { messages, model, temperature } = requests[0].body;
  assert.strictEqual(model, 'nvidia/nemotron-3-ultra-550b-a55b:free');
  assert.strictEqual(temperature, 0.4);
  assert.deepStrictEqual(messages[0], { role: 'system', content: 'Write only in rhyme.' });
  // Keeps the opening exchange and the most recent turns (16 history messages in total)
  assert.strictEqual(messages.length, 1 + 16 + 1);
  assert.strictEqual(messages[1].content, 'prompt 0');
  assert.strictEqual(messages[2].content, 'passage 0');
  assert.strictEqual(messages[3].content, 'prompt 5');
  assert.strictEqual(messages[16].content, 'passage 11');
  assert.strictEqual(messages[17].role, 'user');
  assert.match(messages[17].content, /What happens next: Mara opens the trapdoor/);
});

test('falls back to the next free model when one is rate limited', async () => {
  useOpenRouter();
  reply = (request) => (request.body.model === 'google/gemma-4-31b-it:free'
    ? { status: 429, body: { error: { code: 429, message: 'Provider returned error', metadata: { raw: 'temporarily rate-limited upstream' } } } }
    : { status: 200, body: { model: request.body.model, choices: [{ message: { content: STORY_REPLY } }] } });

  const { status, body } = await post('/story/start', { setup });
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(requests.map(r => r.body.model), ['google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free']);
  assert.strictEqual(body.model, 'google/gemma-4-26b-a4b-it:free');
  assert.deepStrictEqual(body.skippedModels, [{ model: 'google/gemma-4-31b-it:free', status: 429 }]);
});

test('reports the daily free limit clearly without retrying other models', async () => {
  useOpenRouter();
  reply = () => ({ status: 429, body: { error: { code: 429, message: 'Rate limit exceeded: free-models-per-day.' } } });

  const { status, body } = await post('/story/start', { setup });
  assert.strictEqual(status, 429);
  assert.strictEqual(requests.length, 1);
  assert.match(body.error, /50 per day/);
  assert.match(body.detail, /free-models-per-day/);
});

test('explains an invalid key and a missing key', async () => {
  useOpenRouter();
  reply = () => ({ status: 401, body: { error: { code: 401, message: 'No auth credentials found' } } });
  let response = await post('/story/start', { setup });
  assert.strictEqual(response.status, 502);
  assert.strictEqual(requests.length, 1);
  assert.match(response.body.error, /rejected the API key \(401\)/);

  delete process.env.OPENROUTER_API_KEY;
  process.env.AI_PROVIDER = 'openrouter';
  response = await post('/story/start', { setup });
  assert.strictEqual(response.status, 500);
  assert.match(response.body.error, /OPENROUTER_API_KEY is not configured/);
});

test('the free mock provider plays a full story loop with suggested choices', async () => {
  const start = await post('/story/start', { setup: { ...setup, numCharacters: 3 } });
  assert.strictEqual(start.status, 200);
  assert.strictEqual(start.body.provider, 'mock');
  assert.strictEqual(start.body.characters.length, 3);
  assert.match(start.body.turn.text, /A lighthouse keeper hears singing/);
  start.body.characters.forEach(char => assert.ok(start.body.turn.text.includes(char.name)));
  assert.strictEqual(start.body.turn.choices.length, 3);

  const action = start.body.turn.choices[0];
  const next = await post('/story/continue', {
    setup,
    characters: start.body.characters,
    history: start.body.exchange,
    action
  });
  assert.strictEqual(next.status, 200);
  assert.ok(next.body.turn.text.includes(action));
  assert.strictEqual(next.body.turn.choices.length, 3);
  assert.strictEqual(requests.length, 0);
});

test('rejects invalid story requests', async () => {
  const history = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }];
  assert.match((await post('/story/continue', { setup, history, action: '  ' })).body.error, /action is required/);
  assert.match((await post('/story/continue', { setup, history: [], action: 'go' })).body.error, /history/);
  assert.match((await post('/story/start', { setup, settings: { model: 'bad model!' } })).body.error, /Model must be/);
  assert.match((await post('/story/start', { setup, settings: { temperature: 3 } })).body.error, /Temperature/);
  assert.strictEqual((await post('/story/start', { setup: { creativityLevel: 'x' } })).status, 400);
});

test('parseTurn separates the passage from suggested choices', () => {
  assert.deepStrictEqual(
    parseTurn('<think>plan</think>Night fell.\n\nCHOICES:\n1. Hide\n2. Run\n3. Fight'),
    { text: 'Night fell.', choices: ['Hide', 'Run', 'Fight'] }
  );
  assert.deepStrictEqual(
    parseTurn('Night fell.\n\n---\n\n### What do you do?\n- *Hide*\n- Run'),
    { text: 'Night fell.', choices: ['Hide', 'Run'] }
  );
  assert.deepStrictEqual(
    parseTurn('Night fell.\n\n1. Hide\n2. Run'),
    { text: 'Night fell.', choices: ['Hide', 'Run'] }
  );
  assert.deepStrictEqual(parseTurn('Just a passage.'), { text: 'Just a passage.', choices: [] });
});
