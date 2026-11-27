// Selects the story provider from the AI_PROVIDER environment variable.
// Every provider exposes: { name, model, configError, generateStory({ prompt, temperature, maxTokens, story }) }
const { createOpenAICompatibleProvider } = require('./openaiCompatible');
const { createAnthropicProvider } = require('./anthropic');
const { createMockProvider } = require('./mock');

const PROVIDER_FACTORIES = {
  mock: (env) => createMockProvider({ delayMs: Number(env.MOCK_DELAY_MS ?? 800) || 0 }),

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

const getProvider = (env = process.env) => {
  const name = (env.AI_PROVIDER || 'mock').trim().toLowerCase();
  const factory = PROVIDER_FACTORIES[name];
  if (!factory) {
    return {
      name,
      model: null,
      configError: `Unknown AI_PROVIDER "${name}". Use one of: ${Object.keys(PROVIDER_FACTORIES).join(', ')}.`,
      generateStory: async () => { throw new Error('Provider is not configured'); }
    };
  }
  return factory(env);
};

module.exports = { getProvider, PROVIDER_NAMES: Object.keys(PROVIDER_FACTORIES) };
