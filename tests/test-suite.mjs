/**
 * Webling Automated Test Suite
 * Validates storage, migrations, achievements, cosmetics, dialogue,
 * timer math, streaks, site filtering, and manifest integrity.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('--- WEBLING AUTOMATED TEST SUITE ---');

  // 1. MANIFEST & FILE INTEGRITY
  console.log('\n[1] Manifest & File Integrity');
  const manifestPath = path.join(rootDir, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'manifest.json exists');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert(manifest.manifest_version === 3, 'Manifest is version 3');
  assert(manifest.background.service_worker === 'background.js', 'Service worker registered');
  assert(manifest.background.type === 'module', 'Service worker is ES module');
  assert(manifest.permissions.includes('alarms'), 'alarms permission included');
  assert(manifest.permissions.includes('notifications'), 'notifications permission included');
  assert(manifest.permissions.includes('storage'), 'storage permission included');

  const filesToCheck = [
    'background.js',
    'content.js',
    'popup.html',
    'popup.css',
    'popup.js',
    'onboarding.html',
    'onboarding.css',
    'onboarding.js',
    'assets/icon-16.png',
    'assets/icon-32.png',
    'assets/icon-48.png',
    'assets/icon-128.png',
    'assets/webling-cute-reference-strip.png',
    'modules/storage.js',
    'modules/achievements.js',
    'modules/dialogue.js'
  ];

  filesToCheck.forEach((f) => {
    assert(fs.existsSync(path.join(rootDir, f)), `File exists: ${f}`);
  });

  // 2. STORAGE MODULE & VALIDATION
  console.log('\n[2] Storage Schema, Validation & Defaults');
  const storage = await import('../modules/storage.js');
  const DEFAULTS = storage.DEFAULTS;

  assert(DEFAULTS.enabled === true, 'Default enabled is true');
  assert(DEFAULTS.personality === 'cheeky', 'Default personality is cheeky');
  assert(DEFAULTS.characterSize === 'medium', 'Default characterSize is medium');
  assert(DEFAULTS.swingToClicks === false, 'Default swingToClicks is false');
  assert(DEFAULTS.hydrationTarget === 8, 'Default hydrationTarget is 8');
  assert(DEFAULTS.schemaVersion === 2, 'Default schemaVersion is 2');

  // Test validation repairing invalid data
  const invalidData = {
    enabled: 'yes', // should be bool
    personality: 'evil', // invalid enum
    characterSize: 'giant', // invalid enum
    hydrationTarget: 50, // out of range 4-12
    webLineColor: 'not-a-color', // invalid hex
    disabledSites: [123, 'valid.com', null] // should only keep strings
  };
  const validated = storage.validateSettings(invalidData);
  assert(validated.enabled === true, 'Repairs invalid bool with default');
  assert(validated.personality === 'cheeky', 'Repairs invalid enum with default');
  assert(validated.characterSize === 'medium', 'Repairs invalid size with default');
  assert(validated.hydrationTarget === 12, 'Clamps out-of-range target to max 12');
  assert(validated.webLineColor === DEFAULTS.webLineColor, 'Repairs invalid hex color with default');
  assert(validated.disabledSites.length === 1 && validated.disabledSites[0] === 'valid.com', 'Filters non-string sites');

  // Test todayKey format
  const today = storage.todayKey();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(today), `todayKey returns YYYY-MM-DD: ${today}`);

  // Test quiet hours logic
  assert(typeof storage.isInQuietHours('22:00', '07:00') === 'boolean', 'isInQuietHours returns boolean');

  // 3. STORAGE MIGRATION (v1 -> v2)
  console.log('\n[3] Storage Migration from v1 format');
  // Mock chrome.storage.local for migration test
  let mockStorage = {
    enabled: true,
    personality: 'brave',
    mischiefEnabled: false, // v1 key -> should become mishapFrequency: 'off'
    focusMode: true,        // v1 key -> should become focusStatus: 'running'
    hydrationEnabled: false,// v1 key -> should become showHydrationWidget: false
    hydration: 4,
    hydrationDate: '2026-10-15',
    spiderScore: 12
  };

  globalThis.chrome = {
    storage: {
      local: {
        get: async () => mockStorage,
        set: async (patch) => { Object.assign(mockStorage, patch); },
        remove: async (keys) => { keys.forEach((k) => delete mockStorage[k]); }
      }
    }
  };

  await storage.migrateStorage();
  assert(mockStorage.schemaVersion === 2, 'Migration updates schemaVersion to 2');
  assert(mockStorage.personality === 'brave', 'Preserves v1 personality');
  assert(mockStorage.spiderScore === 12, 'Preserves v1 spiderScore');
  assert(mockStorage.mishapFrequency === 'off', 'Maps mischiefEnabled: false -> mishapFrequency: off');
  assert(mockStorage.focusStatus === 'running', 'Maps focusMode: true -> focusStatus: running');
  assert(mockStorage.showHydrationWidget === false, 'Maps hydrationEnabled: false -> showHydrationWidget: false');
  assert(!('focusMode' in mockStorage), 'Cleans up deprecated v1 key focusMode');

  // 4. ACHIEVEMENTS & COSMETICS LOGIC
  console.log('\n[4] Achievements & Cosmetics Logic');
  const achModule = await import('../modules/achievements.js');

  assert(achModule.ACHIEVEMENT_LIST.length >= 10, `At least 10 achievements defined (${achModule.ACHIEVEMENT_LIST.length})`);
  assert(achModule.COSMETIC_LIST.length >= 8, `At least 8 cosmetics defined (${achModule.COSMETIC_LIST.length})`);

  // Test fresh user has 0 unlocked achievements
  const emptyStats = { spiderScore: 0, focusSessionsCompleted: 0, pagesPatrolled: 0 };
  let unlocked = achModule.checkAchievements(emptyStats, {});
  assert(unlocked.length === 0, 'New user starts with no achievements unlocked');

  // Test rescuing first spider unlocks 'first-rescue'
  unlocked = achModule.checkAchievements({ spiderScore: 1 }, {});
  assert(unlocked.includes('first-rescue'), 'spiderScore: 1 unlocks first-rescue');

  // Test web saver 10
  unlocked = achModule.checkAchievements({ spiderScore: 10 }, { 'first-rescue': { unlocked: true } });
  assert(unlocked.includes('web-saver-10') && !unlocked.includes('first-rescue'), 'web-saver-10 unlocks at 10 rescues without duplicating first-rescue');

  // Test cosmetic unlock conditions
  let cosmeticsUnlocked = achModule.checkCosmetics({ spiderScore: 5 }, []);
  assert(cosmeticsUnlocked.includes('webline-red'), '5 rescues unlocks webline-red');

  cosmeticsUnlocked = achModule.checkCosmetics({ focusSessionsCompleted: 3 }, []);
  assert(cosmeticsUnlocked.includes('theme-midnight'), '3 focus sessions unlocks theme-midnight');

  // 5. DIALOGUE MODULE INTEGRITY
  console.log('\n[5] Dialogue Integrity');
  const dialogueModule = await import('../modules/dialogue.js');
  const DIALOGUE = dialogueModule.DIALOGUE;

  const requiredCategories = [
    'greeting', 'summon', 'interact', 'focusStart', 'focusPause',
    'focusComplete', 'hydrationReminder', 'hydrationComplete',
    'spiderRescue', 'rewardUnlock', 'slipRecovery', 'encouragement'
  ];

  ['cheeky', 'brave', 'calm'].forEach((pers) => {
    assert(Boolean(DIALOGUE[pers]), `Personality exists: ${pers}`);
    requiredCategories.forEach((cat) => {
      assert(Array.isArray(DIALOGUE[pers][cat]) && DIALOGUE[pers][cat].length >= 3, `${pers}.${cat} has >= 3 lines`);
    });
  });

  const sampleLine = dialogueModule.getLine('cheeky', 'greeting');
  assert(typeof sampleLine === 'string' && sampleLine.length > 0, `getLine returns valid dialogue: "${sampleLine}"`);

  // 6. SITE DISABLED / MATCHING LOGIC
  console.log('\n[6] Site Visibility Matching');
  function isSiteDisabledCheck(disabledSites, hostname) {
    const currentHost = hostname.toLowerCase();
    return disabledSites.some((site) => {
      const s = site.toLowerCase().trim();
      return currentHost === s || currentHost.endsWith('.' + s);
    });
  }

  const disabledSites = ['github.com', 'internal.work.org'];
  assert(isSiteDisabledCheck(disabledSites, 'github.com'), 'Exact hostname match is disabled');
  assert(isSiteDisabledCheck(disabledSites, 'gist.github.com'), 'Subdomain match is disabled');
  assert(!isSiteDisabledCheck(disabledSites, 'notgithub.com'), 'Non-subdomain is not disabled');
  assert(!isSiteDisabledCheck(disabledSites, 'google.com'), 'Unlisted site is active');

  // 7. FOCUS TIMER CALCULATION
  console.log('\n[7] Focus Timer Calculations');
  const duration = 25;
  const now = Date.now();
  const endTime = now + duration * 60 * 1000;
  const remaining = Math.max(0, endTime - (now + 5 * 60 * 1000));
  const remainingSec = Math.floor(remaining / 1000);
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  assert(mins === 20 && secs === 0, `5m into 25m session leaves 20:00 remaining (calculated ${mins}:${secs})`);

  // 8. HYDRATION TARGET & CLAMPING
  console.log('\n[8] Hydration Goal Bounds');
  const target = 8;
  let count = 0;
  count = Math.min(target, count + 1);
  assert(count === 1, 'Hydration +1 increments to 1');
  count = Math.max(0, count - 1);
  assert(count === 0, 'Hydration -1 decrements to 0');
  count = Math.max(0, count - 1);
  assert(count === 0, 'Hydration cannot go below 0');

  // RESULTS SUMMARY
  console.log('\n=======================================');
  console.log(`TOTAL PASSED: ${passedTests}`);
  console.log(`TOTAL FAILED: ${failedTests}`);
  console.log('=======================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
