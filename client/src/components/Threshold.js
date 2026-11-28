// src/components/Threshold.js
// The setup screen: a grey wall of borrowed narrative with a doorway the reader steps through.
import React, { useRef } from 'react';

const BORROWED = [
  'be realistic', 'that is just how it is', 'people like you', 'stay in your lane', 'everyone knows',
  'it has always been this way', 'follow the script', 'you should want', 'maybe someday', 'they said',
  'not for you', 'play it safe', 'the way things are', 'wait your turn', 'know your place', 'as you were told'
];

const wallLines = Array.from({ length: 48 }, (_, row) =>
  Array.from({ length: 10 }, (_, i) => BORROWED[(row * 3 + i * 5) % BORROWED.length]).join(' \u00b7 '));

const SLIDERS = [
  { key: 'numCharacters', label: 'Companions', min: 1, max: 6, low: 'alone-ish', high: 'a crowd' },
  { key: 'creativityLevel', label: 'Strangeness', min: 1, max: 10, low: 'grounded', high: 'impossible' },
  { key: 'emotionalVariance', label: 'Emotional weather', min: 1, max: 10, low: 'still', high: 'storm' }
];

function Threshold({ setup, onChange, onStart, isLoading, error, config, configError, onToggleSettings, settingsOpen }) {
  const doorRef = useRef(null);

  const update = (key, value) => onChange({ ...setup, [key]: value });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isLoading) return;
    const rect = doorRef.current?.getBoundingClientRect();
    onStart(rect && rect.width ? rect : null);
  };

  const storyteller = config
    ? `${config.provider}${config.model ? ` \u00b7 ${config.model}` : ''}`
    : null;

  return (
    <main className="threshold">
      <div className="wall" aria-hidden="true">
        {wallLines.map((line, i) => <p key={i}>{line}</p>)}
      </div>

      <header className="threshold__bar">
        <span className="wordmark"><span className="arch-glyph" aria-hidden="true" />StoryWeaver</span>
        <button type="button" className="link-button" onClick={onToggleSettings} aria-expanded={settingsOpen} aria-controls="prompt-settings">
          Prompt settings
        </button>
      </header>

      <section className="threshold__outside">
        <h1 className="threshold__headline">Stop living inside someone else&rsquo;s story.</h1>
        <p className="threshold__lede">
          Everything out here was written for you. Step through the door, choose who comes with you,
          and decide what happens next, one turn at a time.
        </p>
        {storyteller && (
          <p className="threshold__teller">
            Storyteller: <strong>{storyteller}</strong>
            {config.provider === 'mock' && <> (free practice mode, no AI key needed)</>}
          </p>
        )}
        {config?.configError && <p className="notice" role="alert">{config.configError}</p>}
        {configError && <p className="notice" role="alert">{configError}</p>}
      </section>

      <form className="door" ref={doorRef} onSubmit={handleSubmit} aria-labelledby="door-title">
        <div className="door__inner">
          <h2 id="door-title" className="door__title">Write your own.</h2>

          <label className="field field--premise">
            <span className="field__label">Where does it begin?</span>
            <textarea
              rows={3}
              maxLength={500}
              value={setup.premise}
              onChange={e => update('premise', e.target.value)}
              placeholder="A lighthouse keeper hears singing from under the sea..."
            />
            <span className="field__hint">A premise, a genre, a feeling. Leave it blank to be surprised.</span>
          </label>

          {SLIDERS.map(slider => (
            <label className="field field--range" key={slider.key}>
              <span className="field__label">
                {slider.label}
                <output className="field__value">{setup[slider.key]}</output>
              </span>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                value={setup[slider.key]}
                onChange={e => update(slider.key, Number(e.target.value))}
              />
              <span className="field__ends" aria-hidden="true"><span>{slider.low}</span><span>{slider.high}</span></span>
            </label>
          ))}

          {error && <p className="door__error" role="alert">{error}</p>}

          <button type="submit" className="cross-button" disabled={isLoading}>
            {isLoading ? 'Opening...' : 'Cross the threshold'}
          </button>
        </div>
      </form>
    </main>
  );
}

export default Threshold;
