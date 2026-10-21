/**
 * Webling Extension Popup
 * Interacts with background service worker and content script.
 */

import {
  DEFAULTS,
  loadSettings,
  saveSettings,
  todayKey
} from './modules/storage.js';

import {
  ACHIEVEMENT_LIST,
  COSMETIC_LIST,
  getAchievement,
  getCosmetic
} from './modules/achievements.js';

const $ = (id) => document.getElementById(id);

let state = { ...DEFAULTS };
let currentTab = null;
let currentHostname = '';
let isSupportedTab = false;
let timerInterval = 0;
let selectedPresetMinutes = 25;

// ---------------------------------------------------------------------------
// Tab Navigation
// ---------------------------------------------------------------------------

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-content');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');

      tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach((p) => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const targetPanel = $(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Active Tab Detection & Stats
// ---------------------------------------------------------------------------

async function checkActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    if (!tab?.url) {
      showUnsupportedPage('No active webpage');
      return;
    }

    if (!/^(https?|file):\/\//.test(tab.url)) {
      showUnsupportedPage('Restricted browser page');
      return;
    }

    try {
      const url = new URL(tab.url);
      currentHostname = url.hostname;
      isSupportedTab = true;
      $('currentHostname').textContent = currentHostname || 'Local File';
      updateStatusUI();
      fetchPageStats();
    } catch {
      showUnsupportedPage('Unsupported address');
    }
  } catch (err) {
    showUnsupportedPage('Page unavailable');
  }
}

function showUnsupportedPage(reason) {
  isSupportedTab = false;
  $('statusPulse').className = 'pulse inactive';
  $('statusTitle').textContent = reason;
  $('statusText').textContent = 'Webling cannot patrol internal or restricted browser pages.';
  $('currentHostname').textContent = 'Protected page';
  $('siteToggleBtn').disabled = true;
  $('siteToggleBtn').textContent = 'Unavailable';
}

async function fetchPageStats() {
  if (!isSupportedTab || !currentTab?.id) return;

  try {
    const stats = await chrome.tabs.sendMessage(currentTab.id, { type: 'WEBLING_STATS' });
    if (stats) {
      $('wordCount').textContent = (stats.words || 0).toLocaleString();
      $('readTime').textContent = stats.minutes || 0;
      $('linkCount').textContent = (stats.links || 0).toLocaleString();
      $('headingCount').textContent = (stats.headings || 0).toLocaleString();
      $('imageCount').textContent = (stats.images || 0).toLocaleString();
    }
  } catch {
    $('wordCount').textContent = '—';
    $('readTime').textContent = '—';
    $('linkCount').textContent = '—';
    $('headingCount').textContent = '—';
    $('imageCount').textContent = '—';
  }
}

// ---------------------------------------------------------------------------
// Status Card UI
// ---------------------------------------------------------------------------

function updateStatusUI() {
  if (!isSupportedTab) return;

  const isGloballyDisabled = !state.enabled;
  const isSiteDisabled = Array.isArray(state.disabledSites) && state.disabledSites.includes(currentHostname);

  const pulse = $('statusPulse');
  const title = $('statusTitle');
  const text = $('statusText');
  const siteBtn = $('siteToggleBtn');

  siteBtn.disabled = false;

  if (isGloballyDisabled) {
    pulse.className = 'pulse inactive';
    title.textContent = 'Webling is resting';
    text.textContent = 'Turn on the switch above to send Webling on patrol.';
    siteBtn.textContent = 'Disabled globally';
    siteBtn.disabled = true;
  } else if (isSiteDisabled) {
    pulse.className = 'pulse warning';
    title.textContent = `Sleeping on ${currentHostname}`;
    text.textContent = 'Webling is disabled on this site.';
    siteBtn.textContent = 'Enable on site';
  } else if (state.focusStatus === 'running') {
    pulse.className = 'pulse';
    title.textContent = 'Focus patrol active';
    text.textContent = 'Guarding your deep work on this tab.';
    siteBtn.textContent = 'Disable on site';
  } else {
    pulse.className = 'pulse';
    title.textContent = `Patrolling ${currentHostname}`;
    text.textContent = 'Everything looks web-tastic.';
    siteBtn.textContent = 'Disable on site';
  }
}

