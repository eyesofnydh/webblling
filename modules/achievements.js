/**
 * achievements.js — Achievements & Cosmetics Definitions
 *
 * Pure data + logic module for the Webling browser extension.
 * No DOM access, no async, no side effects.
 * All check functions are pure: (stats) => boolean.
 */

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Safely read a numeric stat, defaulting to 0 if missing/undefined.
 * @param {object} stats - The stats object.
 * @param {string} key   - Property name.
 * @returns {number}
 */
function num(stats, key) {
  const v = stats?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Calculate whole days elapsed since a given ISO-date string.
 * Returns 0 when the date is missing or unparseable.
 * @param {string|undefined} isoDate
 * @returns {number}
 */
function daysSince(isoDate) {
  if (!isoDate) return 0;
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 0;
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}

/* ------------------------------------------------------------------ */
/*  Achievements                                                      */
/* ------------------------------------------------------------------ */

/**
 * @typedef {object} Achievement
 * @property {string}   id          - Stable internal identifier.
 * @property {string}   name        - Human-readable display name.
 * @property {string}   description - How to unlock.
 * @property {string}   icon        - Emoji / text icon.
 * @property {string}   category    - 'rescue' | 'focus' | 'hydration' | 'general'
 * @property {function} check       - (stats: object) => boolean
 */

/** @type {Achievement[]} */
const ACHIEVEMENT_LIST = [
  {
    id: 'first-swing',
    name: 'First Swing',
    description: 'Summon Webling for the first time',
    icon: '🕸️',
    category: 'general',
    check: (stats) => num(stats, 'pagesPatrolled') >= 1,
  },
  {
    id: 'first-rescue',
    name: 'First Rescue',
    description: 'Rescue your first tiny spider',
    icon: '🕷️',
    category: 'rescue',
    check: (stats) => num(stats, 'spiderScore') >= 1,
  },
  {
    id: 'web-saver-10',
    name: 'Web Saver',
    description: 'Rescue 10 tiny spiders',
    icon: '🛡️',
    category: 'rescue',
    check: (stats) => num(stats, 'spiderScore') >= 10,
  },
  {
    id: 'web-saver-50',
    name: 'Arachnid Ally',
    description: 'Rescue 50 tiny spiders',
    icon: '🤝',
    category: 'rescue',
    check: (stats) => num(stats, 'spiderScore') >= 50,
  },
  {
    id: 'centurion',
    name: 'Centurion',
    description: 'Rescue 100 tiny spiders',
    icon: '💯',
    category: 'rescue',
    check: (stats) => num(stats, 'spiderScore') >= 100,
  },
  {
    id: 'first-focus',
    name: 'First Focus',
    description: 'Complete your first focus session',
    icon: '🎯',
    category: 'focus',
    check: (stats) => num(stats, 'focusSessionsCompleted') >= 1,
  },
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    description: 'Complete a 45-minute or longer session',
    icon: '🧘',
    category: 'focus',
    check: (stats) => num(stats, 'focusLongestSessionMinutes') >= 45,
  },
  {
    id: 'focus-streak-3',
    name: 'Focus Streak',
    description: 'Complete focus sessions 3 days in a row',
    icon: '🔥',
    category: 'focus',
    check: (stats) => num(stats, 'focusCurrentStreak') >= 3,
  },
  {
    id: 'hydration-hero',
    name: 'Hydration Hero',
    description: 'Complete your daily water goal',
    icon: '💧',
    category: 'hydration',
    check: (stats) => num(stats, 'hydrationGoalsCompleted') >= 1,
  },
  {
    id: 'hydration-streak-3',
    name: 'Three-Day Streak',
    description: 'Meet your water goal 3 days in a row',
    icon: '🌊',
    category: 'hydration',
    check: (stats) => num(stats, 'hydrationCurrentStreak') >= 3,
  },
  {
    id: 'hydration-streak-7',
    name: 'Week of Water',
    description: 'Meet your water goal 7 days in a row',
    icon: '🏆',
    category: 'hydration',
    check: (stats) => num(stats, 'hydrationCurrentStreak') >= 7,
  },
  {
    id: 'veteran',
    name: 'Veteran Webling',
    description: 'Use Webling for 7 days',
    icon: '⭐',
    category: 'general',
    check: (stats) => daysSince(stats?.installDate) >= 7,
  },
];

