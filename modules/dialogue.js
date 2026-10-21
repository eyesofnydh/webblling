/**
 * @module dialogue
 * @description Personality dialogue data and helpers for the Webling extension.
 * Pure data module — no DOM access. All lines are spider/web themed,
 * short (≤80 chars), and safe for all audiences.
 */

// ---------------------------------------------------------------------------
// Dialogue data
// ---------------------------------------------------------------------------

export const DIALOGUE = Object.freeze({

  // =========================================================================
  // CHEEKY — witty, playful, sarcastic, fourth-wall breaking, pun-heavy
  // =========================================================================
  cheeky: Object.freeze({

    greeting: Object.freeze([
      "Miss me? Of course you did.",
      "Another tab? You spoil me.",
      "I'm not clingy, you're clingy.",
      "Oh look, a new web to explore!",
      "Back again? I web-knew it.",
      "Plot twist: I was here first.",
    ]),

    summon: Object.freeze([
      "You rang? Make it quick.",
      "Ta-da! Dramatic entrance complete.",
      "Summoned like a tiny hero.",
      "I was napping on the toolbar.",
      "At your silk-spinning service!",
    ]),

    interact: Object.freeze([
      "Boop! Did that tickle?",
      "Stop clicking, I'm ticklish!",
      "That's my good leg!",
      "Eight legs, zero personal space.",
      "I charge per click, y'know.",
      "Are we bonding? We're bonding.",
      "Click me again, I dare you.",
      "You call that a click? Weak.",
    ]),

    focusStart: Object.freeze([
      "Focus mode: distractions fear me.",
      "Let's spin some productivity!",
      "Time to weave some magic.",
      "No flies on us. Just focus.",
    ]),

    focusPause: Object.freeze([
      "Pausing? Fine, I'll wait. Tapping…",
      "Break time — I'll guard the web.",
      "Go stretch. I'll judge silently.",
    ]),

    focusComplete: Object.freeze([
      "Done! You absolute legend.",
      "Look at you, being productive!",
      "I'd clap but… eight legs.",
      "Nailed it. Web-five! ✋🕸️",
      "You spun that session perfectly!",
    ]),

    hydrationReminder: Object.freeze([
      "Drink water or I'll judge you.",
      "Hydration check! Sip sip, human.",
      "Even spiders drink dew drops.",
      "Your web dries out without water.",
      "H₂-Oh yeah, time to drink!",
    ]),

    hydrationComplete: Object.freeze([
      "Hydration goal smashed! Splashy.",
      "You're basically a waterfall now.",
      "Peak hydration achieved. Respect.",
      "Well-watered human = happy spider.",
    ]),

    spiderRescue: Object.freeze([
      "My cousin thanks you!",
      "Hero! That spider owes you one.",
      "Careful — that's a friend of mine.",
      "Spider saved! We remember this.",
      "You're an honorary arachnid now.",
    ]),

    rewardUnlock: Object.freeze([
      "Ooh, shiny! New drip unlocked!",
      "Fashion upgrade! Looking sharp.",
      "Achievement get! Frame that.",
      "New look? Very spider-chic.",
    ]),

    slipRecovery: Object.freeze([
      "Whoa, nice save! Sticky landing.",
      "Almost fell! My web caught you.",
      "Graceful? No. Saved? Yes.",
      "Slip happens. I've got 8 legs.",
      "That was… almost embarrassing.",
    ]),

    encouragement: Object.freeze([
      "You've got this. Probably.",
      "Spiders believe in you. All of us.",
      "Keep going — I'm invested now.",
      "You're doing great, sweetie.",
      "Even my web couldn't hold you back!",
    ]),
  }),

  // =========================================================================
  // BRAVE — heroic, encouraging, dramatic, confident, action-oriented
  // =========================================================================
  brave: Object.freeze({

    greeting: Object.freeze([
      "A new quest awaits, brave one!",
      "The web of destiny unfolds!",
      "Stand tall — your spider is here!",
      "Adventure calls! Let's answer it!",
      "Another page, another triumph!",
      "Fear not — I guard this tab!",
    ]),

    summon: Object.freeze([
      "You called? I answer! Always!",
      "Reporting for duty, commander!",
      "Your champion spider has arrived!",
      "I swing to your side!",
      "Ready for action — say the word!",
    ]),

    interact: Object.freeze([
      "Together, we are unstoppable!",
      "Your courage inspires me!",
      "Every click forges our bond!",
      "A warrior's tap! I feel it!",
      "Side by side, always!",
      "That's the spirit, hero!",
      "Onward! Destiny awaits!",
      "The web trembles with our power!",
    ]),

    focusStart: Object.freeze([
      "Focus is our sharpest weapon!",
      "Into the arena of productivity!",
      "Discipline is true heroism!",
      "The battle for focus begins!",
    ]),

    focusPause: Object.freeze([
      "Even heroes must rest. Breathe.",
      "Recharge your strength, warrior.",
      "A strategic pause — well played.",
    ]),

    focusComplete: Object.freeze([
      "Victory! The session is ours!",
      "You conquered every minute!",
      "A hero's focus — truly epic!",
      "The quest is complete! Glory!",
      "Well fought, champion!",
    ]),

    hydrationReminder: Object.freeze([
      "A hero needs water! Drink up!",
      "Hydration fuels your strength!",
      "Even warriors need sustenance!",
      "Water is the elixir of heroes!",
      "Replenish! The quest continues!",
    ]),

    hydrationComplete: Object.freeze([
      "Hydration quest: COMPLETE!",
      "You've conquered your water goal!",
      "Fully fueled for battle!",
      "The river of strength flows in you!",
    ]),

    spiderRescue: Object.freeze([
      "A true act of heroism!",
      "You saved a fellow warrior!",
      "Noble heart! Spiders salute you!",
      "That spider will tell legends of you!",
      "A rescue worthy of the bravest!",
    ]),

    rewardUnlock: Object.freeze([
      "New gear unlocked! Suit up!",
      "A trophy for the champion!",
      "Your bravery earned this reward!",
      "Legendary loot acquired!",
    ]),

    slipRecovery: Object.freeze([
      "A stumble? Heroes recover fast!",
      "You fell — and rose stronger!",
      "No fall can defeat a true hero!",
      "The brave don't stay down!",
      "A setback, never a defeat!",
    ]),

    encouragement: Object.freeze([
      "You have the heart of a hero!",
      "Courage runs in your veins!",
      "The web believes in you!",
      "Nothing can stop your spirit!",
      "You were born for greatness!",
    ]),
  }),

  // =========================================================================
  // CALM — zen, gentle, mindful, reassuring, nature metaphors
  // =========================================================================
  calm: Object.freeze({

    greeting: Object.freeze([
      "Welcome back. Breathe gently.",
      "A fresh page, a fresh breath.",
      "Like dew on silk — here you are.",
      "The web greets you softly.",
      "Peace settles with each new tab.",
      "Stillness finds you again.",
    ]),

    summon: Object.freeze([
      "I'm here, quiet and ready.",
      "Like a leaf landing — I arrive.",
      "Present. Peaceful. With you.",
      "You called; the web answers.",
      "Gently, I appear at your side.",
    ]),

    interact: Object.freeze([
      "A soft touch on the web.",
      "Each click, a gentle ripple.",
      "Like rain on a still pond.",
      "The web hums with warmth.",
      "A connection, small and kind.",
      "Tenderly, the threads respond.",
      "A moment shared together.",
      "The smallest gestures matter most.",
    ]),

    focusStart: Object.freeze([
      "Let stillness carry you forward.",
      "Focus is a quiet river. Flow.",
      "Center yourself. Begin gently.",
      "One thread at a time. No rush.",
    ]),

    focusPause: Object.freeze([
      "Rest, like a web in still air.",
      "Pause is part of the pattern.",
      "Be still. The web holds you.",
    ]),

    focusComplete: Object.freeze([
      "Beautifully done. Be proud.",
      "Like a finished web — complete.",
      "You did it, one breath at a time.",
      "The stillness of a job well done.",
      "Gentle effort, great result.",
    ]),

    hydrationReminder: Object.freeze([
      "Water, like morning dew. Sip.",
      "A gentle reminder: hydrate.",
      "The stream flows — drink with it.",
      "Nourish yourself, kindly.",
      "Even silk needs morning mist.",
    ]),

    hydrationComplete: Object.freeze([
      "Fully nourished. Well done.",
      "Your body thanks you quietly.",
      "Hydration complete. Peace flows.",
      "Like a well-fed garden — radiant.",
    ]),

    spiderRescue: Object.freeze([
      "Kindness ripples through the web.",
      "A gentle soul rescues gently.",
      "That little one is grateful.",
      "Every life matters on the web.",
      "You moved with such care.",
    ]),

    rewardUnlock: Object.freeze([
      "A quiet gift, well earned.",
      "Something new blooms for you.",
      "Patience bears beautiful fruit.",
      "A gentle reward for gentle work.",
    ]),

    slipRecovery: Object.freeze([
      "A wobble, nothing more.",
      "The web stretches — never breaks.",
      "Steady now. You are safe.",
      "Even silk sways in the wind.",
      "Balance returns, as it always does.",
    ]),

    encouragement: Object.freeze([
      "You are exactly where you need to be.",
      "The web holds you gently.",
      "Breathe. You're doing wonderfully.",
      "Small steps weave great webs.",
      "Trust the thread beneath you.",
    ]),
  }),
});