// ---------------------------------------------------------------------------
// Hydration UI
// ---------------------------------------------------------------------------

function updateHydrationUI() {
  const target = state.hydrationTarget || 8;
  const today = todayKey();
  const current = state.hydrationDate === today ? state.hydration : 0;

  $('waterStatus').textContent = current >= target
    ? 'Daily mission complete! 💧'
    : `${current} of ${target} glasses today`;

  const pct = Math.min(100, Math.round((current / target) * 100));
  $('waterBar').style.width = `${pct}%`;
}

// ---------------------------------------------------------------------------
// Focus Timer UI
// ---------------------------------------------------------------------------

function updateFocusUI() {
  clearInterval(timerInterval);

  const status = state.focusStatus || 'idle';
  const badge = $('focusStatusBadge');
  const digits = $('timerDigits');
  const fill = $('timerProgressFill');

  const startBtn = $('focusStartBtn');
  const pauseBtn = $('focusPauseBtn');
  const resumeBtn = $('focusResumeBtn');
  const resetBtn = $('focusResetBtn');
  const quickBtn = $('quickFocusBtn');
  const quickStatus = $('quickFocusStatus');

  badge.textContent = status.toUpperCase();

  if (status === 'running') {
    startBtn.classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    resumeBtn.classList.add('hidden');
    resetBtn.classList.remove('hidden');

    quickBtn.textContent = 'Pause Focus';
    quickBtn.className = 'btn-sm btn-secondary';
    quickStatus.textContent = 'Focus session in progress';

    const tick = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, state.focusEndTime - now);
      const totalSec = Math.floor(remainingMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      digits.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      const totalDurationMs = (state.focusDuration || 25) * 60 * 1000;
      const elapsedMs = totalDurationMs - remainingMs;
      const pct = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));
      fill.style.width = `${pct}%`;

      if (remainingMs <= 0) {
        clearInterval(timerInterval);
      }
    };
    tick();
    timerInterval = setInterval(tick, 1000);

  } else if (status === 'paused') {
    startBtn.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.remove('hidden');
    resetBtn.classList.remove('hidden');

    quickBtn.textContent = 'Resume Focus';
    quickBtn.className = 'btn-sm btn-primary';
    quickStatus.textContent = 'Focus paused';

    const remainingMs = state.focusPausedRemaining || 0;
    const totalSec = Math.floor(remainingMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    digits.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const totalDurationMs = (state.focusDuration || 25) * 60 * 1000;
    const elapsedMs = totalDurationMs - remainingMs;
    const pct = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));
    fill.style.width = `${pct}%`;

  } else if (status === 'break') {
    startBtn.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
    resetBtn.classList.remove('hidden');

    quickBtn.textContent = 'Break Time';
    quickBtn.className = 'btn-sm btn-secondary';
    quickStatus.textContent = 'Enjoy your break!';

    const tick = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, state.focusEndTime - now);
      const totalSec = Math.floor(remainingMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      digits.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    tick();
    timerInterval = setInterval(tick, 1000);

  } else {
    // Idle
    startBtn.classList.remove('hidden');
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');

    quickBtn.textContent = `Start (${selectedPresetMinutes}m)`;
    quickBtn.className = 'btn-sm btn-primary';
    quickStatus.textContent = 'Ready for deep work';

    digits.textContent = `${String(selectedPresetMinutes).padStart(2, '0')}:00`;
    fill.style.width = '0%';
  }
}

// ---------------------------------------------------------------------------
// Career Progress & Achievements UI
// ---------------------------------------------------------------------------

