/**
 * Webling Background Service Worker (Manifest V3)
 * Authoritative owner of focus timer, alarms, hydration reminders,
 * daily rollover, notifications, achievements, and cross-tab broadcasts.
 */

import {
  DEFAULTS,
  loadSettings,
  saveSettings,
  migrateStorage,
  validateSettings,
  todayKey,
  isInQuietHours
} from './modules/storage.js';

import {
  ACHIEVEMENT_LIST,
  COSMETIC_LIST,
  checkAchievements,
  checkCosmetics,
  getAchievement,
  getCosmetic
} from './modules/achievements.js';

const ALARM_FOCUS = 'webling-focus';
const ALARM_BREAK = 'webling-break';
const ALARM_HYDRATION = 'webling-hydration';
const ALARM_DAILY = 'webling-daily';

// ---------------------------------------------------------------------------
// Lifecycle & Initialization
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  await migrateStorage();

  const settings = await loadSettings();
  const updates = {};

  if (!settings.installDate) {
    updates.installDate = todayKey();
  }

  if (Object.keys(updates).length > 0) {
    await saveSettings(updates);
  }

  // Set up daily rollover alarm
  await chrome.alarms.create(ALARM_DAILY, {
    periodInMinutes: 60 // Check hourly for midnight date changes
  });

  // Sync hydration alarm
  await syncHydrationAlarm();

  // Check running focus timer on startup / install
  await checkTimerState();

  // If new install and onboarding not completed, open onboarding tab
  if (details.reason === 'install' && !settings.onboardingComplete) {
    try {
      await chrome.tabs.create({ url: 'onboarding.html' });
    } catch {
      // Ignore if tab cannot be opened
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await checkDailyRollover();
  await syncHydrationAlarm();
  await checkTimerState();
});

// ---------------------------------------------------------------------------
// Broadcast helper
// ---------------------------------------------------------------------------

async function broadcastToTabs(message) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      // Only message supported pages
      if (/^(https?|file):\/\//.test(tab.url)) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab might not have content script loaded or is busy; safely ignore
        });
      }
    }
  } catch (err) {
    console.warn('[Webling] Broadcast error:', err);
  }
}

// ---------------------------------------------------------------------------
// Date & Streak helpers
// ---------------------------------------------------------------------------

function getYesterdayKey(todayStr) {
  const [y, m, d] = todayStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function checkDailyRollover() {
  const settings = await loadSettings();
  const today = todayKey();

  if (settings.hydrationDate && settings.hydrationDate !== today) {
    // Rollover: reset daily hydration count for the new day
    const updates = {
      hydration: 0,
      hydrationDate: today
    };

    // Check if yesterday's goal was met to update streak continuity
    const yesterday = getYesterdayKey(today);
    const history = Array.isArray(settings.hydrationHistory) ? settings.hydrationHistory : [];
    if (!history.includes(yesterday) && settings.hydrationCurrentStreak > 0) {
      // Missed yesterday, streak resets to 0
      updates.hydrationCurrentStreak = 0;
    }

    // Check focus streak continuity
    if (settings.focusLastSessionDate && settings.focusLastSessionDate !== yesterday && settings.focusLastSessionDate !== today) {
      updates.focusCurrentStreak = 0;
    }

    await saveSettings(updates);
    await broadcastToTabs({ type: 'HYDRATION_UPDATE', hydration: 0, hydrationTarget: settings.hydrationTarget });
  } else if (!settings.hydrationDate) {
    await saveSettings({ hydrationDate: today });
  }
}

// ---------------------------------------------------------------------------
// Notification helper
// ---------------------------------------------------------------------------

function showNotification(id, title, message) {
  if (!chrome.notifications) return;
  try {
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icon-128.png'),
      title,
      message,
      priority: 1
    }, () => {
      if (chrome.runtime.lastError) {
        // Notification permission might be denied or unsupported
      }
    });
  } catch (err) {
    console.warn('[Webling] Notification error:', err);
  }
}

// ---------------------------------------------------------------------------
// Achievements and Cosmetics Evaluation
// ---------------------------------------------------------------------------

