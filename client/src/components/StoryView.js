// src/components/StoryView.js
// The far side of the door: a reading sheet that holds the story, your moves, and the next doors.
import React, { useEffect, useRef, useState } from 'react';

// Minimal inline formatting for model output: **bold** and *italic* / _italic_
const renderInline = (text) => text
  .split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g)
  .map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^(\*[^*]+\*|_[^_]+_)$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });

const paragraphs = (text) => text
  .split(/\n\s*\n/)
  .map(block => block.replace(/^#+\s*/, '').trim())
  .filter(Boolean);

const describeTurn = (entry) => {
  const parts = [entry.provider, entry.model];
  if (typeof entry.temperature === 'number') parts.push(`temperature ${entry.temperature}`);
  return parts.filter(Boolean).join(' \u00b7 ');
};

function StoryView({
  story, isLoading, error, pendingAction, onContinue, onRetry, onDismissError,
  onNewStory, onToggleSettings, settingsOpen, storyText, reducedMotion
}) {
  const [action, setAction] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const lastPassageRef = useRef(null);
  const pendingRef = useRef(null);
  const passageCount = story.entries.filter(e => e.kind === 'passage').length;
  const lastEntry = story.entries[story.entries.length - 1];
  const choices = !isLoading && !pendingAction && lastEntry?.kind === 'passage' ? lastEntry.choices : [];

  useEffect(() => {
    if (passageCount > 1) {
      lastPassageRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [passageCount, reducedMotion]);

  useEffect(() => {
    if (pendingAction && isLoading) {
      pendingRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
  }, [pendingAction, isLoading, reducedMotion]);

  const submitAction = (event) => {
    event.preventDefault();
    if (!action.trim() || isLoading) return;
    onContinue(action);
    setAction('');
  };

  const copyStory = async () => {
    try {
      await navigator.clipboard.writeText(storyText);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Copy failed');
    }
    setTimeout(() => setCopyStatus(''), 2000);
  };

  const downloadStory = () => {
    const url = URL.createObjectURL(new Blob([storyText], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'storyweaver-story.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  let passageIndex = 0;

  return (
    <div className="beyond">
      <header className="beyond__bar">
        <span className="wordmark wordmark--light"><span className="arch-glyph" aria-hidden="true" />StoryWeaver</span>
        <nav className="beyond__actions" aria-label="Story actions">
          <button type="button" className="bar-button" onClick={onToggleSettings} aria-expanded={settingsOpen} aria-controls="prompt-settings">
            Prompt settings
          </button>
          <button type="button" className="bar-button" onClick={copyStory}>{copyStatus || 'Copy'}</button>
          <button type="button" className="bar-button" onClick={downloadStory}>Download .txt</button>
          <button type="button" className="bar-button bar-button--strong" onClick={onNewStory}>New story</button>
        </nav>
      </header>

      <main className="sheet" aria-labelledby="story-title">
        <header className="sheet__head">
          <h1 id="story-title" className="sheet__title">{story.setup.premise || 'A story of your own'}</h1>
          <ul className="cast" aria-label="Cast">
            {story.characters.map(c => (
              <li key={c.name}><strong>{c.name}</strong> {c.trait} {c.type}</li>
            ))}
          </ul>
        </header>

        <ol className="transcript">
          {story.entries.map((entry, i) => {
            if (entry.kind === 'action') {
              return (
                <li key={i} className="move">
                  <span className="move__label">You chose</span>
                  <span className="move__text">{entry.text}</span>
                </li>
              );
            }
            passageIndex += 1;
            const isLast = i === story.entries.length - 1;
            return (
              <li key={i} className="passage" ref={isLast ? lastPassageRef : undefined} aria-label={`Passage ${passageIndex}`}>
                {paragraphs(entry.text).map((para, p) => <p key={p}>{renderInline(para)}</p>)}
                <p className="passage__meta">
                  {describeTurn(entry)}
                  {entry.skippedModels.length > 0 && (
                    <> (after {entry.skippedModels.map(s => `${s.model} ${s.status || 'failed'}`).join(', ')})</>
                  )}
                </p>
              </li>
            );
          })}
          {pendingAction && (
            <li className="move move--pending" ref={pendingRef}>
              <span className="move__label">You chose</span>
              <span className="move__text">{pendingAction}</span>
            </li>
          )}
          {isLoading && (
            <li className="writing" role="status">
              <span className="writing__line" aria-hidden="true" />
              The storyteller is writing what happens next...
            </li>
          )}
        </ol>

        {error && (
          <div className="sheet__error" role="alert">
            <p>{error}</p>
            <div className="sheet__error-actions">
              {pendingAction && <button type="button" className="door-button door-button--small" onClick={onRetry} disabled={isLoading}>Try again</button>}
              <button type="button" className="text-button" onClick={onDismissError}>Dismiss</button>
            </div>
          </div>
        )}

        <section className="next" aria-labelledby="next-title">
          <h2 id="next-title" className="next__title">What happens next is yours.</h2>
          {choices.length > 0 && (
            <ul className="doors" aria-label="Suggested choices">
              {choices.map((choice, i) => (
                <li key={i}>
                  <button type="button" className="door-button" onClick={() => onContinue(choice)} disabled={isLoading}>
                    {choice}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="own-move" onSubmit={submitAction}>
            <label htmlFor="own-move-input" className="own-move__label">
              {choices.length > 0 ? 'Or write your own move' : 'Write your move'}
            </label>
            <div className="own-move__row">
              <textarea
                id="own-move-input"
                rows={2}
                maxLength={500}
                value={action}
                onChange={e => setAction(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) submitAction(e);
                }}
                placeholder="Mara refuses to open the door and lights the lamp instead..."
                disabled={isLoading}
              />
              <button type="submit" className="step-button" disabled={isLoading || !action.trim()}>Step forward</button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default StoryView;
