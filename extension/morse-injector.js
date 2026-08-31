/**
 * Universal Mobile & Desktop Standalone Morse Injector
 * Injects the floating ball & widget onto any webpage via Bookmarklet
 */

(function () {
  const HOST = 'https://morcecodekt.vercel.app';

  // Inject CSS
  if (!document.getElementById('morse-ext-css')) {
    const link = document.createElement('link');
    link.id = 'morse-ext-css';
    link.rel = 'stylesheet';
    link.href = `${HOST}/extension/content.css`;
    document.head.appendChild(link);
  }

  // Inject JS
  if (!window.__morseFloatingTyperLoaded) {
    const script = document.createElement('script');
    script.src = `${HOST}/extension/content.js`;
    document.body.appendChild(script);
  } else {
    // If already loaded, toggle open
    const widget = document.getElementById('morse-ext-widget');
    const ball = document.getElementById('morse-ext-ball');
    if (widget && ball) {
      widget.classList.add('mext-open');
      ball.style.display = 'none';
    }
  }
})();
