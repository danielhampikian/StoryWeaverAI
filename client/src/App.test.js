import { render, screen, fireEvent } from '@testing-library/react';
import axios from 'axios';
import App from './App';

jest.mock('axios', () => ({ post: jest.fn() }));

afterEach(() => jest.clearAllMocks());

test('submits numeric options to the server and displays the story', async () => {
  axios.post.mockResolvedValue({ data: { story: 'Once upon a time...' } });
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /generate story/i }));

  expect(await screen.findByText('Once upon a time...')).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith('/api/generateStory', {
    creativityLevel: 5,
    numCharacters: 2,
    emotionalVariance: 5
  });
});

test('shows the server error message when generation fails', async () => {
  axios.post.mockRejectedValue({ response: { data: { error: 'OPENAI_API_KEY is not configured' } } });
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /generate story/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent('OPENAI_API_KEY is not configured');
});