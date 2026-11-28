// Free, offline story generator: builds a story from templates using the chosen
// characters, creativity level and emotional variance. No network, no API key.

const { NAMES } = require('../characters');

const TRAIT_ACTIONS = {
  brave: 'stepped forward without hesitation',
  curious: "couldn't stop asking questions and poking at every clue",
  witty: 'cracked a joke that broke the tension',
  mysterious: 'said little, but seemed to know far more than they let on',
  sarcastic: 'rolled their eyes and muttered something cutting, yet stayed to help'
};

// Settings and problems grow stranger as creativity rises (tiers: 1-3, 4-7, 8-10)
const SETTINGS = [
  ['a quiet seaside village', 'a busy city library', 'a small farm at the edge of the woods'],
  ['an abandoned space station', 'a floating market above the clouds', 'a forest where the trees whisper at night'],
  ['a city built on the back of a sleeping whale', 'a library where every book rewrites itself at midnight', 'a desert of glass that sings when the wind blows']
];

const PROBLEMS = [
  ['the old lighthouse lamp went dark', 'a valuable map went missing', 'a storm cut the town off from the world'],
  ['a distress signal began repeating from somewhere below', 'the stars in the sky started rearranging themselves', 'every clock in the land stopped at the same moment'],
  ['gravity began to flow sideways like a river', 'the moon sent a polite letter asking to come down for a visit', 'all of yesterday leaked into today and refused to leave']
];

// Emotional tone grows more intense as variance rises (tiers: 1-3, 4-7, 8-10)
const MOODS = [
  {
    middle: 'There was no great drama, just a steady, quiet worry that grew a little each day.',
    ending: 'In the end they fixed what was broken and went home content, the way you feel after a good cup of tea.'
  },
  {
    middle: 'Hope and doubt took turns: one moment they were laughing, the next they were arguing about whether to give up.',
    ending: 'When it was over, they were tired and a little bruised, but closer friends than when they started.'
  },
  {
    middle: 'Joy turned to terror in a heartbeat. Friendships cracked, tears fell, and for one awful moment it seemed everything was lost.',
    ending: 'Against all odds they triumphed, laughing and sobbing at once, forever changed by what they had survived together.'
  }
];

const tier = (level) => (level <= 3 ? 0 : level <= 7 ? 1 : 2);
const pick = (array, random) => array[Math.floor(random() * array.length)];
const withArticle = (word) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;