async function evaluateProgression(stats) {
  const settings = await loadSettings();
  const currentStats = { ...settings, ...(stats || {}) };

  const currentAchievements = settings.achievements || {};
  const currentUnlockedCosmetics = Array.isArray(settings.cosmeticsUnlocked) ? settings.cosmeticsUnlocked : [];

  const newlyUnlockedAchievements = checkAchievements(currentStats, currentAchievements);
  const newlyUnlockedCosmetics = checkCosmetics(currentStats, currentUnlockedCosmetics);

  let updated = false;
  const updates = {};

  if (newlyUnlockedAchievements.length > 0) {
    updated = true;
    const achievementsMap = { ...currentAchievements };
    for (const achId of newlyUnlockedAchievements) {
      achievementsMap[achId] = {
        unlocked: true,
        date: todayKey(),
        celebrated: false
      };
      const def = getAchievement(achId);
      if (settings.notificationsEnabled && def) {
        showNotification(`ach-${achId}`, 'Achievement Unlocked! 🏆', `${def.name} — ${def.description}`);
      }
      broadcastToTabs({
        type: 'ACHIEVEMENT_UNLOCKED',
        achievementId: achId,
        name: def?.name || achId,
        description: def?.description || ''
      });
    }
    updates.achievements = achievementsMap;
  }

  if (newlyUnlockedCosmetics.length > 0) {
    updated = true;
    const cosmeticsList = [...currentUnlockedCosmetics, ...newlyUnlockedCosmetics];
    for (const cosId of newlyUnlockedCosmetics) {
      const def = getCosmetic(cosId);
      broadcastToTabs({
        type: 'COSMETIC_UNLOCKED',
        cosmeticId: cosId,
        name: def?.name || cosId
      });
    }
    updates.cosmeticsUnlocked = cosmeticsList;
  }

  if (updated) {
    await saveSettings(updates);
  }

  return { newlyUnlockedAchievements, newlyUnlockedCosmetics };
}

// ---------------------------------------------------------------------------
// Focus Timer Logic
// ---------------------------------------------------------------------------

async function checkTimerState() {
  const settings = await loadSettings();

  if (settings.focusStatus === 'running') {
    const now = Date.now();
    if (settings.focusEndTime > 0 && now >= settings.focusEndTime) {
      // Completed while inactive / asleep
      await completeFocusSession();
    } else if (settings.focusEndTime > 0) {
      // Re-arm alarm
      await chrome.alarms.create(ALARM_FOCUS, { when: settings.focusEndTime });
    }
  } else if (settings.focusStatus === 'break') {
    const now = Date.now();
    if (settings.focusEndTime > 0 && now >= settings.focusEndTime) {
      await endBreakSession();
    } else if (settings.focusEndTime > 0) {
      await chrome.alarms.create(ALARM_BREAK, { when: settings.focusEndTime });
    }
  }
}

async function startFocusSession(durationMinutes) {
  const duration = Math.max(1, Math.min(180, Number(durationMinutes) || 25));
  const startTime = Date.now();
  const endTime = startTime + duration * 60 * 1000;

  await chrome.alarms.clear(ALARM_BREAK);
  await chrome.alarms.create(ALARM_FOCUS, { when: endTime });

  const updates = {
    focusStatus: 'running',
    focusDuration: duration,
    focusStartTime: startTime,
    focusEndTime: endTime,
    focusPausedRemaining: 0
  };

  await saveSettings(updates);
  await broadcastToTabs({
    type: 'FOCUS_STATE_CHANGED',
    focusStatus: 'running',
    focusDuration: duration,
    focusStartTime: startTime,
    focusEndTime: endTime,
    focusPausedRemaining: 0
  });
}

async function pauseFocusSession() {
  const settings = await loadSettings();
  if (settings.focusStatus !== 'running') return;

  const now = Date.now();
  const remaining = Math.max(0, settings.focusEndTime - now);

  await chrome.alarms.clear(ALARM_FOCUS);

  const updates = {
    focusStatus: 'paused',
    focusPausedRemaining: remaining
  };

  await saveSettings(updates);
  await broadcastToTabs({
    type: 'FOCUS_STATE_CHANGED',
    focusStatus: 'paused',
    focusPausedRemaining: remaining,
    focusDuration: settings.focusDuration
  });
}

