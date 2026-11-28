// All story prompt templates live here so they are easy to find and experiment with.
// The system prompt can also be edited live from the "Prompt settings" panel in the UI.

const DEFAULT_SYSTEM_PROMPT = `You are StoryWeaver, a collaborative storyteller writing an interactive story with a reader.

Style:
- Write vivid, readable prose in the past tense: 2 to 4 short paragraphs (about 150-250 words) per passage.
- Give characters distinct voices and keep names, personalities and events consistent with everything so far.
- Match the requested creativity (how strange or surprising the world is) and emotional intensity.

Interaction:
- When the reader says what happens next, show it happening and its consequences. Never refuse it; bend it to fit the story if needed.
- Do not end the story. Stop each passage at an interesting moment where the reader can decide what happens next.
- Do not address the reader directly or describe these rules.`;

// Appended to every user message so the model keeps the same parseable format,
// even if the system prompt is edited.
const FORMAT_INSTRUCTIONS = `After the passage, write a line containing only "CHOICES:" followed by exactly three short numbered options (each under 12 words) for what could happen next.`;

const describeLevel = (value, low, high) => `${value}/10 (1 = ${low}, 10 = ${high})`;

const describeCharacter = (char) => {
  const article = /^[aeiou]/i.test(char.trait) ? 'an' : 'a';
  return `${char.name}, ${article} ${char.trait} ${char.type}`;
};

const buildStartPrompt = ({ premise, creativityLevel, emotionalVariance }, characters) => [
  'Begin a new interactive story.',
  `Premise or genre: ${premise || 'Your choice. Surprise me.'}`,
  'Main characters:',
  ...characters.map((char, i) => `${i + 1}. ${describeCharacter(char)}`),
  `Creativity: ${describeLevel(creativityLevel, 'grounded and familiar', 'wildly imaginative')}`,
  `Emotional intensity: ${describeLevel(emotionalVariance, 'gentle and calm', 'dramatic highs and lows')}`,
  'Write the opening passage: set the scene, introduce the characters, and build to a first moment of decision.',
  '',
  FORMAT_INSTRUCTIONS
].join('\n');

const buildContinuePrompt = (action) => [
  `What happens next: ${action}`,
  'Continue the story from exactly where it left off.',
  '',
  FORMAT_INSTRUCTIONS
].join('\n');

// Legacy one-shot prompt used by POST /api/generateStory
const buildOneShotPrompt = (characters, creativityLevel, emotionalVariance) => {
  let prompt = 'Create a story with the following characters: ';
  characters.forEach((char, index) => {
    const article = /^[aeiou]/i.test(char.type) ? 'an' : 'a';
    prompt += `Character ${index + 1} is ${article} ${char.type} who is very ${char.trait}. `;
  });
  prompt += `The story's creativity level is set to ${creativityLevel} out of 10, and emotional variance is ${emotionalVariance} out of 10. `;
  prompt += 'Keep the story under 500 words and give it a clear beginning, middle and end.';
  return prompt;
};

const cleanChoice = (line) => line
  .replace(/^\s*(?:\d+\s*[.):-]|[-*•])\s*/, '')
  .replace(/[*_`]+/g, '')
  .replace(/^["“]|["”]$/g, '')
  .trim();

const CHOICE_LINE = /^\s*(?:\d+\s*[.):-]|[-*•])\s+\S/;

// Split a model reply into the story passage and its suggested choices.
// Tolerates markdown, <think> blocks, and replies that leave out the CHOICES header.
const parseTurn = (raw) => {
  const text = String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\r\n/g, '\n')
    .trim();
  const lines = text.split('\n');

  let headerIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^[\s#*_>]*(choices|options|what (do you do|happens next)\??)[\s*_]*:?[\s*_]*$/i.test(lines[i])) {
      headerIndex = i;
      break;
    }
  }

  let storyLines = lines;
  let choiceLines = [];
  if (headerIndex >= 0) {
    storyLines = lines.slice(0, headerIndex);
    choiceLines = lines.slice(headerIndex + 1).filter(line => CHOICE_LINE.test(line));
  } else {
    // No header: treat a trailing numbered list as the choices
    let start = lines.length;
    while (start > 0 && (CHOICE_LINE.test(lines[start - 1]) || (lines[start - 1].trim() === '' && start < lines.length))) {
      start--;
    }
    const trailing = lines.slice(start).filter(line => CHOICE_LINE.test(line));
    if (trailing.length >= 2) {
      storyLines = lines.slice(0, start);
      choiceLines = trailing;
    }
  }

  const story = storyLines.join('\n')
    .replace(/\n\s*(?:[-*_]\s*){3,}\s*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const choices = choiceLines.map(cleanChoice).filter(Boolean).slice(0, 4);

  return { text: story || text, choices };
};

module.exports = {
  DEFAULT_SYSTEM_PROMPT,
  FORMAT_INSTRUCTIONS,
  buildStartPrompt,
  buildContinuePrompt,
  buildOneShotPrompt,
  describeCharacter,
  parseTurn
};
