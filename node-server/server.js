// node-server/server.js
require('dotenv').config();
const express = require('express');
const storyRoutes = require('./storyRoutes');

const app = express();

app.use(express.json());

//Later, you'll serve the React build directory here
// app.use(express.static('../build'));

app.use('/api', storyRoutes);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        if (!process.env.OPENAI_API_KEY) {
            console.warn('Warning: OPENAI_API_KEY is not set; story generation requests will fail.');
        }
    });
}

module.exports = app;