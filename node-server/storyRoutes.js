// server/routes/storyRoutes.js
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
    prompt += `Character ${index + 1} is a ${char.type} who is very ${char.trait}. `;
  });

  prompt += `The story's creativity level is set to ${creativityLevel}, and emotional variance is ${emotionalVariance}.`;

  return prompt;
};


// Function to call OpenAI API
const generateStoryFromOpenAI = async (prompt) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
      prompt: prompt,
      max_tokens: 400 // Adjust as necessary
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    return response.data.choices[0].text;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
};

// Endpoint to generate story
router.post('/generateStory', async (req, res) => {
  const { creativityLevel, numCharacters, emotionalVariance } = req.body;
  const prompt = createStoryPrompt(creativityLevel, numCharacters, emotionalVariance);

  try {
    const story = await generateStoryFromOpenAI(prompt);
    res.json({ story });
  } catch (error) {
    console.error('Story generation failed:', error);
    res.status(500).send('Failed to generate story');
  }
});

module.exports = router;
