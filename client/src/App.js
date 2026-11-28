// src/App.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Threshold from './components/Threshold';
import StoryView from './components/StoryView';
import PromptSettings from './components/PromptSettings';
import './components/StoryStyles.css';

const DEFAULT_SETUP = { premise: '', numCharacters: 2, creativityLevel: 6, emotionalVariance: 5 };
const OFFLINE_MESSAGE = 'Could not reach the story server. Start it with "npm start" in node-server, then try again.';

const errorMessage = (error) => error.response?.data?.error ||
  (error.response ? `The story server returned an error (${error.response.status}).` : OFFLINE_MESSAGE);

const passageFrom = (data) => ({
  kind: 'passage',
  text: data.turn.text,
  choices: data.turn.choices || [],
  provider: data.provider,
  model: data.model,
  temperature: data.temperature,
  skippedModels: data.skippedModels || []
});

export const storyToText = (story) => {
  const lines = [story.setup.premise ? `StoryWeaver: ${story.setup.premise}` : 'StoryWeaver'];
  lines.push(`Cast: ${story.characters.map(c => `${c.name} (${c.trait} ${c.type})`).join(', ')}`);
  story.entries.forEach(entry => {
    lines.push(entry.kind === 'action' ? `> ${entry.text}` : entry.text);
  });
  return `${lines.join('\n\n')}\n`;
};

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

function App() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState('');
  const [setup, setSetup] = useState(DEFAULT_SETUP);
  const [settings, setSettings] = useState({ systemPrompt: '', model: '', temperature: '' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phase, setPhase] = useState('setup'); // setup -> crossing -> story
  const [portalRect, setPortalRect] = useState(null);
  const [story, setStory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [lastRequest, setLastRequest] = useState(null);

  useEffect(() => {
    axios.get('/api/config')
      .then(({ data }) => {
        setConfig(data);
        setSettings(current => (current.systemPrompt ? current : { ...current, systemPrompt: data.defaultSystemPrompt }));
      })
      .catch(err => setConfigError(errorMessage(err)));
  }, []);

  const requestSettings = () => ({
    systemPrompt: settings.systemPrompt,
    model: settings.model.trim() || undefined,
    temperature: settings.temperature === '' ? undefined : Number(settings.temperature)
  });

  const rememberRequest = (data, sentSettings) => setLastRequest({
    systemPrompt: sentSettings.systemPrompt || config?.defaultSystemPrompt || '',
    userMessage: data.exchange[0].content,
    sentMessages: data.sentMessages
  });

  const startStory = async (rect) => {
    setPortalRect(rect);
    setPhase('crossing');
    setError('');
    setIsLoading(true);
    const sentSettings = requestSettings();
    try {
      const { data } = await axios.post('/api/story/start', { setup, settings: sentSettings });
      setStory({ setup: { ...setup }, characters: data.characters, history: data.exchange, entries: [passageFrom(data)] });
      rememberRequest(data, sentSettings);
      setPhase('story');
    } catch (err) {
      setError(errorMessage(err));
      setPhase('setup');
    } finally {
      setIsLoading(false);
    }
  };

  const continueStory = async (action) => {
    const text = (action || '').trim();
    if (!text || isLoading) return;
    setPendingAction(text);
    setError('');
    setIsLoading(true);
    const sentSettings = requestSettings();
    try {
      const { data } = await axios.post('/api/story/continue', {
        setup: story.setup,
        characters: story.characters,
        history: story.history,
        action: text,
        settings: sentSettings
      });
      setStory(current => ({
        ...current,
        history: [...current.history, ...data.exchange],
        entries: [...current.entries, { kind: 'action', text }, passageFrom(data)]
      }));
      rememberRequest(data, sentSettings);
      setPendingAction(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const newStory = () => {
    setStory(null);
    setPendingAction(null);
    setError('');
    setPhase('setup');
  };

  const settingsPanel = (
    <PromptSettings
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      settings={settings}
      onChange={setSettings}
      config={config}
      creativityLevel={(story?.setup || setup).creativityLevel}
      lastRequest={lastRequest}
    />
  );

  if (phase === 'story' && story) {
    return (
      <>
        <StoryView
          story={story}
          isLoading={isLoading}
          error={error}
          pendingAction={pendingAction}
          onContinue={continueStory}
          onRetry={() => continueStory(pendingAction)}
          onDismissError={() => { setError(''); setPendingAction(null); }}
          onNewStory={newStory}
          onToggleSettings={() => setSettingsOpen(open => !open)}
          settingsOpen={settingsOpen}
          storyText={storyToText(story)}
          reducedMotion={prefersReducedMotion()}
        />
        {settingsPanel}
      </>
    );
  }

  return (
    <>
      <Threshold
        setup={setup}
        onChange={setSetup}
        onStart={startStory}
        isLoading={isLoading}
        error={error}
        config={config}
        configError={configError}
        onToggleSettings={() => setSettingsOpen(open => !open)}
        settingsOpen={settingsOpen}
      />
      {phase === 'crossing' && (
        <div
          className={`crossing${prefersReducedMotion() ? ' crossing--still' : ''}`}
          style={portalRect ? {
            '--from-top': `${portalRect.top}px`,
            '--from-right': `${window.innerWidth - portalRect.right}px`,
            '--from-bottom': `${Math.max(0, window.innerHeight - portalRect.bottom)}px`,
            '--from-left': `${portalRect.left}px`,
            '--from-radius': `${portalRect.width / 2}px`
          } : undefined}
          role="status"
          aria-live="polite"
        >
          <p className="crossing__words">Stepping through</p>
          <p className="crossing__hint">The storyteller is writing your first scene.</p>
        </div>
      )}
      {settingsPanel}
    </>
  );
}

export default App;
