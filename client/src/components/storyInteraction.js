// src/components/StoryInteraction.js
import React, { useState } from 'react';

function StoryInteraction({ onSubmit }) {
  const [creativityLevel, setCreativityLevel] = useState(5);
  const [numCharacters, setNumCharacters] = useState(2);
  const [emotionalVariance, setEmotionalVariance] = useState(5);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      creativityLevel, 
      numCharacters, 
      emotionalVariance
    });
  };

  return (
    <div className="story-interaction">
      <form onSubmit={handleFormSubmit}>
        <div>
          <label>
            Creativity Level:
            <input 
              type="range" 
              min="1" 
              max="10" 
              value={creativityLevel} 
              onChange={e => setCreativityLevel(e.target.value)} 
            />
          </label>
        </div>
        <div>
          <label>
            Number of Characters:
            <input 
              type="number" 
              min="1" 
              max="10" 
              value={numCharacters} 
              onChange={e => setNumCharacters(e.target.value)} 
            />
          </label>
        </div>
        <div>
          <label>
            Emotional Variance:
            <input 
              type="range" 
              min="1" 
              max="10" 
              value={emotionalVariance} 
              onChange={e => setEmotionalVariance(e.target.value)} 
            />
          </label>
        </div>
        <button type="submit">Generate Story</button>
      </form>
    </div>
    
  );
}

export default StoryInteraction;
