// Extension Popup Controller & Master Power Switch

const powerToggle = document.getElementById('masterPowerToggle');
const statusLabel = document.getElementById('statusLabel');

// Load initial power state from storage
if (chrome && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['morse_power_enabled'], (result) => {
    const isEnabled = result.morse_power_enabled !== false;
    powerToggle.checked = isEnabled;
    updateStatusLabel(isEnabled);
  });
} else {
  const isEnabled = localStorage.getItem('morse_power_enabled') !== 'false';
  powerToggle.checked = isEnabled;
  updateStatusLabel(isEnabled);
}

function updateStatusLabel(enabled) {
  if (statusLabel) {
    statusLabel.textContent = enabled ? 'Floating Typer: ON' : 'Floating Typer: OFF';
    statusLabel.style.color = enabled ? '#00f0ff' : '#94a3b8';
  }
}

// Handle toggle change
powerToggle.addEventListener('change', (e) => {
  const isEnabled = e.target.checked;
  updateStatusLabel(isEnabled);

  // Save state
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ morse_power_enabled: isEnabled });
  }
  localStorage.setItem('morse_power_enabled', isEnabled ? 'true' : 'false');

  // Broadcast power change to all active browser tabs
  if (chrome && chrome.tabs) {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'toggle_power', enabled: isEnabled }).catch(() => {});
        }
      }
    });
  }
});

document.getElementById('openWebAppBtn').addEventListener('click', () => {
  if (chrome && chrome.tabs) {
    chrome.tabs.create({ url: 'https://morcecodekt.vercel.app' });
  } else {
    window.open('https://morcecodekt.vercel.app', '_blank');
  }
});

document.getElementById('helpGuideBtn').addEventListener('click', () => {
  if (chrome && chrome.tabs) {
    chrome.tabs.create({ url: 'https://morcecodekt.vercel.app/extension.html' });
  } else {
    window.open('https://morcecodekt.vercel.app/extension.html', '_blank');
  }
});
