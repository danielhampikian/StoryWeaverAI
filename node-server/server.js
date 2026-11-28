// node-server/server.js
const path = require('path');
// Load node-server/.env no matter which directory the server is started from
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const storyRoutes = require('./storyRoutes');
const { getProvider } = require('./providers');

const app = express();

// Story history is sent with each turn, so allow larger bodies than the 100kb default
app.use(express.json({ limit: '1mb' }));

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