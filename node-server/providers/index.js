// Selects the story provider from the AI_PROVIDER environment variable.
// Every provider exposes:
//   { name, model, fallbackModels, configError,
//     complete({ messages, temperature, maxTokens, model, context }) -> { text, model, attempts },
//     generateStory({ prompt, temperature, maxTokens, story }) -> string }
const { createOpenAICompatibleProvider } = require('./openaiCompatible');
const { createAnthropicProvider } = require('./anthropic');
const { createMockProvider } = require('./mock');

// Free OpenRouter models (ids ending in ":free") that write good stories, checked against
// https://openrouter.ai/api/v1/models in November 2026. Free models come and go; override
// with OPENROUTER_MODEL / OPENROUTER_FALLBACK_MODELS or the model field in the UI.
const OPENROUTER_DEFAULT_MODEL = 'google/gemma-4-31b-it:free';
const OPENROUTER_FALLBACK_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'baidu/ernie-5.5-flash-preview:free'
];

const parseList = (value) => String(value).split(',').map(s => s.trim()).filter(Boolean);

const PROVIDER_FACTORIES = {
  mock: (env) => createMockProvider({ delayMs: Number(env.MOCK_DELAY_MS ?? 800) || 0 }),

  openrouter: (env) => createOpenAICompatibleProvider({
    name: 'openrouter',
    baseUrl: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY,
    keyVar: 'OPENROUTER_API_KEY',
    model: env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL,
    fallbackModels: env.OPENROUTER_FALLBACK_MODELS !== undefined
      ? parseList(env.OPENROUTER_FALLBACK_MODELS)
      : OPENROUTER_FALLBACK_MODELS,
    // Optional attribution headers recommended by OpenRouter
    extraHeaders: {
      'HTTP-Referer': env.OPENROUTER_SITE_URL || 'https://github.com/danielhampikian/StoryWeaverAI',
      'X-Title': 'StoryWeaver AI',
      'X-OpenRouter-Title': 'StoryWeaver AI'
    }
  }),

  huggingface: (env) => createOpenAICompatibleProvider({
    name: 'huggingface',
    baseUrl: env.HF_BASE_URL || 'https://router.huggingface.co/v1',
    apiKey: env.HF_TOKEN,
    keyVar: 'HF_TOKEN',
    model: env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct'
  }),

  'openai-compatible': (env) => createOpenAICompatibleProvider({
    name: 'openai-compatible',
    baseUrl: env.OPENAI_COMPAT_BASE_URL || '',
    apiKey: env.OPENAI_COMPAT_API_KEY,
    keyVar: 'OPENAI_COMPAT_API_KEY',
    model: env.OPENAI_COMPAT_MODEL,
    extraConfigError: (!env.OPENAI_COMPAT_BASE_URL || !env.OPENAI_COMPAT_MODEL)
      ? 'OPENAI_COMPAT_BASE_URL and OPENAI_COMPAT_MODEL must be set for AI_PROVIDER=openai-compatible. ' +
        'See node-server/.env.example for free-tier examples, or set AI_PROVIDER=mock.'
      : null
  }),

  ollama: (env) => createOpenAICompatibleProvider({
    name: 'ollama',
    baseUrl: `${(env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '')}/v1`,
    requiresKey: false,
    model: env.OLLAMA_MODEL || 'llama3.2'
  }),

  openai: (env) => createOpenAICompatibleProvider({
    name: 'openai',
    baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: env.OPENAI_API_KEY,
    keyVar: 'OPENAI_API_KEY',
    model: env.OPENAI_MODEL || 'gpt-4o-mini'
  }),

  anthropic: (env) => createAnthropicProvider({
    baseUrl: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
  })
};

// AI_PROVIDER wins; otherwise use OpenRouter when its key is present, else the free mock.
const resolveProviderName = (env) => {
  if (env.AI_PROVIDER && env.AI_PROVIDER.trim()) {
    return env.AI_PROVIDER.trim().toLowerCase();
  }
  return env.OPENROUTER_API_KEY ? 'openrouter' : 'mock';
};

const getProvider = (env = process.env) => {
  const name = resolveProviderName(env);
  const factory = PROVIDER_FACTORIES[name];
  if (!factory) {
    return {
      name,
      model: null,
      fallbackModels: [],
      configError: `Unknown AI_PROVIDER "${name}". Use one of: ${Object.keys(PROVIDER_FACTORIES).join(', ')}.`,
      complete: async () => { throw new Error('Provider is not configured'); },
      generateStory: async () => { throw new Error('Provider is not configured'); }
    };
  }
  return factory(env);
};

module.exports = {
  getProvider,
  PROVIDER_NAMES: Object.keys(PROVIDER_FACTORIES),
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_FALLBACK_MODELS
};
