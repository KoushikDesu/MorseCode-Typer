/**
 * Morse Code Core Engine
 * Complete International Morse Code Dictionary & Utilities
 */

const MORSE_MAP = {
  // Letters (A-Z)
  'A': '.-',
  'B': '-...',
  'C': '-.-.',
  'D': '-..',
  'E': '.',
  'F': '..-.',
  'G': '--.',
  'H': '....',
  'I': '..',
  'J': '.---',
  'K': '-.-',
  'L': '.-..',
  'M': '--',
  'N': '-.',
  'O': '---',
  'P': '.--.',
  'Q': '--.-',
  'R': '.-.',
  'S': '...',
  'T': '-',
  'U': '..-',
  'V': '...-',
  'W': '.--',
  'X': '-..-',
  'Y': '-.--',
  'Z': '--..',

  // Numbers (0-9)
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',

  // Punctuation & Symbols
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  '\'': '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  '_': '..--.-',
  '"': '.-..-.',
  '$': '...-..-',
  '@': '.--.-.'
};

// Reverse Mapping: Morse -> Character
const REVERSE_MORSE_MAP = {};
for (const [char, morse] of Object.entries(MORSE_MAP)) {
  REVERSE_MORSE_MAP[morse] = char;
}

// Mnemonics & Visual Memory Aids
const MNEMONICS = {
  'A': { word: 'Arch', hint: 'Dot on peak, Dash across base', pattern: '.-' },
  'B': { word: 'Banjo', hint: 'Dash for neck, 3 dots for keys', pattern: '-...' },
  'C': { word: 'Camera', hint: 'Dash, dot, dash, dot around lens', pattern: '-.-.' },
  'D': { word: 'Door', hint: 'Dash for spine, 2 dots for hinges', pattern: '-..' },
  'E': { word: 'Eye', hint: 'Single quick dot', pattern: '.' },
  'F': { word: 'Firefly', hint: '2 dots, dash, 1 dot', pattern: '..-.' },
  'G': { word: 'Giraffe', hint: '2 dashes for long neck, 1 dot', pattern: '--.' },
  'H': { word: 'Hippopotamus', hint: '4 light footsteps (4 dots)', pattern: '....' },
  'I': { word: 'Insect', hint: '2 dots for eyes', pattern: '..' },
  'J': { word: 'Jaguar', hint: '1 dot head, 3 dashes for body & tail', pattern: '.---' },
  'K': { word: 'Kangaroo', hint: 'Dash, dot, dash (hopping legs)', pattern: '-.-' },
  'L': { word: 'Lantern', hint: 'Dot, dash, 2 dots glowing', pattern: '.-..' },
  'M': { word: 'Mountain', hint: '2 peaks (2 dashes)', pattern: '--' },
  'N': { word: 'Navy', hint: '1 dash mast, 1 dot hull', pattern: '-.' },
  'O': { word: 'Owl', hint: '3 wide round rings (3 dashes)', pattern: '---' },
  'P': { word: 'Penguin', hint: 'Dot, 2 dashes, dot', pattern: '.--.' },
  'Q': { word: 'Queen', hint: '2 dashes, dot, dash crown', pattern: '--.-' },
  'R': { word: 'Robot', hint: 'Dot, dash, dot antennas', pattern: '.-.' },
  'S': { word: 'Snake', hint: '3 quick slither dots', pattern: '...' },
  'T': { word: 'Tower', hint: 'Single solid roof dash', pattern: '-' },
  'U': { word: 'Uniform', hint: '2 dots, 1 dash collar', pattern: '..-' },
  'V': { word: 'Victory', hint: '3 dots and a dash (Beethoven 5th)', pattern: '...-' },
  'W': { word: 'Wizard', hint: '1 dot wand tip, 2 dashes robe', pattern: '.--' },
  'X': { word: 'Xylophone', hint: 'Dash, 2 dots, dash bars', pattern: '-..-' },
  'Y': { word: 'Yacht', hint: 'Dash, dot, 2 dashes sailing', pattern: '-.--' },
  'Z': { word: 'Zebra', hint: '2 dashes, 2 dots stripes', pattern: '--..' },
  '0': { word: 'Zero', hint: '5 solid dashes (Empty ring)', pattern: '-----' },
  '1': { word: 'One', hint: '1 dot followed by 4 dashes', pattern: '.----' },
  '2': { word: 'Two', hint: '2 dots followed by 3 dashes', pattern: '..---' },
  '3': { word: 'Three', hint: '3 dots followed by 2 dashes', pattern: '...--' },
  '4': { word: 'Four', hint: '4 dots followed by 1 dash', pattern: '....-' },
  '5': { word: 'Five', hint: '5 dots for 5 fingers', pattern: '.....' },
  '6': { word: 'Six', hint: '1 dash followed by 4 dots', pattern: '-....' },
  '7': { word: 'Seven', hint: '2 dashes followed by 3 dots', pattern: '--...' },
  '8': { word: 'Eight', hint: '3 dashes followed by 2 dots', pattern: '---..' },
  '9': { word: 'Nine', hint: '4 dashes followed by 1 dot', pattern: '----.' }
};

