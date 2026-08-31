document.getElementById('openWebAppBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://morcecodekt.vercel.app' });
});

document.getElementById('helpGuideBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://morcecodekt.vercel.app/extension.html' });
});