function updateProgressUI() {
  $('statSpiders').textContent = state.spiderScore || 0;
  $('statSessions').textContent = state.focusSessionsCompleted || 0;
  $('statMinutes').textContent = state.focusTotalMinutes || 0;
  $('statFocusStreak').textContent = state.focusCurrentStreak || 0;
  $('statWaterGoals').textContent = state.hydrationGoalsCompleted || 0;
  $('statWaterStreak').textContent = state.hydrationCurrentStreak || 0;

  const userAchievements = state.achievements || {};
  const unlockedCount = Object.keys(userAchievements).filter((k) => userAchievements[k]?.unlocked).length;
  $('achProgressCount').textContent = `${unlockedCount}/${ACHIEVEMENT_LIST.length}`;

  const listContainer = $('achievementsList');
  listContainer.innerHTML = '';

  ACHIEVEMENT_LIST.forEach((ach) => {
    const isUnlocked = Boolean(userAchievements[ach.id]?.unlocked);
    const unlockDate = userAchievements[ach.id]?.date || '';

    const item = document.createElement('div');
    item.className = `ach-item ${isUnlocked ? 'unlocked' : 'locked'}`;

    item.innerHTML = `
      <span class="ach-icon" aria-hidden="true">${ach.icon || '🏆'}</span>
      <div class="ach-details">
        <div class="ach-name">
          <span>${ach.name}</span>
          ${isUnlocked && unlockDate ? `<span class="ach-date">(${unlockDate})</span>` : ''}
        </div>
        <span class="ach-desc">${ach.description}</span>
      </div>
      <span class="ach-status">${isUnlocked ? '✓' : '🔒'}</span>
    `;
    listContainer.appendChild(item);
  });
}

// ---------------------------------------------------------------------------
// Cosmetics Rewards UI
// ---------------------------------------------------------------------------

