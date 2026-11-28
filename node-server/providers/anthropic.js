// Anthropic Messages API provider (requires paid API credits).
const axios = require('axios');
const { SYSTEM_PROMPT } = require('./openaiCompatible');

const createAnthropicProvider = ({ baseUrl, apiKey, model }) => {
  const provider = {
    name: 'anthropic',
    model,
    fallbackModels: [],
    configError: apiKey ? null :
      'ANTHROPIC_API_KEY is not configured for AI_PROVIDER=anthropic. Add it to node-server/.env, ' +
      'or remove AI_PROVIDER (or set AI_PROVIDER=mock) to use the free mock story generator.',

    async complete({ messages, temperature, maxTokens, model: requestedModel }) {
      const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
      const usedModel = requestedModel || model;
      const response = await axios.post(`${baseUrl.replace(/\/+$/, '')}/messages`, {
        model: usedModel,
        system: system || undefined,
        messages: messages.filter(m => m.role !== 'system'),
        // Anthropic accepts temperatures from 0 to 1
        temperature: Math.min(1, temperature),
        max_tokens: maxTokens
      }, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 120000
      });

      const text = (response.data?.content || [])
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');
      if (!text) {
        throw new Error('anthropic response did not contain any story text');
      }
      return { text: text.trim(), model: response.data?.model || usedModel, attempts: [] };
    },

    async generateStory({ prompt, temperature, maxTokens }) {
      const { text } = await provider.complete({
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        temperature,
        maxTokens
      });
      return text;
    }
  };
  return provider;
};

module.exports = { createAnthropicProvider };