// Shared client for any service that implements the OpenAI Chat Completions API
// (OpenRouter, OpenAI, Hugging Face router, Ollama, Groq, Gemini, ...).
const axios = require('axios');

const SYSTEM_PROMPT = 'You are a creative storyteller who writes vivid, engaging short stories.';

// Statuses where trying the next fallback model can help (busy, missing or broken model)
const RETRYABLE_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);

// Pull the most useful human-readable message out of an upstream error
const errorDetail = (error) => {
  const data = error.response?.data;
  const upstream = data?.error;
  const message = upstream?.message || (typeof upstream === 'string' ? upstream : null) || error.message;
  const raw = upstream?.metadata?.raw;
  return raw && typeof raw === 'string' && !message.includes(raw) ? `${message} (${raw})` : message;
};

const createOpenAICompatibleProvider = ({
  name, baseUrl, apiKey, model, keyVar, requiresKey = true, extraConfigError,
  extraHeaders = {}, fallbackModels = [], timeoutMs = 90000
}) => {
  let configError = extraConfigError || null;
  if (!configError && requiresKey && !apiKey) {
    configError = `${keyVar} is not configured for AI_PROVIDER=${name}. Add it to node-server/.env, ` +
      'or remove AI_PROVIDER (or set AI_PROVIDER=mock) to use the free mock story generator.';
  }

  const url = `${(baseUrl || '').replace(/\/+$/, '')}/chat/completions`;
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const callModel = async (modelId, { messages, temperature, maxTokens }) => {
    const response = await axios.post(url, {
      model: modelId,
      messages,
      temperature,
      max_tokens: maxTokens
    }, { headers, timeout: timeoutMs });

    if (response.data?.error) {
      const error = new Error(response.data.error.message || 'Upstream error');
      error.response = { status: Number(response.data.error.code) || 502, data: response.data };
      throw error;
    }
    const text = response.data?.choices?.[0]?.message?.content;
    if (!text || !text.trim()) {
      const error = new Error(`${modelId} returned an empty reply`);
      error.retryable = true;
      throw error;
    }
    return { text: text.trim(), model: response.data.model || modelId };
  };

  const provider = {
    name,
    model,
    fallbackModels,
    configError,

    // messages: [{ role: 'system' | 'user' | 'assistant', content }]
    // Returns { text, model, attempts } where attempts lists models that failed before one succeeded.
    async complete({ messages, temperature, maxTokens, model: requestedModel }) {
      const candidates = [...new Set([requestedModel || model, ...fallbackModels].filter(Boolean))];
      const attempts = [];
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        try {
          const result = await callModel(candidate, { messages, temperature, maxTokens });
          return { ...result, attempts };
        } catch (error) {
          const status = error.response?.status;
          const message = errorDetail(error);
          attempts.push({ model: candidate, status: status || error.code || null, message });
          const retryable = error.retryable || RETRYABLE_STATUSES.has(status) || error.code === 'ECONNABORTED';
          // A daily free-model quota applies to every model, so switching models won't help
          const dailyLimit = /per-day/i.test(message);
          if (!retryable || dailyLimit || i === candidates.length - 1) {
            error.attempts = attempts;
            throw error;
          }
          console.warn(`${name}: ${candidate} failed (${status || error.code}): ${message}. Trying ${candidates[i + 1]}...`);
        }
      }
      throw new Error(`${name} has no model configured`);
    },

    // Legacy one-shot API used by POST /api/generateStory
    async generateStory({ prompt, temperature, maxTokens }) {
      const { text } = await provider.complete({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature,
        maxTokens
      });
      return text;
    }
  };
  return provider;
};

module.exports = { createOpenAICompatibleProvider, SYSTEM_PROMPT, errorDetail };
