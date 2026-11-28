// src/components/PromptSettings.js
// A side panel for experimenting with the system prompt, model and temperature.
import React, { useEffect, useRef } from 'react';

const autoTemperature = (creativityLevel) => (0.3 + ((creativityLevel - 1) / 9) * 0.9).toFixed(2);

function PromptSettings({ open, onClose, settings, onChange, config, creativityLevel, lastRequest }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const update = (key, value) => onChange({ ...settings, [key]: value });
  const modelOptions = config ? [config.model, ...(config.fallbackModels || [])].filter(Boolean) : [];
  const isDefaultPrompt = config && settings.systemPrompt === config.defaultSystemPrompt;

  return (
    <aside
      id="prompt-settings"
      className="settings"
      hidden={!open}
      aria-labelledby="settings-title"
      tabIndex={-1}
      ref={panelRef}
    >
      <div className="settings__head">
        <h2 id="settings-title">Prompt settings</h2>
        <button type="button" className="text-button text-button--light" onClick={onClose}>Close</button>
      </div>
      <p className="settings__note">
        Changes apply to the next turn. Storyteller: <strong>{config ? config.provider : 'unknown'}</strong>.
      </p>

      <label className="settings__field">
        <span className="settings__label">System prompt</span>
        <textarea
          rows={12}
          value={settings.systemPrompt}
          onChange={e => update('systemPrompt', e.target.value)}
          spellCheck="false"
        />
      </label>
      <button
        type="button"
        className="text-button text-button--light"
        onClick={() => update('systemPrompt', config?.defaultSystemPrompt || '')}
        disabled={!config || isDefaultPrompt}
      >
        Reset to default prompt
      </button>

      <div className="settings__row">
        <label className="settings__field">
          <span className="settings__label">Model</span>
          <input
            type="text"
            list="model-options"
            value={settings.model}
            onChange={e => update('model', e.target.value)}
            placeholder={config?.model || 'server default'}
            spellCheck="false"
          />
          <datalist id="model-options">
            {modelOptions.map(model => <option key={model} value={model} />)}
          </datalist>
        </label>
        <label className="settings__field settings__field--narrow">
          <span className="settings__label">Temperature</span>
          <input
            type="number"
            min="0"
            max="2"
            step="0.05"
            value={settings.temperature}
            onChange={e => update('temperature', e.target.value)}
            placeholder={`auto ${autoTemperature(creativityLevel)}`}
          />
        </label>
      </div>
      <p className="settings__hint">
        Leave the model blank to use the server default{config?.fallbackModels?.length ? ', which falls back to other free models when one is busy' : ''}.
        Temperature defaults to the Strangeness setting.
      </p>

      {config?.formatInstructions && (
        <details className="settings__details">
          <summary>Always added to each request</summary>
          <pre>{config.formatInstructions}</pre>
        </details>
      )}

      <details className="settings__details" open={Boolean(lastRequest)}>
        <summary>Last request sent</summary>
        {lastRequest ? (
          <>
            <p className="settings__hint">{lastRequest.sentMessages} messages: the system prompt, recent story turns, and this message.</p>
            <pre>{lastRequest.userMessage}</pre>
          </>
        ) : (
          <p className="settings__hint">Nothing sent yet. Start a story to see the exact prompt.</p>
        )}
      </details>
    </aside>
  );
}

export default PromptSettings;
