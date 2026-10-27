/**
 * @module storage
 * Storage schema, defaults, migrations, and validation for the Webling extension.
 *
 * Provides a single source of truth for all persisted state. Both the
 * background service worker and the popup import this module.
 *
 * Schema version history:
 *   v1 — original keys (enabled, focusMode, personality, spidersEnabled,
 *         hydrationEnabled, mischiefEnabled, hydration, hydrationDate,
 *         spiderScore)
 *   v2 — expanded settings, focus timer, hydration tracking, statistics,
 *         achievements, cosmetics, onboarding
 */

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

/** Current schema version. */
export const SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// Allowed enum values
// ---------------------------------------------------------------------------

const PERSONALITIES   = ['cheeky', 'brave', 'calm'];
const CHARACTER_SIZES = ['tiny', 'mini', 'small', 'medium', 'large'];
const CHARACTERS      = ['webling', 'titan', 'stormbringer', 'classic'];
const POSITIONS       = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const MISHAP_FREQS    = ['off', 'rare', 'normal', 'frequent'];
const FOCUS_STATUSES  = ['idle', 'running', 'paused', 'break'];
const HYDRATION_INTERVALS = [30, 45, 60, 90];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Full defaults object for every stored key. */
export const DEFAULTS = Object.freeze({
  // — Settings —
  enabled:                    true,
  personality:                'cheeky',
  characterSize:              'medium',
  characterPx:                88,
  character:                  'webling',
  squadMode:                  true,
  squadFights:                true,
  startPosition:              'top-right',
  swingToClicks:              false,
  showFocusIndicator:         true,
  showHydrationWidget:        true,
  spidersEnabled:             true,
  showSpeechBubbles:          true,
  quietMode:                  false,
  mishapFrequency:            'normal',
  webLineColor:               '#e8fbff',
  reducedMotion:              false,
  notificationsEnabled:       true,
  hydrationRemindersEnabled:  false,
  hydrationReminderInterval:  60,
  hydrationTarget:            8,
  quietHoursStart:            '22:00',
  quietHoursEnd:              '07:00',
  videoDimming:               false,
  disabledSites:              [],

  // — Focus State —
  focusStatus:                'idle',
  focusDuration:              25,
  focusStartTime:             0,
  focusEndTime:               0,
  focusPausedRemaining:       0,
  focusBreakDuration:         5,
  focusAutoBreak:             true,

  // — Hydration State —
  hydration:                  0,
  hydrationDate:              '',
  hydrationHistory:           [],

  // — Statistics —
  spiderScore:                0,
  focusSessionsCompleted:     0,
  focusTotalMinutes:          0,
  focusLongestSessionMinutes: 0,
  focusCurrentStreak:         0,
  focusBestStreak:            0,
  focusLastSessionDate:       '',
  hydrationCurrentStreak:     0,
  hydrationBestStreak:        0,
  hydrationGoalsCompleted:    0,
  pagesPatrolled:             0,
  patrolledUrls:              {},
  installDate:                '',

  // — Achievements —
  achievements:               {},

  // — Cosmetics —
  cosmeticsUnlocked:          [],
  equippedCosmetics:          {},

  // — Onboarding —
  onboardingComplete:         false,
  schemaVersion:              SCHEMA_VERSION,
});

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Returns today's date as a `YYYY-MM-DD` string in the user's local timezone.
 *
 * @returns {string}
 */
