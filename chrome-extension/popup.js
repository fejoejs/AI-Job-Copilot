document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('token');
  const apiInput = document.getElementById('apiUrl');
  const saveBtn = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // Load existing configuration settings
  chrome.storage.local.get(['authToken', 'apiUrl'], (result) => {
    if (result.authToken) {
      tokenInput.value = result.authToken;
      showStatus('Connected! Browse LinkedIn/Indeed/Naukri normally.', 'success');
    }
    if (result.apiUrl) {
      apiInput.value = result.apiUrl;
    }
  });

  saveBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    const apiUrl = apiInput.value.trim() || 'http://localhost:3001';

    if (!token) {
      showStatus('Please paste your access token.', 'error');
      return;
    }

    chrome.storage.local.set({ authToken: token, apiUrl: apiUrl }, () => {
      showStatus('Connected successfully! Sourced matches will sync.', 'success');
    });
  });

  function showStatus(text, className) {
    statusDiv.innerText = text;
    statusDiv.className = className;
    statusDiv.style.display = 'block';
  }
});
