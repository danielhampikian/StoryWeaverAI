import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import axios from 'axios';
import App, { storyToText } from './App';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));

const config = {
  provider: 'mock',
  model: 'mock-storyteller',
  fallbackModels: [],
  configError: null,
  defaultSystemPrompt: 'You are StoryWeaver.',
  formatInstructions: 'End with CHOICES:',
  maxHistoryMessages: 16
};

const turnResponse = (text, choices, userMessage = 'Begin the story.') => ({
  data: {
    characters: [{ name: 'Mara', type: 'Explorer', trait: 'curious' }],
    turn: { text, choices },
    exchange: [{ role: 'user', content: userMessage }, { role: 'assistant', content: text }],
    provider: 'mock',
    model: 'mock-storyteller',
    temperature: 0.9,
    skippedModels: [],
    sentMessages: 2
  }
});

beforeEach(() => {
  axios.get.mockResolvedValue({ data: config });
  axios.post.mockReset();
});

const startStory = async () => {
  axios.post.mockResolvedValueOnce(turnResponse('The tide went out and did not return.', ['Follow the tide', 'Wait on the shore']));
  render(<App />);
  await screen.findByText(/Storyteller:/);
  fireEvent.change(screen.getByLabelText(/Where does it begin/), { target: { value: 'An empty sea' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cross the threshold' }));
  await screen.findByText('The tide went out and did not return.');
};

test('starts a story from the setup and shows the passage and choices', async () => {
  await startStory();
  expect(axios.post).toHaveBeenCalledWith('/api/story/start', {
    setup: { premise: 'An empty sea', numCharacters: 2, creativityLevel: 6, emotionalVariance: 5 },
    settings: { systemPrompt: 'You are StoryWeaver.', model: undefined, temperature: undefined }
  });
  expect(screen.getByRole('heading', { name: 'An empty sea' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Follow the tide' })).toBeInTheDocument();
});

test('continues with a suggested choice and an edited system prompt', async () => {
  await startStory();
  fireEvent.click(screen.getByRole('button', { name: 'Prompt settings' }));
  fireEvent.change(screen.getByLabelText('System prompt'), { target: { value: 'Write like a ghost story.' } });
  axios.post.mockResolvedValueOnce(turnResponse('Mara walked out onto the wet sand.', ['Keep going'], 'Follow the tide'));
  fireEvent.click(screen.getByRole('button', { name: 'Follow the tide' }));
  await screen.findByText('Mara walked out onto the wet sand.');
  const [url, body] = axios.post.mock.calls[1];
  expect(url).toBe('/api/story/continue');
  expect(body.action).toBe('Follow the tide');
  expect(body.history).toHaveLength(2);
  expect(body.settings.systemPrompt).toBe('Write like a ghost story.');
  expect(screen.getByText('Follow the tide', { selector: '.move__text' })).toBeInTheDocument();
});

test('shows a server error and lets the reader try again', async () => {
  await startStory();
  axios.post.mockRejectedValueOnce({ response: { status: 429, data: { error: 'The free model is busy.' } } });
  fireEvent.change(screen.getByLabelText(/write your own move/i), { target: { value: 'Mara sings' } });
  fireEvent.click(screen.getByRole('button', { name: 'Step forward' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The free model is busy.');
  axios.post.mockResolvedValueOnce(turnResponse('The sea sang back.', [], 'Mara sings'));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('The sea sang back.');
  expect(axios.post.mock.calls[2][1].action).toBe('Mara sings');
});

test('exports the story as plain text', () => {
  const text = storyToText({
    setup: { premise: 'An empty sea' },
    characters: [{ name: 'Mara', type: 'Explorer', trait: 'curious' }],
    entries: [{ kind: 'passage', text: 'One.' }, { kind: 'action', text: 'Go' }, { kind: 'passage', text: 'Two.' }]
  });
  expect(text).toBe('StoryWeaver: An empty sea\n\nCast: Mara (curious Explorer)\n\nOne.\n\n> Go\n\nTwo.\n');
});