/* ------------------------------------------------------------------ */
/*  Cosmetics                                                         */
/* ------------------------------------------------------------------ */

/**
 * @typedef {object} Cosmetic
 * @property {string}          id                - Stable internal identifier.
 * @property {string}          name              - Human-readable display name.
 * @property {string}          description       - Short description.
 * @property {string}          category          - 'webline' | 'theme' | 'bubble' | 'badge' | 'effect'
 * @property {string}          icon              - Emoji / text icon.
 * @property {string}          unlockRequirement - Human-readable unlock condition.
 * @property {function}        check             - (stats: object) => boolean
 * @property {string|object}   cssValue          - CSS value(s) to apply.
 */

/** @type {Cosmetic[]} */
const COSMETIC_LIST = [
  {
    id: 'webline-red',
    name: 'Crimson Thread',
    description: 'A striking red web line',
    category: 'webline',
    icon: '🔴',
    unlockRequirement: 'Rescue 5 tiny spiders',
    check: (stats) => num(stats, 'spiderScore') >= 5,
    cssValue: '#dc2626',
  },
  {
    id: 'webline-gold',
    name: 'Golden Strand',
    description: 'A shimmering gold web line',
    category: 'webline',
    icon: '🟡',
    unlockRequirement: 'Rescue 25 tiny spiders',
    check: (stats) => num(stats, 'spiderScore') >= 25,
    cssValue: '#f59e0b',
  },
  {
    id: 'webline-rainbow',
    name: 'Prismatic Web',
    description: 'A dazzling rainbow gradient web line',
    category: 'webline',
    icon: '🌈',
    unlockRequirement: 'Rescue 50 tiny spiders',
    check: (stats) => num(stats, 'spiderScore') >= 50,
    cssValue: 'linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7)',
  },
  {
    id: 'theme-midnight',
    name: 'Midnight',
    description: 'A cool dark-blue filter on Webling',
    category: 'theme',
    icon: '🌙',
    unlockRequirement: 'Complete 3 focus sessions',
    check: (stats) => num(stats, 'focusSessionsCompleted') >= 3,
    cssValue: {
      filter: 'hue-rotate(200deg) brightness(0.85)',
      accent: '#4338ca',
    },
  },
  {
    id: 'theme-sunset',
    name: 'Sunset Glow',
    description: 'A warm sunset filter on Webling',
    category: 'theme',
    icon: '🌅',
    unlockRequirement: 'Complete 10 focus sessions',
    check: (stats) => num(stats, 'focusSessionsCompleted') >= 10,
    cssValue: {
      filter: 'sepia(0.3) saturate(1.4) hue-rotate(-10deg)',
      accent: '#ea580c',
    },
  },
  {
    id: 'bubble-pixel',
    name: 'Pixel Talk',
    description: 'A pixelated retro-style speech bubble border',
    category: 'bubble',
    icon: '👾',
    unlockRequirement: 'Complete your first daily water goal',
    check: (stats) => num(stats, 'hydrationGoalsCompleted') >= 1,
    cssValue: {
      borderImageSource: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\'%3E%3Crect x=\'0\' y=\'0\' width=\'4\' height=\'4\' fill=\'%23333\'/%3E%3Crect x=\'4\' y=\'4\' width=\'4\' height=\'4\' fill=\'%23333\'/%3E%3Crect x=\'8\' y=\'8\' width=\'4\' height=\'4\' fill=\'%23333\'/%3E%3C/svg%3E")',
      borderImageSlice: '4',
      borderWidth: '4px',
      borderStyle: 'solid',
      imageRendering: 'pixelated',
    },
  },
  {
    id: 'badge-star',
    name: 'Gold Star',
    description: 'A small gold star badge for Webling',
    category: 'badge',
    icon: '⭐',
    unlockRequirement: 'Achieve a 3-day focus streak',
    check: (stats) => num(stats, 'focusCurrentStreak') >= 3,
    cssValue: {
      content: '"⭐"',
      position: 'absolute',
      fontSize: '14px',
      top: '-6px',
      right: '-6px',
    },
  },
  {
    id: 'badge-crown',
    name: 'Crown',
    description: 'A regal crown badge for Webling',
    category: 'badge',
    icon: '👑',
    unlockRequirement: 'Earn the Veteran Webling achievement',
    check: (stats) => daysSince(stats?.installDate) >= 7,
    cssValue: {
      content: '"👑"',
      position: 'absolute',
      fontSize: '16px',
      top: '-10px',
      left: '50%',
      transform: 'translateX(-50%)',
    },
  },
  {
    id: 'effect-sparkle',
    name: 'Sparkle Landing',
    description: 'Sparkle particles when Webling completes a swing',
    category: 'effect',
    icon: '✨',
    unlockRequirement: 'Rescue 100 tiny spiders',
    check: (stats) => num(stats, 'spiderScore') >= 100,
    cssValue: {
      animationName: 'webling-sparkle',
      animationDuration: '0.6s',
      animationTimingFunction: 'ease-out',
      animationFillMode: 'forwards',
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Lookup helpers                                                    */
/* ------------------------------------------------------------------ */

/** @type {Map<string, Achievement>} */
const achievementMap = new Map(ACHIEVEMENT_LIST.map((a) => [a.id, a]));

/** @type {Map<string, Cosmetic>} */
const cosmeticMap = new Map(COSMETIC_LIST.map((c) => [c.id, c]));

/**
 * Look up an achievement definition by its ID.
 * @param {string} id
 * @returns {Achievement|undefined}
 */
function getAchievement(id) {
  return achievementMap.get(id);
}

/**
 * Look up a cosmetic definition by its ID.
 * @param {string} id
 * @returns {Cosmetic|undefined}
 */
function getCosmetic(id) {
  return cosmeticMap.get(id);
}

/* ------------------------------------------------------------------ */
/*  Unlock checkers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Evaluate all achievements against the current stats and return an
 * array of achievement IDs that are newly unlocked (i.e. not already
 * present in `currentAchievements`).
 *
 * @param {object}   stats               - Player / extension stats.
 * @param {string[]} currentAchievements - Already-unlocked achievement IDs.
 * @returns {string[]} Newly unlocked achievement IDs.
 */
function checkAchievements(stats, currentAchievements) {
  let already;
  if (Array.isArray(currentAchievements)) {
    already = new Set(currentAchievements);
  } else if (currentAchievements && typeof currentAchievements === 'object') {
    already = new Set(
      Object.keys(currentAchievements).filter(
        (k) => currentAchievements[k]?.unlocked || currentAchievements[k] === true
      )
    );
  } else {
    already = new Set();
  }
  const safeStats = stats ?? {};
  const newlyUnlocked = [];

  for (const achievement of ACHIEVEMENT_LIST) {
    if (already.has(achievement.id)) continue;
    try {
      if (achievement.check(safeStats)) {
        newlyUnlocked.push(achievement.id);
      }
    } catch {
      /* check functions should never throw, but guard anyway */
    }
  }

  return newlyUnlocked;
}

/**
 * Evaluate all cosmetics against the current stats and return an
 * array of cosmetic IDs that are newly unlocked (i.e. not already
 * present in `currentUnlocked`).
 *
 * @param {object}   stats           - Player / extension stats.
 * @param {string[]} currentUnlocked - Already-unlocked cosmetic IDs.
 * @returns {string[]} Newly unlocked cosmetic IDs.
 */
function checkCosmetics(stats, currentUnlocked) {
  const already = new Set(Array.isArray(currentUnlocked) ? currentUnlocked : []);
  const safeStats = stats ?? {};
  const newlyUnlocked = [];

  for (const cosmetic of COSMETIC_LIST) {
    if (already.has(cosmetic.id)) continue;
    try {
      if (cosmetic.check(safeStats)) {
        newlyUnlocked.push(cosmetic.id);
      }
    } catch {
      /* check functions should never throw, but guard anyway */
    }
  }

  return newlyUnlocked;
}

/* ------------------------------------------------------------------ */
/*  Exports                                                           */
/* ------------------------------------------------------------------ */

export {
  ACHIEVEMENT_LIST,
  COSMETIC_LIST,
  getAchievement,
  getCosmetic,
  checkAchievements,
  checkCosmetics,
};
