// src/components/StoryDisplay.js
import React from 'react';
import './StoryStyles.css'; // Importing the CSS file


function StoryDisplay({ storySegments }) {
  return (
    <div className="story-display">
      {storySegments.map((segment, index) => (
        <div key={index} className={`message ${segment.character}`}>
          <p>{segment.text}</p>
        </div>
      ))}
    </div>
  );
}

export default StoryDisplay;
