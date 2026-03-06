// Background service worker for Warmup extension

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Auto-open side panel on linkedin.com
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com')) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel/index.html',
      enabled: true,
    });
  }
});

// Daily reset alarm
chrome.alarms.create('daily-reset', {
  periodInMinutes: 60, // Check hourly
});

// Golden window check alarm (every minute when active)
chrome.alarms.create('golden-window-check', {
  periodInMinutes: 1,
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-reset') {
    const { lastResetDate } = await chrome.storage.local.get('lastResetDate');
    const today = new Date().toISOString().split('T')[0];
    if (lastResetDate !== today) {
      await chrome.storage.local.set({ lastResetDate: today, allTasksDone: false });
      chrome.runtime.sendMessage({ type: 'DAILY_RESET' }).catch(() => {});
      updateBadge();
    }
  }

  if (alarm.name === 'golden-window-check') {
    const { goldenWindowStart } = await chrome.storage.local.get('goldenWindowStart');
    if (!goldenWindowStart) return;

    const elapsed = Date.now() - goldenWindowStart;
    const minutes = Math.floor(elapsed / 60000);

    // Notify at 30 and 60 minute marks
    if (minutes === 30 || minutes === 60) {
      const remaining = 90 - minutes;
      chrome.notifications.create(`golden-${minutes}`, {
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Golden Window Active',
        message: `${remaining} min left! Respond to comments on your post now - early engagement determines reach.`,
      });
    }

    // Clear after 90 minutes
    if (minutes >= 90) {
      await chrome.storage.local.remove('goldenWindowStart');
      chrome.notifications.create('golden-done', {
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Golden Window Ended',
        message: 'Great job! Your 90-minute engagement window has closed.',
      });
    }
  }
});

// Update badge - show checkmark when all done, otherwise streak count
async function updateBadge() {
  const { allTasksDone, currentStreak } = await chrome.storage.local.get(['allTasksDone', 'currentStreak']);
  if (allTasksDone) {
    chrome.action.setBadgeText({ text: '\u2713' });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
  } else if (currentStreak && currentStreak > 1) {
    chrome.action.setBadgeText({ text: `${currentStreak}` });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'UPDATE_STREAK') {
    chrome.storage.local.set({ currentStreak: msg.streak });
    updateBadge();
  }
  if (msg.type === 'TASKS_COMPLETED') {
    chrome.storage.local.set({ allTasksDone: true });
    updateBadge();
  }
  if (msg.type === 'TASKS_UNCOMPLETED') {
    chrome.storage.local.set({ allTasksDone: false });
    updateBadge();
  }
  if (msg.type === 'START_GOLDEN_WINDOW') {
    chrome.storage.local.set({ goldenWindowStart: Date.now() });
  }
  // Content script events (FOCUSED_POST, USER_LIKED_POST, USER_REACTED_POST,
  // USER_COMMENTED, USER_PUBLISHED_POST, USER_SENT_CONNECTION, USER_ACCEPTED_CONNECTION)
  // are received directly by the side panel via chrome.runtime.onMessage.
});

// Initial badge update
updateBadge();