// Common practice words by category
const PRACTICE_WORDS = {
  easy: ['SOS', 'HI', 'CAT', 'DOG', 'SUN', 'SKY', 'SEA', 'KEY', 'FOX', 'ONE', 'RED', 'BLUE', 'RUN', 'JOY'],
  medium: ['CODE', 'MORSE', 'SIGNAL', 'MONARCH', 'WARRIOR', 'SHADOW', 'ROYAL', 'POWER', 'KNIGHT', 'RADIO', 'SECRET', 'AWAKE'],
  hard: ['SOLO LEVELING', 'KING OF STATES', 'TRANSMISSION', 'TELECOMMUNICATION', 'AUTHENTICATION', 'SHADOW MONARCH', 'SYSTEM AWAKENING']
};

/**
 * Encodes plain text to Morse code string
 */
function textToMorse(text, letterSep = ' ', wordSep = ' / ') {
  if (!text) return '';
  const clean = text.toUpperCase().trim();
  const words = clean.split(/\s+/);
  
  return words.map(word => {
    return word.split('').map(char => {
      return MORSE_MAP[char] || '';
    }).filter(m => m.length > 0).join(letterSep);
  }).filter(w => w.length > 0).join(wordSep);
}

/**
 * Decodes Morse code string into plain text
 */
function morseToText(morse) {
  if (!morse) return '';
  const trimmed = morse.trim();
  const words = trimmed.split(/\s*\/\s*|\s{3,}/);
  
  return words.map(word => {
    const letters = word.trim().split(/\s+/);
    return letters.map(letter => {
      const cleanLetter = letter.replace(/[—–−_]/g, '-').replace(/[•·]/g, '.');
      return REVERSE_MORSE_MAP[cleanLetter] || (cleanLetter ? '?' : '');
    }).join('');
  }).join(' ');
}

/**
 * Resolves a single Morse symbol cluster (e.g. ".-") to character
 */
function decodeSingleMorse(symbol) {
  if (!symbol) return '';
  const clean = symbol.trim().replace(/[—–−_]/g, '-').replace(/[•·]/g, '.');
  return REVERSE_MORSE_MAP[clean] || '?';
}

/**
 * Standard Morse timing calculation based on Words Per Minute (WPM)
 */
function getMorseTiming(wpm = 18) {
  const ditMs = Math.max(20, Math.round(1200 / wpm));
  return {
    dit: ditMs,
    dah: ditMs * 3,
    intraCharGap: ditMs,
    letterGap: ditMs * 3,
    wordGap: ditMs * 7
  };
}

window.MorseCore = {
  MORSE_MAP,
  REVERSE_MORSE_MAP,
  MNEMONICS,
  PRACTICE_WORDS,
  textToMorse,
  morseToText,
  decodeSingleMorse,
  getMorseTiming
};