const listToSentence = (items) => {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

const buildMockStory = ({ characters, creativityLevel, emotionalVariance }, random = Math.random) => {
  const usedNames = new Set();
  const cast = characters.map((char) => {
    const options = NAMES[char.type] || ['Someone'];
    let name = pick(options, random);
    for (let i = 0; usedNames.has(name) && i < options.length; i++) {
      name = options[(options.indexOf(name) + 1) % options.length];
    }
    usedNames.add(name);
    return { ...char, name };
  });

  const creativity = tier(creativityLevel);
  const mood = MOODS[tier(emotionalVariance)];
  const setting = pick(SETTINGS[creativity], random);
  const problem = pick(PROBLEMS[creativity], random);

  const intro = `In ${setting} lived ${listToSentence(cast.map(c => `${c.name}, ${withArticle(c.trait)} ${c.type}`))}. ` +
    `One day, ${problem}.`;
  const actions = cast.map(c => `${c.name} ${TRAIT_ACTIONS[c.trait] || 'did their best'}.`).join(' ');
  const middle = `${actions} ${mood.middle}`;

  return [intro, middle, mood.ending, '(Written by the free mock story generator. Set AI_PROVIDER to use a real AI model.)']
    .join('\n\n');
};

// --- Interactive (turn-by-turn) mock ---

const HOOKS = [
  'Somewhere close by, a door that had been locked for years clicked open.',
  'Then a voice none of them recognised called their names from the dark.',
  'At that exact moment, the ground beneath them gave a long, low shudder.',
  'A folded note slid out from under a stone, addressed to all of them.'
];

const TWISTS = [
  ['It did not go quite to plan, but nothing was broken that could not be fixed.', 'Halfway through, they found an old set of footprints leading somewhere new.'],
  ['The moment they did, every lantern in sight flickered and turned a deep shade of blue.', 'It worked, and it also woke something that had been sleeping a very long time.'],
  ['Reality hiccupped: for three heartbeats everyone spoke only in birdsong.', 'The sky folded in half like paper and a staircase unrolled down to meet them.']
];

const MOOD_BEATS = [
  ['They traded a calm look and carried on.', 'Nobody panicked; there was even time for a small joke.'],
  ['Hope flickered, then doubt, and for a moment they argued about what it meant.', 'Their hearts were pounding now, though nobody wanted to admit it.'],
  ['Someone screamed; someone else laughed far too loudly. Nothing would ever be the same.', 'Tears stung, tempers flared, and a promise was made that could not be taken back.']
];

const choicePool = (cast) => {
  const a = cast[0]?.name || 'the hero';
  const b = (cast[1] || cast[0])?.name || 'a stranger';
  return [
    `${a} investigates the strange sound`,
    `Ask ${b} what they are really hiding`,
    'Run for the nearest exit before it is too late',
    `${b} tries something reckless`,
    'Follow the trail deeper into the unknown',
    'Stop, listen, and wait to see what happens'
  ];
};

const pickDistinct = (array, count, random) => {
  const pool = [...array];
  const picked = [];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked;
};

const formatChoices = (choices) => `CHOICES:\n${choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

// context: { kind: 'start' | 'continue', setup: { premise, creativityLevel, emotionalVariance }, characters, action }
const buildMockTurn = ({ kind, setup = {}, characters = [], action }, random = Math.random) => {
  const cast = characters.length ? characters : [{ name: 'Mara', type: 'human', trait: 'brave' }];
  const creativity = tier(setup.creativityLevel || 5);
  const emotion = tier(setup.emotionalVariance || 5);
  let paragraphs;

  if (kind === 'start') {
    const premise = (setup.premise || '').trim().replace(/[.!?]+$/, '');
    const opening = `In ${pick(SETTINGS[creativity], random)}, ${pick(PROBLEMS[creativity], random)}.` +
      (premise ? ` Nobody knew it yet, but this was the start of a tale best summed up as: ${premise}.` : '');
    const introductions = cast
      .map(c => `${c.name}, ${withArticle(c.trait)} ${c.type}, ${TRAIT_ACTIONS[c.trait] || 'watched carefully'}.`)
      .join(' ');
    paragraphs = [opening, introductions, `${pick(MOOD_BEATS[emotion], random)} ${pick(HOOKS, random)}`];
  } else {
    const actor = pick(cast, random);
    const cleanAction = String(action || '').trim().replace(/[.!?]+$/, '');
    paragraphs = [
      `"${cleanAction}." That was the plan, and ${actor.name} saw it through without a second thought.`,
      `${pick(TWISTS[creativity], random)} ${pick(MOOD_BEATS[emotion], random)}`,
      pick(HOOKS, random)
    ];
  }

  return [...paragraphs, formatChoices(pickDistinct(choicePool(cast), 3, random))].join('\n\n');
};

const createMockProvider = ({ delayMs = 0 } = {}) => {
  const wait = () => (delayMs > 0 ? new Promise(resolve => setTimeout(resolve, delayMs)) : Promise.resolve());
  return {
    name: 'mock',
    model: 'template',
    fallbackModels: [],
    configError: null,
    async complete({ context }) {
      await wait();
      return { text: buildMockTurn(context || {}), model: 'template', attempts: [] };
    },
    async generateStory({ story }) {
      await wait();
      return buildMockStory(story);
    }
  };
};

module.exports = { createMockProvider, buildMockStory, buildMockTurn };
