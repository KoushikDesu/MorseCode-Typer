/**
 * MorseCode-Typer Application Controller & Theme Manager
 */

class AppController {
  constructor() {
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.tabButtons = document.querySelectorAll('.nav-tab-btn');
    this.tabPanes = document.querySelectorAll('.tab-pane');
    this.helpModal = document.getElementById('helpGuideModal');
    this.openHelpBtns = document.querySelectorAll('.open-help-modal-btn');
    this.closeHelpBtn = document.getElementById('closeHelpModalBtn');
    this.themeQuoteText = document.getElementById('themeMotivationalQuote');
    this.themeAuthorText = document.getElementById('themeMotivationalAuthor');
    this.currentTheme = localStorage.getItem('morse_theme') || 'dark'; // Default to epic dark Solo Leveling

    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.initCanvasAura();

    // Theme Switcher
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => {
        const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(nextTheme);
        if (nextTheme === 'dark') {
          window.morseAudio.playAwakeningSound();
          window.showToast('Shadow Monarch Theme: AWAKENED', 'info');
        } else {
          window.showToast('Royal Sovereign Theme: Activated', 'info');
        }
      });
    }

    // Sound Mute Toggle
    if (this.soundToggleBtn) {
      this.soundToggleBtn.addEventListener('click', () => {
        const isMuted = window.morseAudio.toggleMute();
        this.soundToggleBtn.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
        this.soundToggleBtn.title = isMuted ? 'Unmute Audio' : 'Mute Audio';
        window.showToast(isMuted ? 'Audio Muted' : 'Audio Enabled', 'info');
      });
    }

    // Navigation Tabs
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // Help Guides Modals
    this.openHelpBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const guideKey = e.currentTarget.getAttribute('data-guide') || 'general';
        this.showHelpGuide(guideKey);
      });
    });

    if (this.closeHelpBtn && this.helpModal) {
      this.closeHelpBtn.addEventListener('click', () => {
        this.helpModal.classList.remove('open');
      });
    }

    // Close modals on outside backdrop click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('morse_theme', theme);

    if (this.themeToggleBtn) {
      this.themeToggleBtn.innerHTML = theme === 'dark' 
        ? '<i class="fas fa-sun"></i> <span class="btn-text">Light Mode</span>' 
        : '<i class="fas fa-moon"></i> <span class="btn-text">Dark Mode</span>';
      this.themeToggleBtn.title = theme === 'dark' ? 'Switch to Royal Sovereign (Light)' : 'Switch to Solo Leveling (Dark)';
    }

    // Dynamic Motivation Inscription
    if (this.themeQuoteText && this.themeAuthorText) {
      if (theme === 'dark') {
        this.themeQuoteText.innerHTML = `&ldquo;ARISE. Conquer the darkness, awaken your true power, and rule the silent frequencies.&rdquo;`;
        this.themeAuthorText.innerHTML = `— The Shadow Monarch`;
      } else {
        this.themeQuoteText.innerHTML = `&ldquo;Knowledge is the crown of the steadfast. Master the royal signal and conquer every realm.&rdquo;`;
        this.themeAuthorText.innerHTML = `— King of States`;
      }
    }
  }

  switchTab(tabId) {
    this.tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.tabPanes.forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active-tab');
      } else {
        pane.classList.remove('active-tab');
      }
    });

    // Smooth scroll to top of content area on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showHelpGuide(guideKey) {
    const titleElem = document.getElementById('helpGuideTitle');
    const contentElem = document.getElementById('helpGuideBody');

    const guides = {
      'mouse': {
        title: '🖱️ Mouse Morse Typer Guide',
        body: `
          <h4>How to Type Morse with your Mouse:</h4>
          <ul>
            <li><strong>Dual Click (Default):</strong> Left Click triggers a <code>Dot (.)</code>, Right Click triggers a <code>Dash (-)</code>.</li>
            <li><strong>Silence Auto-Commit:</strong> Pausing your clicks for 750ms automatically translates the current dot/dash combination into its English letter! Pausing for 1.8s inserts a word space.</li>
            <li><strong>Single Button Timing Mode:</strong> Switch to this mode in Settings. A short tap (< 200ms) produces a dot, while holding down (>= 200ms) produces a dash!</li>
            <li><strong>Full Customization:</strong> Click <em>Settings</em> to adjust click assignments, dot/dash threshold, letter pause gaps, pitch frequency, and waveforms.</li>
          </ul>
        `
      },
      'keyboard': {
        title: '⌨️ Keyboard Morse Typer Guide',
        body: `
          <h4>How to Type Morse with your Keyboard:</h4>
          <ul>
            <li><strong>Single Key Timing (Default Spacebar):</strong> Tap the Spacebar briefly (< 200ms) for a <code>Dot (.)</code>. Hold the Spacebar longer (>= 200ms) for a <code>Dash (-)</code>.</li>
            <li><strong>Dual-Key Mode:</strong> Press <kbd>J</kbd> for Dot, <kbd>K</kbd> for Dash, and <kbd>Space</kbd> for word break.</li>
            <li><strong>Direct Character Mode:</strong> Directly type <code>.</code> and <code>-</code> and <code>/</code> keys.</li>
            <li><strong>Custom Keybinder:</strong> Open Settings and click "Set Key" to bind any physical key on your keyboard.</li>
          </ul>
        `
      },
      'learn': {
        title: '📖 Learn Morse Code Guide',
        body: `
          <h4>Mnemonic Memory System:</h4>
          <ul>
            <li>Each letter is visually mapped to its Morse shape (e.g. <strong>A</strong> = Arch <code>.-</code>, <strong>B</strong> = Banjo <code>-...</code>, <strong>S</strong> = Snake <code>...</code>).</li>
            <li>Click the speaker icon on any letter card to listen to its audio frequency.</li>
            <li>Click <strong>Practice This Letter</strong> to test your muscle memory in the sandbox!</li>
            <li>Click <strong>View Full Visual Mnemonic Chart</strong> to explore the complete illustration chart.</li>
          </ul>
        `
      },
      'practice': {
        title: '🎯 Dynamic Practice & Quiz Guide',
        body: `
          <h4>Challenge Modes:</h4>
          <ul>
            <li><strong>Morse to Text:</strong> Look at the Morse code and choose the matching letter or word.</li>
            <li><strong>Text to Morse:</strong> View the letter and select the correct dot/dash sequence.</li>
            <li><strong>Audio Listening:</strong> Listen to real-time beeps and identify the signal.</li>
            <li><strong>Interactive Tapping:</strong> Physically tap the dots & dashes into the live buffer box!</li>
            <li><strong>Dynamic Generator:</strong> Questions and confusing distractors are generated procedurally with every round.</li>
          </ul>
        `
      },
      'general': {
        title: '⚡ MorseCode-Typer Overview',
        body: `
          <h4>Welcome to MorseCode-Typer!</h4>
          <p>Created by the King of States. This suite provides real-time translation, mouse & keyboard tapping boards with custom timing, interactive mnemonic learning, and procedural practice tests.</p>
          <p>Toggle between the royal blue light theme and the epic Solo Leveling shadow monarch dark theme using the top-right button.</p>
        `
      }
    };

    const guide = guides[guideKey] || guides['general'];
    if (titleElem) titleElem.textContent = guide.title;
    if (contentElem) contentElem.innerHTML = guide.body;

    if (this.helpModal) {
      this.helpModal.classList.add('open');
    }
  }

  initCanvasAura() {
    const canvas = document.getElementById('manaAuraCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    // Particle system for Solo Leveling mana / sparks
    const particles = [];
    const particleCount = 35;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2 + 0.8,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.8 - 0.2, // floating upwards like mana
        alpha: Math.random() * 0.7 + 0.2,
        life: Math.random() * 100
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (this.currentTheme === 'dark') {
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life += 0.5;

          if (p.y < 0) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;

          const glowAlpha = Math.sin(p.life * 0.05) * 0.4 + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha * glowAlpha * 0.6})`;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#00f0ff';
          ctx.fill();
        });
      }

      requestAnimationFrame(render);
    };

    render();
  }
}

// Toast notification helper
window.showToast = function(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '<i class="fas fa-info-circle"></i>';
  if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
  if (type === 'error') icon = '<i class="fas fa-exclamation-triangle"></i>';
  if (type === 'warning') icon = '<i class="fas fa-bell"></i>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3200);
};

window.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
