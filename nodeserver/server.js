// server/server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Later, you'll serve the React build directory here
// app.use(express.static('../build'));

const PORT = process.env.PORT || 5000;

// OpenAI API setup
const OPENAI_API_URL = 'https://api.openai.com/v1/engines/davinci-codex/completions';
const API_KEY = process.env.OPENAI_API_KEY;

// Endpoint to generate story
app.post('/api/generateStory', async (req, res) => {
    // Add the logic to interact with OpenAI API
    // and handle the story generation
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
