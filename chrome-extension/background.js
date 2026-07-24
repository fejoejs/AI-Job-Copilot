// AI Job Assistant Background Script

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'JOB_FOUND') {
    console.log('[Background] Job payload received from content script:', message.data.title);

    chrome.storage.local.get(['authToken', 'apiUrl'], (result) => {
      const token = result.authToken;
      const apiBase = result.apiUrl || 'http://localhost:3001';

      if (!token) {
        console.warn('[Background] Extension not connected. Please add your access token in the popup.');
        return;
      }

      fetch(`${apiBase}/external-board/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(message.data),
      })
      .then(async (res) => {
        if (res.ok) {
          console.log('[Background] Sourced job successfully synced with backend pool.');
        } else {
          const err = await res.text();
          console.error('[Background] Failed to sync job:', err);
        }
      })
      .catch((err) => {
        console.error('[Background] Network connection failed:', err);
      });
    });
  }
});