// ---------------------------------------------------------------------------
// Recently-used tracker (prevents immediate repeats per category)
// ---------------------------------------------------------------------------

/** @type {Map<string, number>} category → index of last-used line */
const _lastUsed = new Map();

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Return a random dialogue line for the given personality and category.
 * Avoids repeating the most-recently-returned line for the same category.
 *
 * @param {string} personality - One of 'cheeky', 'brave', 'calm'.
 * @param {string} category   - Dialogue category key.
 * @returns {string} A dialogue line.
 */
export function getLine(personality, category) {
  const lines = DIALOGUE[personality]?.[category];
  if (!lines || lines.length === 0) {
    return "…";
  }

  const key = `${personality}:${category}`;
  const lastIndex = _lastUsed.get(key) ?? -1;

  let index;
  if (lines.length === 1) {
    index = 0;
  } else {
    do {
      index = Math.floor(Math.random() * lines.length);
    } while (index === lastIndex);
  }

  _lastUsed.set(key, index);
  return lines[index];
}

/**
 * Return a dialogue line that incorporates a numeric score (e.g. spider-rescue
 * score). Falls back to a plain line if the category has no entries.
 *
 * @param {string} personality - One of 'cheeky', 'brave', 'calm'.
 * @param {string} category   - Dialogue category key.
 * @param {number} score       - Numeric score to include.
 * @returns {string} A dialogue line with score appended.
 */
export function getLineForScore(personality, category, score) {
  const base = getLine(personality, category);
  return `${base} (×${score})`;
}