export function todayKey() {
  const d = new Date();
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether the current local time falls within a quiet-hours window.
 *
 * Handles overnight ranges (e.g. 22:00 → 07:00) correctly.
 *
 * @param {string} startStr - Start time in `HH:MM` format.
 * @param {string} endStr   - End time in `HH:MM` format.
 * @returns {boolean}
 */
export function isInQuietHours(startStr, endStr) {
  const toMinutes = (str) => {
    const parts = String(str).split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return -1;
    return h * 60 + m;
  };

  const start = toMinutes(startStr);
  const end   = toMinutes(endStr);
  if (start < 0 || end < 0) return false;

  const now   = new Date();
  const cur   = now.getHours() * 60 + now.getMinutes();

  if (start <= end) {
    // Same-day range (e.g. 09:00 → 17:00)
    return cur >= start && cur < end;
  }
  // Overnight range (e.g. 22:00 → 07:00)
  return cur >= start || cur < end;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates every key in `data` against the schema. Invalid values are
 * silently replaced with their defaults. Missing keys are filled in.
 *
 * This function **never throws**.
 *
 * @param {Record<string, unknown>} data - Raw storage data.
 * @returns {Record<string, unknown>} A new object with all keys valid.
 */
export function validateSettings(data) {
  const safe = { ...DEFAULTS };

  if (!data || typeof data !== 'object') return safe;

  // ---- helpers ----------------------------------------------------------

  const bool = (key) => {
    if (key in data && typeof data[key] === 'boolean') safe[key] = data[key];
  };

  const str = (key) => {
    if (key in data && typeof data[key] === 'string') safe[key] = data[key];
  };

  const enumStr = (key, allowed) => {
    if (key in data && typeof data[key] === 'string' && allowed.includes(data[key])) {
      safe[key] = data[key];
    }
  };

  const num = (key, min = -Infinity, max = Infinity) => {
    if (key in data && typeof data[key] === 'number' && Number.isFinite(data[key])) {
      safe[key] = Math.max(min, Math.min(max, data[key]));
    }
  };

  const enumNum = (key, allowed) => {
    if (key in data && typeof data[key] === 'number' && allowed.includes(data[key])) {
      safe[key] = data[key];
    }
  };

  const arr = (key) => {
    if (key in data && Array.isArray(data[key])) safe[key] = data[key];
  };

  const arrStrings = (key) => {
    if (key in data && Array.isArray(data[key])) {
      safe[key] = data[key].filter((v) => typeof v === 'string');
    }
  };

  const obj = (key) => {
    if (
      key in data &&
      typeof data[key] === 'object' &&
      data[key] !== null &&
      !Array.isArray(data[key])
    ) {
      safe[key] = data[key];
    }
  };

  const hexColor = (key) => {
    if (key in data && typeof data[key] === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(data[key])) {
      safe[key] = data[key];
    }
  };

  const timeStr = (key) => {
    if (key in data && typeof data[key] === 'string' && /^\d{1,2}:\d{2}$/.test(data[key])) {
      safe[key] = data[key];
    }
  };

  // ---- Settings ---------------------------------------------------------

  bool('enabled');
  enumStr('personality', PERSONALITIES);
  enumStr('characterSize', CHARACTER_SIZES);
  num('characterPx', 32, 140);
  if (!('characterPx' in data) && typeof data.characterSize === 'string') {
    // Older installs chose a named size; carry it over to the slider
    const legacy = { tiny: 40, mini: 52, small: 64, medium: 88, large: 112 };
    if (legacy[data.characterSize]) safe.characterPx = legacy[data.characterSize];
  }
  enumStr('character', CHARACTERS);
  bool('squadMode');
  bool('squadFights');
  enumStr('startPosition', POSITIONS);
  bool('swingToClicks');
  bool('showFocusIndicator');
  bool('showHydrationWidget');
  bool('spidersEnabled');
  bool('showSpeechBubbles');
  bool('quietMode');
  enumStr('mishapFrequency', MISHAP_FREQS);
  hexColor('webLineColor');
  bool('reducedMotion');
  bool('notificationsEnabled');
  bool('hydrationRemindersEnabled');
  enumNum('hydrationReminderInterval', HYDRATION_INTERVALS);
  num('hydrationTarget', 4, 12);
  timeStr('quietHoursStart');
  timeStr('quietHoursEnd');
  bool('videoDimming');
  arrStrings('disabledSites');

  // ---- Focus State ------------------------------------------------------

  enumStr('focusStatus', FOCUS_STATUSES);
  num('focusDuration', 1, 240);
  num('focusStartTime', 0, Infinity);
  num('focusEndTime', 0, Infinity);
  num('focusPausedRemaining', 0, Infinity);
  num('focusBreakDuration', 1, 60);
  bool('focusAutoBreak');

  // ---- Hydration State --------------------------------------------------

  num('hydration', 0, 100);
  str('hydrationDate');
  arrStrings('hydrationHistory');

  // ---- Statistics -------------------------------------------------------

  num('spiderScore', 0, Infinity);
  num('focusSessionsCompleted', 0, Infinity);
  num('focusTotalMinutes', 0, Infinity);
  num('focusLongestSessionMinutes', 0, Infinity);
  num('focusCurrentStreak', 0, Infinity);
  num('focusBestStreak', 0, Infinity);
  str('focusLastSessionDate');
  num('hydrationCurrentStreak', 0, Infinity);
  num('hydrationBestStreak', 0, Infinity);
  num('hydrationGoalsCompleted', 0, Infinity);
  num('pagesPatrolled', 0, Infinity);
  obj('patrolledUrls');
  str('installDate');

  // ---- Achievements -----------------------------------------------------

  obj('achievements');

  // ---- Cosmetics --------------------------------------------------------

  arrStrings('cosmeticsUnlocked');
  obj('equippedCosmetics');

  // ---- Onboarding -------------------------------------------------------

  bool('onboardingComplete');
  num('schemaVersion', 1, SCHEMA_VERSION);

  return safe;
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * Checks the stored `schemaVersion` and migrates data forward to the current
 * version when necessary.
 *
 * **v1 → v2 migration:**
 * - Preserves all existing v1 values.
 * - Maps `mischiefEnabled` → `mishapFrequency` ('normal' | 'off').
 * - Maps `focusMode` → `focusStatus` ('running' if truthy, else 'idle').
 * - Maps `hydrationEnabled` → `showHydrationWidget`.
 * - Adds all new v2 keys with their defaults.
 * - Sets `installDate` to today if it was missing.
 * - Sets `schemaVersion` to 2.
 *
 * @returns {Promise<void>}
 */
export async function migrateStorage() {
  let data;
  try {
    data = await chrome.storage.local.get(null);
  } catch {
    return; // nothing to migrate
  }

  if (!data || typeof data !== 'object') return;

  const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 1;

  if (version >= SCHEMA_VERSION) return; // already up to date

  // -- v1 → v2 -----------------------------------------------------------

  if (version < 2) {
    const patch = { ...DEFAULTS };

    // Carry over all v1 keys that still exist in v2
    const v1CarryOver = [
      'enabled', 'personality', 'spidersEnabled',
      'hydration', 'hydrationDate', 'spiderScore',
    ];

    for (const key of v1CarryOver) {
      if (key in data) patch[key] = data[key];
    }

    // Map deprecated keys

    // mischiefEnabled → mishapFrequency
    if ('mischiefEnabled' in data) {
      patch.mishapFrequency = data.mischiefEnabled ? 'normal' : 'off';
    }

    // focusMode → focusStatus
    if ('focusMode' in data) {
      patch.focusStatus = data.focusMode ? 'running' : 'idle';
    }

    // hydrationEnabled → showHydrationWidget
    if ('hydrationEnabled' in data) {
      patch.showHydrationWidget = !!data.hydrationEnabled;
    }

    // Fill install date
    if (!patch.installDate) {
      patch.installDate = todayKey();
    }

    // Stamp version
    patch.schemaVersion = 2;

    // Validate everything before saving
    const validated = validateSettings(patch);

    try {
      await chrome.storage.local.set(validated);
    } catch {
      // Storage write failed — not much we can do, defaults will be used
    }

    // Clean up deprecated v1 keys that no longer exist in the schema
    const deprecatedKeys = ['focusMode', 'mischiefEnabled', 'hydrationEnabled'];
    const toRemove = deprecatedKeys.filter((k) => k in data);
    if (toRemove.length > 0) {
      try {
        await chrome.storage.local.remove(toRemove);
      } catch {
        // best-effort cleanup
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

/**
 * Loads all settings from `chrome.storage.local`, fills missing keys with
 * defaults, validates every value, and repairs anything invalid.
 *
 * @returns {Promise<Record<string, unknown>>} Validated settings object.
 */
export async function loadSettings() {
  let raw;
  try {
    raw = await chrome.storage.local.get(null);
  } catch {
    raw = {};
  }

  return validateSettings(raw);
}

/**
 * Merges `partial` into existing storage. Only the supplied keys are
 * overwritten; the rest remain untouched.
 *
 * The merged result is validated before being persisted.
 *
 * @param {Record<string, unknown>} partial - Subset of settings to update.
 * @returns {Promise<void>}
 */
export async function saveSettings(partial) {
  if (!partial || typeof partial !== 'object') return;

  let existing;
  try {
    existing = await chrome.storage.local.get(null);
  } catch {
    existing = {};
  }

  const merged    = { ...existing, ...partial };
  const validated = validateSettings(merged);

  try {
    await chrome.storage.local.set(validated);
  } catch {
    // Storage write failed — caller can retry
  }
}
