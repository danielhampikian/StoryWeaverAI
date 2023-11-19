// src/App.js
import React, { useState } from 'react';
import axios from 'axios';
import StoryInteraction from './components/StoryInteraction';
import StoryDisplay from './components/StoryDisplay';
import './components/StoryStyles.css'; // Assuming you have a CSS file for styling

function App() {
    const [storySegments, setStorySegments] = useState([]);

    const generateStory = async ({ creativityLevel, numCharacters, emotionalVariance }) => {
        try {
            const response = await axios.post('/api/generateStory', {
                creativityLevel, 
                numCharacters, 
                emotionalVariance
            });
            const newSegment = {
                character: 'narrator', // You might want to adjust this based on your backend response
                text: response.data.story
            };
            setStorySegments(oldSegments => [...oldSegments, newSegment]);
        } catch (error) {
            console.error('Error in generating story:', error);
        }
    };

    return (
        <div className="app">
            <StoryInteraction onSubmit={generateStory} />
            <StoryDisplay storySegments={storySegments} />
        </div>
    );
}

export default App;
