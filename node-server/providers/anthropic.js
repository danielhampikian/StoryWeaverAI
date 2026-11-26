// Anthropic Messages API provider (requires paid API credits).
const axios = require('axios');
const { SYSTEM_PROMPT } = require('./openaiCompatible');

const createAnthropicProvider = ({ baseUrl, apiKey, model }) => ({
  name: 'anthropic',
  model,
  configError: apiKey ? null :
    'ANTHROPIC_API_KEY is not configured for AI_PROVIDER=anthropic. Add it to node-server/.env, ' +
    'or remove AI_PROVIDER (or set AI_PROVIDER=mock) to use the free mock story generator.',
  async generateStory({ prompt, temperature, maxTokens }) {
    const response = await axios.post(`${baseUrl.replace(/\/+$/, '')}/messages`, {
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
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

    const story = (response.data?.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');
    if (!story) {
      throw new Error('anthropic response did not contain any story text');
    }
    return story.trim();
  }
});

module.exports = { createAnthropicProvider };