function updateCosmeticsUI() {
  const listContainer = $('cosmeticsList');
  listContainer.innerHTML = '';

  const unlockedList = Array.isArray(state.cosmeticsUnlocked) ? state.cosmeticsUnlocked : [];
  const equippedMap = state.equippedCosmetics || {};

  COSMETIC_LIST.forEach((cos) => {
    const isUnlocked = unlockedList.includes(cos.id);
    const isEquipped = equippedMap[cos.category] === cos.id;

    const item = document.createElement('div');
    item.className = `cos-item ${isEquipped ? 'equipped' : ''}`;

    let buttonHtml = '';
    if (!isUnlocked) {
      buttonHtml = `<button class="cos-btn locked" disabled title="${cos.unlockRequirement}">Locked</button>`;
    } else if (isEquipped) {
      buttonHtml = `<button class="cos-btn btn-primary" disabled>Equipped</button>`;
    } else {
      buttonHtml = `<button class="cos-btn btn-secondary equip-btn" data-category="${cos.category}" data-id="${cos.id}">Equip</button>`;
    }

    item.innerHTML = `
      <span class="cos-icon" aria-hidden="true">${cos.icon || '🎁'}</span>
      <div class="cos-details">
        <span class="cos-name">${cos.name}</span>
        <span class="cos-desc">${isUnlocked ? cos.description : cos.unlockRequirement}</span>
      </div>
      ${buttonHtml}
    `;

    listContainer.appendChild(item);
  });

  // Attach equip listeners
  listContainer.querySelectorAll('.equip-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const category = btn.getAttribute('data-category');
      const cosmeticId = btn.getAttribute('data-id');
      const resp = await chrome.runtime.sendMessage({
        type: 'EQUIP_COSMETIC',
        category,
        cosmeticId
      });
      if (resp?.success) {
        state.equippedCosmetics = resp.equippedCosmetics;
        updateCosmeticsUI();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Settings Controls Binding
// ---------------------------------------------------------------------------

function syncControlsFromState() {
  $('globalEnabled').checked = Boolean(state.enabled);

  // Customize dropdowns
  $('personalitySelect').value = state.personality || 'cheeky';
  $('charSizeSelect').value = state.characterSize || 'medium';
  $('startPosSelect').value = state.startPosition || 'top-right';
  $('webLineColor').value = state.webLineColor || '#e8fbff';

  // Companion Switches
  $('spidersEnabled').checked = Boolean(state.spidersEnabled);
  $('showHydrationWidget').checked = Boolean(state.showHydrationWidget);
  $('showFocusIndicator').checked = Boolean(state.showFocusIndicator);
  $('showSpeechBubbles').checked = Boolean(state.showSpeechBubbles);
  $('quietMode').checked = Boolean(state.quietMode);
  $('swingToClicks').checked = Boolean(state.swingToClicks);
  $('reducedMotion').checked = Boolean(state.reducedMotion);
  $('mishapFreqSelect').value = state.mishapFrequency || 'normal';

  // Focus & Video Dimming
  $('focusAutoBreak').checked = Boolean(state.focusAutoBreak);
  $('videoDimming').checked = Boolean(state.videoDimming);

  // Reminders & Goals
  $('notificationsEnabled').checked = Boolean(state.notificationsEnabled);
  $('hydrationRemindersEnabled').checked = Boolean(state.hydrationRemindersEnabled);
  $('reminderIntervalSelect').value = String(state.hydrationReminderInterval || 60);
  $('hydrationTargetSelect').value = String(state.hydrationTarget || 8);

  updateStatusUI();
  updateHydrationUI();
  updateFocusUI();
  updateProgressUI();
  updateCosmeticsUI();
}

async function updateSetting(key, value) {
  state[key] = value;
  await chrome.runtime.sendMessage({
    type: 'UPDATE_SETTING',
    key,
    value
  });
}

function bindControls() {
  // Global Enable
  $('globalEnabled').addEventListener('change', async (e) => {
    await updateSetting('enabled', e.target.checked);
    updateStatusUI();
  });

  // Site Enable / Disable
  $('siteToggleBtn').addEventListener('click', async () => {
    if (!isSupportedTab || !currentHostname) return;
    const isCurrentlyDisabled = Array.isArray(state.disabledSites) && state.disabledSites.includes(currentHostname);
    const resp = await chrome.runtime.sendMessage({
      type: 'TOGGLE_SITE',
      hostname: currentHostname,
      disabled: !isCurrentlyDisabled
    });
    if (resp?.success) {
      state.disabledSites = resp.disabledSites;
      updateStatusUI();
    }
  });

  // Primary Summon Button
  $('summonBtn').addEventListener('click', async () => {
    if (!state.enabled) {
      $('globalEnabled').checked = true;
      await updateSetting('enabled', true);
    }
    const resp = await chrome.runtime.sendMessage({ type: 'SUMMON_WEBLING' });
    if (resp?.success) {
      window.close();
    } else {
      showUnsupportedPage('Could not summon here');
    }
  });

  // Customize Inputs
  $('personalitySelect').addEventListener('change', (e) => updateSetting('personality', e.target.value));
  $('charSizeSelect').addEventListener('change', (e) => updateSetting('characterSize', e.target.value));
  $('startPosSelect').addEventListener('change', (e) => updateSetting('startPosition', e.target.value));
  $('webLineColor').addEventListener('change', (e) => updateSetting('webLineColor', e.target.value));

  // Switches
  const toggleKeys = [
    'spidersEnabled',
    'showHydrationWidget',
    'showFocusIndicator',
    'showSpeechBubbles',
    'quietMode',
    'swingToClicks',
    'reducedMotion',
    'focusAutoBreak',
    'videoDimming',
    'notificationsEnabled',
    'hydrationRemindersEnabled'
  ];
  toggleKeys.forEach((key) => {
    const el = $(key);
    if (el) {
      el.addEventListener('change', (e) => updateSetting(key, e.target.checked));
    }
  });

  $('mishapFreqSelect').addEventListener('change', (e) => updateSetting('mishapFrequency', e.target.value));
  $('reminderIntervalSelect').addEventListener('change', (e) => updateSetting('hydrationReminderInterval', Number(e.target.value)));
  $('hydrationTargetSelect').addEventListener('change', async (e) => {
    const val = Number(e.target.value);
    await updateSetting('hydrationTarget', val);
    updateHydrationUI();
  });

  // Refresh Stats
  $('refreshStatsBtn').addEventListener('click', () => {
    fetchPageStats();
  });

  // Hydration Actions
  $('quickWaterAdd').addEventListener('click', async () => {
    const resp = await chrome.runtime.sendMessage({ type: 'HYDRATION_ADD' });
    if (resp?.success) {
      state.hydration = resp.hydration;
      updateHydrationUI();
    }
  });

  $('quickWaterSub').addEventListener('click', async () => {
    const resp = await chrome.runtime.sendMessage({ type: 'HYDRATION_REMOVE' });
    if (resp?.success) {
      state.hydration = resp.hydration;
      updateHydrationUI();
    }
  });

  // Focus Presets
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPresetMinutes = Number(btn.getAttribute('data-min'));
      $('customFocusDuration').value = selectedPresetMinutes;
      updateFocusUI();
    });
  });

  $('applyCustomDurationBtn').addEventListener('click', () => {
    const val = Math.max(1, Math.min(180, Number($('customFocusDuration').value) || 25));
    $('customFocusDuration').value = val;
    selectedPresetMinutes = val;
    presetBtns.forEach((b) => b.classList.remove('active'));
    updateFocusUI();
  });

  // Focus Control Buttons
  const startSession = async () => {
    await chrome.runtime.sendMessage({
      type: 'FOCUS_START',
      duration: selectedPresetMinutes
    });
    const resp = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (resp?.success) {
      state = resp.data;
      updateFocusUI();
      updateStatusUI();
    }
  };

  $('focusStartBtn').addEventListener('click', startSession);
  $('quickFocusBtn').addEventListener('click', () => {
    if (state.focusStatus === 'running') {
      $('focusPauseBtn').click();
    } else if (state.focusStatus === 'paused') {
      $('focusResumeBtn').click();
    } else {
      startSession();
    }
  });

  $('focusPauseBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'FOCUS_PAUSE' });
    const resp = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (resp?.success) {
      state = resp.data;
      updateFocusUI();
    }
  });

  $('focusResumeBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'FOCUS_RESUME' });
    const resp = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (resp?.success) {
      state = resp.data;
      updateFocusUI();
    }
  });

  $('focusResetBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'FOCUS_RESET' });
    const resp = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (resp?.success) {
      state = resp.data;
      updateFocusUI();
      updateStatusUI();
    }
  });

  // Reopen Onboarding
  $('reopenOnboardingBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'onboarding.html' });
  });

  // Reset Operations
  $('resetHydrationBtn').addEventListener('click', async () => {
    if (confirm("Reset today's hydration to 0?")) {
      await chrome.runtime.sendMessage({ type: 'RESET_HYDRATION_TODAY' });
      state.hydration = 0;
      updateHydrationUI();
    }
  });

  $('resetFocusBtn').addEventListener('click', async () => {
    if (confirm('Reset all focus sessions and streaks?')) {
      await chrome.runtime.sendMessage({ type: 'RESET_FOCUS_HISTORY' });
      state.focusSessionsCompleted = 0;
      state.focusTotalMinutes = 0;
      state.focusCurrentStreak = 0;
      state.focusBestStreak = 0;
      updateProgressUI();
    }
  });

  $('resetAchievementsBtn').addEventListener('click', async () => {
    if (confirm('Reset all unlocked achievements and cosmetics?')) {
      await chrome.runtime.sendMessage({ type: 'RESET_ACHIEVEMENTS' });
      state.achievements = {};
      state.cosmeticsUnlocked = [];
      state.equippedCosmetics = {};
      updateProgressUI();
      updateCosmeticsUI();
    }
  });

  $('resetSettingsBtn').addEventListener('click', async () => {
    if (confirm('Reset all preferences to default settings?')) {
      await chrome.runtime.sendMessage({ type: 'RESET_ALL_SETTINGS' });
      const resp = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (resp?.success) {
        state = resp.data;
        syncControlsFromState();
      }
    }
  });

  $('resetAllBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to completely wipe all Webling data and start fresh? This cannot be undone.')) {
      await chrome.runtime.sendMessage({ type: 'RESET_ALL' });
      window.close();
    }
  });
}

// ---------------------------------------------------------------------------
// Storage Change Sync
// ---------------------------------------------------------------------------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  for (const [key, change] of Object.entries(changes)) {
    state[key] = change.newValue;
  }

  updateStatusUI();
  updateHydrationUI();
  updateFocusUI();
  updateProgressUI();
  updateCosmeticsUI();
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function initialize() {
  setupTabs();
  bindControls();

  const resp = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (resp?.success && resp.data) {
    state = resp.data;
  } else {
    state = await loadSettings();
  }

  syncControlsFromState();
  await checkActiveTab();
}

initialize();