async function resumeFocusSession() {
  const settings = await loadSettings();
  if (settings.focusStatus !== 'paused') return;

  const remaining = settings.focusPausedRemaining || settings.focusDuration * 60 * 1000;
  const startTime = Date.now();
  const endTime = startTime + remaining;

  await chrome.alarms.create(ALARM_FOCUS, { when: endTime });

  const updates = {
    focusStatus: 'running',
    focusStartTime: startTime,
    focusEndTime: endTime,
    focusPausedRemaining: 0
  };

  await saveSettings(updates);
  await broadcastToTabs({
    type: 'FOCUS_STATE_CHANGED',
    focusStatus: 'running',
    focusDuration: settings.focusDuration,
    focusStartTime: startTime,
    focusEndTime: endTime,
    focusPausedRemaining: 0
  });
}

async function resetFocusSession() {
  await chrome.alarms.clear(ALARM_FOCUS);
  await chrome.alarms.clear(ALARM_BREAK);

  const updates = {
    focusStatus: 'idle',
    focusStartTime: 0,
    focusEndTime: 0,
    focusPausedRemaining: 0
  };

  await saveSettings(updates);
  await broadcastToTabs({
    type: 'FOCUS_STATE_CHANGED',
    focusStatus: 'idle',
    focusPausedRemaining: 0
  });
}

async function completeFocusSession() {
  await chrome.alarms.clear(ALARM_FOCUS);

  const settings = await loadSettings();
  if (settings.focusStatus !== 'running') return;

  const today = todayKey();
  const yesterday = getYesterdayKey(today);

  const completedSessions = settings.focusSessionsCompleted + 1;
  const totalMinutes = settings.focusTotalMinutes + settings.focusDuration;
  const longestSession = Math.max(settings.focusLongestSessionMinutes || 0, settings.focusDuration);

  // Focus streak calculation
  let currentStreak = settings.focusCurrentStreak || 0;
  if (settings.focusLastSessionDate === today) {
    // Already did one today, keep current streak
  } else if (settings.focusLastSessionDate === yesterday) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }
  const bestStreak = Math.max(settings.focusBestStreak || 0, currentStreak);

  let nextStatus = 'idle';
  let breakEndTime = 0;

  if (settings.focusAutoBreak && settings.focusBreakDuration > 0) {
    nextStatus = 'break';
    breakEndTime = Date.now() + settings.focusBreakDuration * 60 * 1000;
    await chrome.alarms.create(ALARM_BREAK, { when: breakEndTime });
  }

  const updates = {
    focusStatus: nextStatus,
    focusSessionsCompleted: completedSessions,
    focusTotalMinutes: totalMinutes,
    focusLongestSessionMinutes: longestSession,
    focusCurrentStreak: currentStreak,
    focusBestStreak: bestStreak,
    focusLastSessionDate: today,
    focusStartTime: 0,
    focusEndTime: breakEndTime,
    focusPausedRemaining: 0
  };

  await saveSettings(updates);

  // Broadcast completion to tabs
  await broadcastToTabs({
    type: 'FOCUS_COMPLETED',
    duration: settings.focusDuration,
    autoBreak: nextStatus === 'break',
    breakMinutes: settings.focusBreakDuration
  });

  await broadcastToTabs({
    type: 'FOCUS_STATE_CHANGED',
    focusStatus: nextStatus,
    focusEndTime: breakEndTime
  });

  // Evaluate achievements with updated stats
  await evaluateProgression(updates);

  // Notification
  if (settings.notificationsEnabled) {
    showNotification(
      'focus-complete',
      'Focus Session Complete! 🎯',
      nextStatus === 'break'
        ? `Great job! Enjoy your ${settings.focusBreakDuration}-minute break.`
        : 'Web-tastic focus! Great job on your session.'
    );
  }
}

async function endBreakSession() {
  await chrome.alarms.clear(ALARM_BREAK);
  const settings = await loadSettings();

  const updates = {
    focusStatus: 'idle',
    focusStartTime: 0,
    focusEndTime: 0,
    focusPausedRemaining: 0
  };

  await saveSettings(updates);
  await broadcastToTabs({
    type: 'FOCUS_STATE_CHANGED',
    focusStatus: 'idle'
  });

  if (settings.notificationsEnabled) {
    showNotification('break-complete', 'Break Over! ⚡', 'Ready to swing into your next focus session?');
  }
}

