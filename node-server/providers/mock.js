// Free, offline story generator: builds a story from templates using the chosen
// characters, creativity level and emotional variance. No network, no API key.

const NAMES = {
  human: ['Mara', 'Theo', 'Ines', 'Jonah', 'Priya'],
  robot: ['Unit K-7', 'Bolt', 'Cog-9', 'Vesper', 'Tink'],
  alien: ["Zyx'ara", 'Quorl', 'Ixa', 'Nemo-Prime', 'Vrell'],
  animal: ['Pip the fox', 'Barnaby the tortoise', 'Juniper the raven', 'Moss the badger', 'Clementine the cat'],
  mutant: ['Glimmer', 'Brack', 'Hollow Jane', 'Sev', 'Ember']
};

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

const createMockProvider = ({ delayMs = 0 } = {}) => ({
  name: 'mock',
  model: 'template',
  configError: null,
  async generateStory({ story }) {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return buildMockStory(story);
  }
});

module.exports = { createMockProvider, buildMockStory };
