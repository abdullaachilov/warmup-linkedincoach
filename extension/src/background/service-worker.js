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

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-reset') {
    const { lastResetDate } = await chrome.storage.local.get('lastResetDate');
    const today = new Date().toISOString().split('T')[0];
    if (lastResetDate !== today) {
      await chrome.storage.local.set({ lastResetDate: today });
      // Notify side panel to refresh
      chrome.runtime.sendMessage({ type: 'DAILY_RESET' }).catch(() => {});
    }
  }
});

// Update badge with streak count
async function updateBadge() {
  const { currentStreak } = await chrome.storage.local.get('currentStreak');
  if (currentStreak && currentStreak > 0) {
    chrome.action.setBadgeText({ text: `${currentStreak}` });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'UPDATE_STREAK') {
    chrome.storage.local.set({ currentStreak: msg.streak });
    updateBadge();
  }
});

// Initial badge update
updateBadge();
