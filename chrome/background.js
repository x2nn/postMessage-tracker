// Initialize storage on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    tab_listeners: {},
    tab_push: {},
    tab_lasturl: {},
    selectedId: -1
  });
});

async function refreshCount(tabId) {
  if (!tabId || tabId === -1) {
    const { selectedId = -1 } = await chrome.storage.local.get('selectedId');
    tabId = selectedId;
  }
  if (tabId === -1) return;

  const { tab_listeners = {} } = await chrome.storage.local.get('tab_listeners');
  const txt = tab_listeners[tabId] ? tab_listeners[tabId].length : 0;

  try {
    // Check if tab exists before updating badge
    await chrome.tabs.get(tabId);
    chrome.action.setBadgeText({ text: '' + txt, tabId: tabId });
    if (txt > 0) {
      chrome.action.setBadgeBackgroundColor({ color: [255, 0, 0, 255], tabId: tabId });
    } else {
      chrome.action.setBadgeBackgroundColor({ color: [0, 0, 255, 0], tabId: tabId });
    }
  } catch (e) {
    // Tab might have been closed.
    console.log(`Failed to update badge for tab ${tabId}:`, e.message);
  }
}

function logListener(data) {
  chrome.storage.sync.get({
    log_url: ''
  }, function (items) {
    const log_url = items.log_url;
    if (!log_url.length) return;
    data = JSON.stringify(data);
    try {
      fetch(log_url, {
        method: 'post',
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        },
        body: data
      });
    } catch (e) { }
  });
}

// Save state to storage
async function saveState() {
  try {
    const { tab_listeners = {} } = await chrome.storage.local.get('tab_listeners');
    const { selectedId = -1 } = await chrome.storage.local.get('selectedId');
    await chrome.storage.local.set({
      tab_listeners,
      selectedId
    });
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

// Debounce utility
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

const debouncedSaveState = debounce(saveState, 500); // Debounce save state by 500ms

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('message from cs', msg);
  const tabId = sender.tab.id;

  (async () => {
    if (!msg) {
        console.error("Received a null message.");
        return;
    }
    if (msg.listener) {
      if (msg.listener == 'function () { [native code] }') return;
      msg.parent_url = sender.tab.url;
      const data = await chrome.storage.local.get('tab_listeners');
      const tab_listeners = data.tab_listeners || {};
      if (!tab_listeners[tabId]) tab_listeners[tabId] = [];
      tab_listeners[tabId].push(msg);
      await chrome.storage.local.set({ tab_listeners });
      logListener(msg);
    }
    if (msg.pushState) {
      const data = await chrome.storage.local.get('tab_push');
      const tab_push = data.tab_push || {};
      tab_push[tabId] = true;
      await chrome.storage.local.set({ tab_push });
    }
    if (msg.changePage) {
      const data = await chrome.storage.local.get('tab_lasturl');
      const tab_lasturl = data.tab_lasturl || {};
      delete tab_lasturl[tabId];
      await chrome.storage.local.set({ tab_lasturl });
    }
    if (msg.log) {
      console.log(msg.log);
    } else {
      refreshCount(tabId);
    }
    debouncedSaveState();
  })();

  return true; // Keep the message channel open for async response
});

chrome.tabs.onUpdated.addListener((tabId, props) => {
  (async () => {
    if (props.status == "complete") {
      const { selectedId } = await chrome.storage.local.get('selectedId');
      if (tabId == selectedId) refreshCount(tabId);
    } else if (props.status) {
      const data = await chrome.storage.local.get(['tab_push', 'tab_lasturl']);
      const tab_push = data.tab_push || {};
      const tab_lasturl = data.tab_lasturl || {};

      if (tab_push[tabId]) {
        delete tab_push[tabId];
        await chrome.storage.local.set({ tab_push });
      } else {
        if (!tab_lasturl[tabId]) {
          const { tab_listeners = {} } = await chrome.storage.local.get('tab_listeners');
          tab_listeners[tabId] = [];
          await chrome.storage.local.set({ tab_listeners });
          debouncedSaveState();
        }
      }
    }
    if (props.status == "loading") {
      const { tab_lasturl = {} } = await chrome.storage.local.get('tab_lasturl');
      tab_lasturl[tabId] = true;
      await chrome.storage.local.set({ tab_lasturl });
    }
  })();
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  (async () => {
    await chrome.storage.local.set({ selectedId: activeInfo.tabId });
    refreshCount(activeInfo.tabId);
    debouncedSaveState();
  })();
});

// Set initial selected tab on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.storage.local.set({ selectedId: tabs[0].id });
      refreshCount(tabs[0].id);
      debouncedSaveState();
    }
  });
});

chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener((msg) => {
    (async () => {
      const { tab_listeners } = await chrome.storage.local.get('tab_listeners');
      port.postMessage({ listeners: tab_listeners });
    })();
  });
});