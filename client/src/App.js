// src/App.js
import React, { useState } from 'react';
import axios from 'axios';
import StoryInteraction from './components/StoryInteraction';
import StoryDisplay from './components/StoryDisplay';
import './components/StoryStyles.css'; // Assuming you have a CSS file for styling

function App() {
    const [storySegments, setStorySegments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const generateStory = async ({ creativityLevel, numCharacters, emotionalVariance }) => {
        setIsLoading(true);
        setError('');
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
            setError(error.response?.data?.error || 'Could not generate a story. Is the server running?');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="app">
            <StoryInteraction onSubmit={generateStory} isLoading={isLoading} />
            {error && <p className="error" role="alert">{error}</p>}
            <StoryDisplay storySegments={storySegments} />
        </div>
    );
}

export default App;
