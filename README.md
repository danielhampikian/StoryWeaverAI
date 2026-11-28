# StoryWeaverAI

## Overview
StoryWeaverAI is an interactive storytelling app: you step through a door, choose a premise and who comes with you, and then write the story together with an AI, one turn at a time. It uses free AI models through [OpenRouter](https://openrouter.ai) by default, has a React frontend and a Node.js (Express) backend, and includes a prompt playground so you can experiment with how the storyteller is instructed.

### Features
- Turn-by-turn interactive stories: pick one of three suggested choices or type your own move
- A readable, scrolling story transcript with copy and download (.txt)
- Prompt settings panel: edit the system prompt, model and temperature, and see the exact last request sent
- Each passage shows which provider and model wrote it (including free-model fallbacks)
- Free by default: OpenRouter free models, or an offline mock storyteller that needs no key at all

### Local testing:
- clone this repo and install (if needed) node
- cd to node-server directory and run: npm install, then: npm start (or node server.js). The API listens on port 5000 and logs which storyteller is active.
- in a separate terminal, cd to client directory and run: npm install, then: npm start (requests to /api are proxied to port 5000)
- with no .env file the server uses the free mock storyteller, so the whole app works without any API key.
- run the tests with npm test in node-server (local fakes only, never calls a real AI service) and in client.

### Real AI stories for free with OpenRouter (recommended)
1. Create a free account at [openrouter.ai](https://openrouter.ai), open **Keys**, and create a key.
2. Copy `node-server/.env.example` to `node-server/.env` and set `OPENROUTER_API_KEY=` to your key. Never commit `.env` (it is gitignored).
3. Restart the server. It picks OpenRouter automatically and logs `Story provider: openrouter`.

The default model is a free one (`google/gemma-4-31b-it:free`). When a free model is busy, the server automatically tries the fallback models listed in `OPENROUTER_FALLBACK_MODELS`, and the passage shows which model actually answered. Free accounts get about 20 requests per minute and 50 requests per day (1000 per day after buying $10 of credits); the app shows a clear message when you hit a limit. You can change the model in `.env` (`OPENROUTER_MODEL`) or per turn in the Prompt settings panel; any model id ending in `:free` from [openrouter.ai/models](https://openrouter.ai/models) works.

### How to play
1. On the first screen, write where the story begins (or leave it blank to be surprised) and set **Companions**, **Strangeness** (creativity, which also sets the temperature) and **Emotional weather**.
2. Press **Cross the threshold**. The storyteller writes the opening scene and offers three choices.
3. Click a choice, or write your own move and press **Step forward** (Enter also works; Shift+Enter adds a new line).
4. Use **Copy** or **Download .txt** to keep your story, and **New story** to start again.

### Playing with prompts
- Open **Prompt settings** (on either screen) to edit the system prompt, choose a model, or set a temperature. Changes apply from the next turn, and **Last request sent** shows exactly what the model received.
- The built-in prompt templates live in one file, `node-server/prompts.js`: the default system prompt, the instructions for the opening and each continuation, and the parser that pulls the suggested choices out of the reply.
- The server sends the system prompt, the opening turn, and the most recent turns as chat messages, so long stories stay coherent without growing the request forever.
### Other AI providers (free options)
OpenRouter is the recommended setup, but you can switch storytellers: copy `node-server/.env.example` to `node-server/.env`, set `AI_PROVIDER` and the variables for that provider, then restart the server. The server logs which provider is active when it starts. Other options, from free to paid:

1. **`mock`** (default): offline, template-based stories built from your chosen characters, creativity and emotional variance. No key, no cost.
2. **Hosted free tiers** via `openai-compatible` (set `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_API_KEY`, `OPENAI_COMPAT_MODEL`):
   - **OpenRouter**: free account, models whose ids end in `:free` (rate limited).
   - **Groq**: free plan with per-model rate limits.
   - **Google Gemini**: free tier for some models through its OpenAI-compatible endpoint.
   - Example configs for each are in `.env.example`. Free-tier terms change often, so check each provider's current limits.
3. **`huggingface`**: Hugging Face Inference Providers (`HF_TOKEN`, `HF_MODEL`, default `meta-llama/Llama-3.1-8B-Instruct`). Free HF accounts no longer include monthly inference credits (PRO includes $2/month), so this is only free if you have credits.
4. **`ollama`**: runs open models on your own machine for free. Install [Ollama](https://ollama.com), run `ollama pull llama3.2`, then set `AI_PROVIDER=ollama`. Needs a reasonably capable computer.
5. **`openai`** / **`anthropic`**: paid API credits required (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`).

Notes:
- GitHub Models was retired in July 2026, so it is not an option.
- The Claude model you use inside GitHub Copilot can't be called from this app. Claude is only available here through Anthropic's paid API.