// ---------------------------------------------------------------------------
// Hydration Reminders Alarm
// ---------------------------------------------------------------------------

async function syncHydrationAlarm() {
  const settings = await loadSettings();

  if (settings.hydrationRemindersEnabled && settings.hydrationReminderInterval > 0) {
    await chrome.alarms.create(ALARM_HYDRATION, {
      periodInMinutes: settings.hydrationReminderInterval,
      delayInMinutes: settings.hydrationReminderInterval
    });
  } else {
    await chrome.alarms.clear(ALARM_HYDRATION);
  }
}

async function handleHydrationAlarm() {
  const settings = await loadSettings();

  if (!settings.hydrationRemindersEnabled) return;

  // Don't remind if daily target already met
  if (settings.hydration >= settings.hydrationTarget) return;

  // Don't remind during quiet hours
  if (isInQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) return;

  // Broadcast to open tabs so Webling can deliver a personality reminder bubble
  await broadcastToTabs({
    type: 'HYDRATION_REMINDER',
    current: settings.hydration,
    target: settings.hydrationTarget
  });

  // Show desktop notification if enabled
  if (settings.notificationsEnabled) {
    showNotification(
      'hydration-reminder',
      'Time for a sip! 💧',
      `You've had ${settings.hydration} of ${settings.hydrationTarget} glasses today. Stay hydrated!`
    );
  }
}

// ---------------------------------------------------------------------------
// chrome.alarms dispatcher
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_FOCUS) {
    await completeFocusSession();
  } else if (alarm.name === ALARM_BREAK) {
    await endBreakSession();
  } else if (alarm.name === ALARM_HYDRATION) {
    await handleHydrationAlarm();
  } else if (alarm.name === ALARM_DAILY) {
    await checkDailyRollover();
  }
});

// ---------------------------------------------------------------------------
// Keyboard Shortcuts
// ---------------------------------------------------------------------------

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'summon-webling') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^(https?|file):\/\//.test(tab.url)) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'WEBLING_SUMMON' });
  } catch {
    // If content script was not yet injected into this tab, inject and retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'WEBLING_SUMMON' });
    } catch {
      // Protected browser pages will reject scripting cleanly
    }
  }
});

