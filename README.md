# StoryWeaverAI

## Overview
StoryWeaverAI is an interactive storytelling platform that merges AI-driven narrative creation with user participation. Using OpenAI's GPT-3.5, this app allows users to engage in collaborative storytelling, shaping the narrative as it evolves. Developed with React for the frontend and Node.js for the backend, StoryWeaverAI offers an engaging experience for both storytellers and AI enthusiasts.

### Features
- Interactive storytelling with AI
- User input guides the story direction
- React-based dynamic web interface
- Backend integration with OpenAI's GPT-3.5


### Local testing:
- clone  this repo and install (if needed) node
- cd to node-server directory and run: npm install, then: npm start (or node server.js). The API listens on port 5000.
- in a seperate terminal, cd to client directory and run: npm install, then: npm start (requests to /api are proxied to port 5000)
- that's it: with no .env file the server uses the free mock story generator, so the whole app works without any API key. When you want real AI stories, see below.
- run the server tests with: npm test (in node-server). They use local fakes and never call a real AI service.

### Choosing an AI provider (free options)
Copy `node-server/.env.example` to `node-server/.env`, set `AI_PROVIDER` and the variables for that provider, then restart the server. The server logs which provider is active when it starts. Suggested order, from free to paid:

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
