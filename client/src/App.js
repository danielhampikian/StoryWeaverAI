// src/App.js
import React, { useState } from 'react';
import axios from 'axios';

function App() {
    const [prompt, setPrompt] = useState('');
    const [story, setStory] = useState('');

    const generateStory = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('/api/generateStory', { prompt });
            setStory(story => story + '\n' + response.data.storyPart);
        } catch (error) {
            console.error('Error in generating story:', error);
        }
    };

    return (
        <div>
            <form onSubmit={generateStory}>
                <input 
                    type="text" 
                    value={prompt} 
                    onChange={(e) => setPrompt(e.target.value)} 
                />
                <button type="submit">Add to Story</button>
            </form>
            <div>{story}</div>
        </div>
    );
}

export default App;