// ---------------------------------------------------------------------------
// Messaging API Router
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Use async wrapper to support sendResponse
  (async () => {
    switch (message.type) {
      case 'GET_STATE': {
        const settings = await loadSettings();
        sendResponse({ success: true, data: settings });
        break;
      }

      case 'UPDATE_SETTING': {
        if (!message.key) {
          sendResponse({ success: false, error: 'Missing key' });
          return;
        }
        await saveSettings({ [message.key]: message.value });

        if (message.key === 'hydrationRemindersEnabled' || message.key === 'hydrationReminderInterval') {
          await syncHydrationAlarm();
        }

        await broadcastToTabs({
          type: 'SETTING_CHANGED',
          key: message.key,
          value: message.value
        });
        sendResponse({ success: true });
        break;
      }

      case 'UPDATE_SETTINGS': {
        if (!message.settings || typeof message.settings !== 'object') {
          sendResponse({ success: false, error: 'Invalid settings' });
          return;
        }
        await saveSettings(message.settings);

        if ('hydrationRemindersEnabled' in message.settings || 'hydrationReminderInterval' in message.settings) {
          await syncHydrationAlarm();
        }

        await broadcastToTabs({
          type: 'SETTINGS_BULK_UPDATE',
          settings: message.settings
        });
        sendResponse({ success: true });
        break;
      }

      case 'TOGGLE_SITE': {
        const { hostname, disabled } = message;
        if (!hostname) {
          sendResponse({ success: false, error: 'Missing hostname' });
          return;
        }
        const settings = await loadSettings();
        let disabledSites = Array.isArray(settings.disabledSites) ? [...settings.disabledSites] : [];
        if (disabled) {
          if (!disabledSites.includes(hostname)) disabledSites.push(hostname);
        } else {
          disabledSites = disabledSites.filter((h) => h !== hostname);
        }
        await saveSettings({ disabledSites });
        await broadcastToTabs({
          type: 'VISIBILITY_UPDATE',
          disabledSites
        });
        sendResponse({ success: true, disabledSites });
        break;
      }

      case 'FOCUS_START': {
        await startFocusSession(message.duration);
        sendResponse({ success: true });
        break;
      }

      case 'FOCUS_PAUSE': {
        await pauseFocusSession();
        sendResponse({ success: true });
        break;
      }

      case 'FOCUS_RESUME': {
        await resumeFocusSession();
        sendResponse({ success: true });
        break;
      }

      case 'FOCUS_RESET': {
        await resetFocusSession();
        sendResponse({ success: true });
        break;
      }

      case 'HYDRATION_ADD': {
        const today = todayKey();
        const settings = await loadSettings();

        let current = settings.hydrationDate === today ? settings.hydration : 0;
        const target = settings.hydrationTarget || 8;
        const newCount = Math.min(target, current + 1);

        const updates = {
          hydration: newCount,
          hydrationDate: today
        };

        // Check if goal was just completed today
        let history = Array.isArray(settings.hydrationHistory) ? [...settings.hydrationHistory] : [];
        let justCompleted = false;

        if (newCount >= target && !history.includes(today)) {
          justCompleted = true;
          history.push(today);
          updates.hydrationHistory = history;
          updates.hydrationGoalsCompleted = (settings.hydrationGoalsCompleted || 0) + 1;

          // Streak update
          const yesterday = getYesterdayKey(today);
          let currentStreak = settings.hydrationCurrentStreak || 0;
          if (history.includes(yesterday)) {
            currentStreak += 1;
          } else {
            currentStreak = 1;
          }
          updates.hydrationCurrentStreak = currentStreak;
          updates.hydrationBestStreak = Math.max(settings.hydrationBestStreak || 0, currentStreak);

          if (settings.notificationsEnabled) {
            showNotification('hydration-goal', 'Hydration Mission Complete! 💧', 'Awesome job! You reached your water target today.');
          }
        }

        await saveSettings(updates);
        await broadcastToTabs({
          type: 'HYDRATION_UPDATE',
          hydration: newCount,
          hydrationTarget: target,
          justCompleted
        });

        await evaluateProgression(updates);
        sendResponse({ success: true, hydration: newCount, target, justCompleted });
        break;
      }

      case 'HYDRATION_REMOVE': {
        const today = todayKey();
        const settings = await loadSettings();
        let current = settings.hydrationDate === today ? settings.hydration : 0;
        const newCount = Math.max(0, current - 1);

        const updates = {
          hydration: newCount,
          hydrationDate: today
        };
        await saveSettings(updates);
        await broadcastToTabs({
          type: 'HYDRATION_UPDATE',
          hydration: newCount,
          hydrationTarget: settings.hydrationTarget
        });
        sendResponse({ success: true, hydration: newCount });
        break;
      }

      case 'RECORD_RESCUE': {
        const settings = await loadSettings();
        const newScore = (settings.spiderScore || 0) + 1;
        await saveSettings({ spiderScore: newScore });

        await broadcastToTabs({
          type: 'RESCUE_RECORDED',
          spiderScore: newScore
        });

        await evaluateProgression({ spiderScore: newScore });
        sendResponse({ success: true, spiderScore: newScore });
        break;
      }

      case 'RECORD_PATROL': {
        const { url } = message;
        if (!url) {
          sendResponse({ success: false });
          return;
        }

        const settings = await loadSettings();
        const patrolled = { ...(settings.patrolledUrls || {}) };
        const now = Date.now();
        const lastVisit = patrolled[url] || 0;

        // Count URL at most once per 30 minutes to prevent refresh inflation
        if (now - lastVisit > 30 * 60 * 1000) {
          patrolled[url] = now;

          // Prune older entries if object gets large
          const keys = Object.keys(patrolled);
          if (keys.length > 300) {
            keys.sort((a, b) => patrolled[a] - patrolled[b]);
            for (let i = 0; i < 100; i++) delete patrolled[keys[i]];
          }

          const newTotal = (settings.pagesPatrolled || 0) + 1;
          await saveSettings({
            pagesPatrolled: newTotal,
            patrolledUrls: patrolled
          });

          await evaluateProgression({ pagesPatrolled: newTotal });
          sendResponse({ success: true, pagesPatrolled: newTotal });
        } else {
          sendResponse({ success: true, pagesPatrolled: settings.pagesPatrolled });
        }
        break;
      }

      case 'EQUIP_COSMETIC': {
        const { category, cosmeticId } = message;
        if (!category || !cosmeticId) {
          sendResponse({ success: false, error: 'Invalid parameters' });
          return;
        }
        const settings = await loadSettings();
        const equipped = { ...(settings.equippedCosmetics || {}) };
        equipped[category] = cosmeticId;

        await saveSettings({ equippedCosmetics: equipped });
        await broadcastToTabs({
          type: 'COSMETIC_EQUIPPED',
          category,
          cosmeticId
        });
        sendResponse({ success: true, equippedCosmetics: equipped });
        break;
      }

      case 'SUMMON_WEBLING': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab.url || !/^(https?|file):\/\//.test(tab.url)) {
          sendResponse({ success: false, reason: 'unsupported_page' });
          return;
        }
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'WEBLING_SUMMON' });
          sendResponse({ success: true });
        } catch {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            await chrome.tabs.sendMessage(tab.id, { type: 'WEBLING_SUMMON' });
            sendResponse({ success: true });
          } catch (e) {
            sendResponse({ success: false, error: e.message });
          }
        }
        break;
      }

      case 'RESET_HYDRATION_TODAY': {
        await saveSettings({ hydration: 0 });
        await broadcastToTabs({ type: 'HYDRATION_UPDATE', hydration: 0 });
        sendResponse({ success: true });
        break;
      }

      case 'RESET_FOCUS_HISTORY': {
        await saveSettings({
          focusSessionsCompleted: 0,
          focusTotalMinutes: 0,
          focusLongestSessionMinutes: 0,
          focusCurrentStreak: 0,
          focusBestStreak: 0,
          focusLastSessionDate: ''
        });
        sendResponse({ success: true });
        break;
      }

      case 'RESET_ACHIEVEMENTS': {
        await saveSettings({
          achievements: {},
          cosmeticsUnlocked: [],
          equippedCosmetics: {}
        });
        await broadcastToTabs({ type: 'COSMETICS_RESET' });
        sendResponse({ success: true });
        break;
      }

      case 'RESET_ALL_SETTINGS': {
        // Preserve user progression stats, reset only configurations
        const resetConfig = {
          enabled: DEFAULTS.enabled,
          personality: DEFAULTS.personality,
          characterSize: DEFAULTS.characterSize,
          characterPx: DEFAULTS.characterPx,
          character: DEFAULTS.character,
          squadMode: DEFAULTS.squadMode,
          squadFights: DEFAULTS.squadFights,
          startPosition: DEFAULTS.startPosition,
          swingToClicks: DEFAULTS.swingToClicks,
          showFocusIndicator: DEFAULTS.showFocusIndicator,
          showHydrationWidget: DEFAULTS.showHydrationWidget,
          spidersEnabled: DEFAULTS.spidersEnabled,
          showSpeechBubbles: DEFAULTS.showSpeechBubbles,
          quietMode: DEFAULTS.quietMode,
          mishapFrequency: DEFAULTS.mishapFrequency,
          webLineColor: DEFAULTS.webLineColor,
          reducedMotion: DEFAULTS.reducedMotion,
          notificationsEnabled: DEFAULTS.notificationsEnabled,
          hydrationRemindersEnabled: DEFAULTS.hydrationRemindersEnabled,
          hydrationReminderInterval: DEFAULTS.hydrationReminderInterval,
          hydrationTarget: DEFAULTS.hydrationTarget,
          quietHoursStart: DEFAULTS.quietHoursStart,
          quietHoursEnd: DEFAULTS.quietHoursEnd,
          videoDimming: DEFAULTS.videoDimming,
          disabledSites: []
        };
        await saveSettings(resetConfig);
        await syncHydrationAlarm();
        await broadcastToTabs({ type: 'SETTINGS_BULK_UPDATE', settings: resetConfig });
        sendResponse({ success: true });
        break;
      }

      case 'RESET_ALL': {
        await chrome.alarms.clearAll();
        await chrome.storage.local.clear();
        await migrateStorage();
        await saveSettings({ installDate: todayKey(), onboardingComplete: true });
        await broadcastToTabs({ type: 'RESET_ALL_COMPLETE' });
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  })();

  return true; // Keep message channel open for async response
});
