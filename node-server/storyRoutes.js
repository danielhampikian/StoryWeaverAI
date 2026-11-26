// node-server/storyRoutes.js
const express = require('express');
const axios = require('axios');
const router = express.Router();


// Example arrays of attributes
const characterTypes = ['human', 'robot', 'alien', 'animal', 'mutant'];
const personalityTraits = ['brave', 'curious', 'witty', 'mysterious', 'sarcastic'];

// Function to randomly select an element from an array
const getRandomElement = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

// Function to create character profiles
const createCharacterProfiles = (numCharacters) => {
  let characters = [];

  for (let i = 0; i < numCharacters; i++) {
    let characterType = getRandomElement(characterTypes);
    let personalityTrait = getRandomElement(personalityTraits);

    characters.push({ type: characterType, trait: personalityTrait });
  }

  return characters;
};

// Modify your createStoryPrompt function
const createStoryPrompt = (creativityLevel, numCharacters, emotionalVariance) => {
  let characters = createCharacterProfiles(numCharacters);
  let prompt = `Create a story with the following characters: `;

  characters.forEach((char, index) => {
    const article = /^[aeiou]/i.test(char.type) ? 'an' : 'a';
    prompt += `Character ${index + 1} is ${article} ${char.type} who is very ${char.trait}. `;
  });

  prompt += `The story's creativity level is set to ${creativityLevel} out of 10, and emotional variance is ${emotionalVariance} out of 10. `;
  prompt += `Keep the story under 500 words and give it a clear beginning, middle and end.`;

  return prompt;
};


// Parse a numeric input and clamp it to [min, max]; returns null if not a number
const toBoundedInt = (value, min, max) => {
  const num = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(num)) {
    return null;
  }
  return Math.min(max, Math.max(min, Math.round(num)));
};

// Map creativity level (1-10) to a sampling temperature (0.3-1.2)
const creativityToTemperature = (creativityLevel) =>
  Number((0.3 + ((creativityLevel - 1) / 9) * 0.9).toFixed(2));

// Function to call the OpenAI Chat Completions API
const generateStoryFromOpenAI = async (prompt, temperature) => {
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await axios.post(`${baseUrl}/chat/completions`, {
    model,
    messages: [
      { role: 'system', content: 'You are a creative storyteller who writes vivid, engaging short stories.' },
      { role: 'user', content: prompt }
    ],
    temperature,
    max_tokens: 800
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 60000
  });

  const story = response.data?.choices?.[0]?.message?.content;
  if (!story) {
    throw new Error('OpenAI response did not contain any story text');
  }
  return story.trim();
};

// Endpoint to generate story
router.post('/generateStory', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY is not configured on the server. Add it to node-server/.env and restart the server.'
    });
  }

  const body = req.body || {};
  const creativityLevel = toBoundedInt(body.creativityLevel, 1, 10);
  const numCharacters = toBoundedInt(body.numCharacters, 1, 10);
  const emotionalVariance = toBoundedInt(body.emotionalVariance, 1, 10);

  if (creativityLevel === null || numCharacters === null || emotionalVariance === null) {
    return res.status(400).json({
      error: 'creativityLevel, numCharacters and emotionalVariance must all be numbers between 1 and 10.'
    });
  }

  const prompt = createStoryPrompt(creativityLevel, numCharacters, emotionalVariance);

  try {
    const story = await generateStoryFromOpenAI(prompt, creativityToTemperature(creativityLevel));
    res.json({ story });
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.error?.message || error.message;
    console.error('Story generation failed:', status || '', detail);
    res.status(502).json({
      error: `Failed to generate story${status ? ` (OpenAI returned ${status})` : ''}: ${detail}`
    });
  }
});

module.exports = router;
