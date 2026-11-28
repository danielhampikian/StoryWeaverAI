// Random character profiles (type, trait and a name) used to seed new stories.

const CHARACTER_TYPES = ['human', 'robot', 'alien', 'animal', 'mutant'];
const PERSONALITY_TRAITS = ['brave', 'curious', 'witty', 'mysterious', 'sarcastic'];

const NAMES = {
  human: ['Mara', 'Theo', 'Ines', 'Jonah', 'Priya'],
  robot: ['Unit K-7', 'Bolt', 'Cog-9', 'Vesper', 'Tink'],
  alien: ["Zyx'ara", 'Quorl', 'Ixa', 'Nemo-Prime', 'Vrell'],
  animal: ['Pip the fox', 'Barnaby the tortoise', 'Juniper the raven', 'Moss the badger', 'Clementine the cat'],
  mutant: ['Glimmer', 'Brack', 'Hollow Jane', 'Sev', 'Ember']
};

const pick = (array, random) => array[Math.floor(random() * array.length)];

const createCharacterProfiles = (numCharacters, random = Math.random) => {
  const usedNames = new Set();
  const characters = [];
  for (let i = 0; i < numCharacters; i++) {
    const type = pick(CHARACTER_TYPES, random);
    const trait = pick(PERSONALITY_TRAITS, random);
    const options = NAMES[type];
    let name = pick(options, random);
    for (let tries = 0; usedNames.has(name) && tries < options.length; tries++) {
      name = options[(options.indexOf(name) + 1) % options.length];
    }
    if (usedNames.has(name)) {
      name = `${name} ${i + 1}`;
    }
    usedNames.add(name);
    characters.push({ name, type, trait });
  }
  return characters;
};

module.exports = { CHARACTER_TYPES, PERSONALITY_TRAITS, NAMES, createCharacterProfiles };
