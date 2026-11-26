const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../server');
const { buildMockStory } = require('../providers/mock');

const PROVIDER_ENV_VARS = [
  'AI_PROVIDER', 'MOCK_DELAY_MS', 'HF_TOKEN', 'HF_MODEL', 'HF_BASE_URL',
  'OPENAI_COMPAT_BASE_URL', 'OPENAI_COMPAT_API_KEY', 'OPENAI_COMPAT_MODEL',
  'OLLAMA_URL', 'OLLAMA_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_BASE_URL',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL'
];

let server;
let upstream;
let upstreamUrl;
let lastUpstreamRequest;

before(async () => {
  server = app.listen(0);
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      lastUpstreamRequest = { url: req.url, headers: req.headers, body: JSON.parse(body) };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const reply = req.url.endsWith('/messages')
        ? { content: [{ type: 'text', text: ' Anthropic story ' }] }
        : { choices: [{ message: { role: 'assistant', content: ' Chat story ' } }] };
      res.end(JSON.stringify(reply));
    });
  }).listen(0);
  upstreamUrl = `http://localhost:${upstream.address().port}`;
});

after(() => {
  server.close();
  upstream.close();
});

beforeEach(() => {
  PROVIDER_ENV_VARS.forEach(name => delete process.env[name]);
  process.env.MOCK_DELAY_MS = '0';
  lastUpstreamRequest = null;
});

const generate = async (payload = { creativityLevel: 9, numCharacters: 3, emotionalVariance: 2 }) => {
  const response = await fetch(`http://localhost:${server.address().port}/api/generateStory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return { status: response.status, body: await response.json() };
};

test('uses the free mock provider when no provider or keys are configured', async () => {
  const { status, body } = await generate();
  assert.strictEqual(status, 200);
  assert.strictEqual(body.provider, 'mock');
  assert.match(body.story, /mock story generator/);
  assert.strictEqual(lastUpstreamRequest, null);
});

test('mock story reflects characters, creativity and emotional variance', () => {
  const characters = [{ type: 'alien', trait: 'curious' }, { type: 'robot', trait: 'brave' }];
  const calm = buildMockStory({ characters, creativityLevel: 1, emotionalVariance: 1 }, () => 0);
  const wild = buildMockStory({ characters, creativityLevel: 10, emotionalVariance: 10 }, () => 0);

  assert.match(calm, /a curious alien/);
  assert.match(calm, /a brave robot/);
  assert.match(calm, /quiet seaside village/);
  assert.match(calm, /good cup of tea/);
  assert.match(wild, /sleeping whale/);
  assert.match(wild, /Joy turned to terror/);
});

test('explains how to fall back to mock when a provider key is missing', async () => {
  process.env.AI_PROVIDER = 'huggingface';
  const { status, body } = await generate();
  assert.strictEqual(status, 500);
  assert.match(body.error, /HF_TOKEN is not configured/);
  assert.match(body.error, /AI_PROVIDER=mock/);
});

test('rejects unknown providers and incomplete openai-compatible config', async () => {
  process.env.AI_PROVIDER = 'nope';
  assert.match((await generate()).body.error, /Unknown AI_PROVIDER "nope"/);

  process.env.AI_PROVIDER = 'openai-compatible';
  process.env.OPENAI_COMPAT_API_KEY = 'key';
  assert.match((await generate()).body.error, /OPENAI_COMPAT_BASE_URL and OPENAI_COMPAT_MODEL must be set/);
});

const chatProviders = [
  { name: 'huggingface', env: { HF_TOKEN: 'hf-test', HF_BASE_URL: '{up}/v1' }, auth: 'Bearer hf-test', model: 'meta-llama/Llama-3.1-8B-Instruct' },
  {
    name: 'openai-compatible',
    env: { OPENAI_COMPAT_BASE_URL: '{up}/api/v1', OPENAI_COMPAT_API_KEY: 'or-test', OPENAI_COMPAT_MODEL: 'google/gemma-4-31b-it:free' },
    auth: 'Bearer or-test', model: 'google/gemma-4-31b-it:free', path: '/api/v1/chat/completions'
  },
  { name: 'ollama', env: { OLLAMA_URL: '{up}' }, auth: undefined, model: 'llama3.2' },
  { name: 'openai', env: { OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: '{up}/v1' }, auth: 'Bearer sk-test', model: 'gpt-4o-mini' }
];

for (const provider of chatProviders) {
  test(`${provider.name} sends an OpenAI-compatible chat completions request`, async () => {
    process.env.AI_PROVIDER = provider.name;
    Object.entries(provider.env).forEach(([key, value]) => { process.env[key] = value.replace('{up}', upstreamUrl); });

    const { status, body } = await generate();
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(body, { story: 'Chat story', provider: provider.name });
    assert.strictEqual(lastUpstreamRequest.url, provider.path || '/v1/chat/completions');
    assert.strictEqual(lastUpstreamRequest.headers.authorization, provider.auth);
    assert.strictEqual(lastUpstreamRequest.body.model, provider.model);
    assert.strictEqual(lastUpstreamRequest.body.temperature, 1.1);
    assert.strictEqual(lastUpstreamRequest.body.max_tokens, 800);
    assert.strictEqual(lastUpstreamRequest.body.messages[1].role, 'user');
    assert.match(lastUpstreamRequest.body.messages[1].content, /Create a story with the following characters/);
  });
}

test('anthropic sends a Messages API request', async () => {
  process.env.AI_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'ant-test';
  process.env.ANTHROPIC_BASE_URL = `${upstreamUrl}/v1`;

  const { status, body } = await generate({ creativityLevel: 10, numCharacters: 1, emotionalVariance: 5 });
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(body, { story: 'Anthropic story', provider: 'anthropic' });
  assert.strictEqual(lastUpstreamRequest.url, '/v1/messages');
  assert.strictEqual(lastUpstreamRequest.headers['x-api-key'], 'ant-test');
  assert.strictEqual(lastUpstreamRequest.headers['anthropic-version'], '2023-06-01');
  assert.strictEqual(lastUpstreamRequest.body.model, 'claude-haiku-4-5');
  assert.strictEqual(lastUpstreamRequest.body.temperature, 1);
  assert.strictEqual(lastUpstreamRequest.body.max_tokens, 800);
  assert.ok(lastUpstreamRequest.body.system);
});
