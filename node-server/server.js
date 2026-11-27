// node-server/server.js
require('dotenv').config();
const express = require('express');
const storyRoutes = require('./storyRoutes');
const { getProvider } = require('./providers');

const app = express();

app.use(express.json());

//Later, you'll serve the React build directory here
// app.use(express.static('../build'));

app.use('/api', storyRoutes);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        const provider = getProvider();
        console.log(`Story provider: ${provider.name}${provider.model ? ` (model: ${provider.model})` : ''}`);
        if (provider.configError) {
            console.warn(`Warning: ${provider.configError}`);
        }
    });
}

module.exports = app;