// Shared client for any service that implements the OpenAI Chat Completions API
// (OpenAI, Hugging Face router, Ollama, OpenRouter, Groq, Gemini, ...).
const axios = require('axios');

const SYSTEM_PROMPT = 'You are a creative storyteller who writes vivid, engaging short stories.';

const createOpenAICompatibleProvider = ({ name, baseUrl, apiKey, model, keyVar, requiresKey = true, extraConfigError }) => {
  let configError = extraConfigError || null;
  if (!configError && requiresKey && !apiKey) {
    configError = `${keyVar} is not configured for AI_PROVIDER=${name}. Add it to node-server/.env, ` +
      'or remove AI_PROVIDER (or set AI_PROVIDER=mock) to use the free mock story generator.';
  }

  return {
    name,
    model,
    configError,
    async generateStory({ prompt, temperature, maxTokens }) {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await axios.post(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      }, { headers, timeout: 120000 });

      const story = response.data?.choices?.[0]?.message?.content;
      if (!story) {
        throw new Error(`${name} response did not contain any story text`);
      }
      return story.trim();
    }
  };
};

module.exports = { createOpenAICompatibleProvider, SYSTEM_PROMPT };
