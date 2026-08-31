/**
 * Morse Code Floating Typer - Content Script
 * Direct Input Injection, Saved Cursor Tracker, Master Power Switch, Web Audio, and Mobile Support
 */

(function () {
  if (window.__morseFloatingTyperLoaded) return;
  window.__morseFloatingTyperLoaded = true;

  const MORSE_DICT = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
    '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
    '/': '-..-.', '!': '-.-.--'
  };

  const REVERSE_DICT = {};
  for (const [k, v] of Object.entries(MORSE_DICT)) {
    REVERSE_DICT[v] = k;
  }

  // Audio Tone Synth
  class FloatingAudioSynth {
    constructor() {
      this.ctx = null;
      this.osc = null;
      this.gain = null;
      this.freq = 700;
      this.vol = 0.25;
      this.muted = false;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    startTone() {
      if (this.muted) return;
      this.init();
      if (!this.ctx || this.osc) return;
      try {
        const now = this.ctx.currentTime;
        this.osc = this.ctx.createOscillator();
        this.gain = this.ctx.createGain();
        this.osc.type = 'sine';
        this.osc.frequency.setValueAtTime(this.freq, now);
        this.gain.gain.setValueAtTime(0, now);
        this.gain.gain.linearRampToValueAtTime(this.vol, now + 0.005);
        this.osc.connect(this.gain);
        this.gain.connect(this.ctx.destination);
        this.osc.start(now);
      } catch (e) {}
    }

    stopTone() {
      if (!this.osc || !this.gain || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setValueAtTime(this.gain.gain.value, now);
        this.gain.gain.linearRampToValueAtTime(0, now + 0.008);
        const o = this.osc;
        this.osc = null;
        setTimeout(() => {
          try { o.stop(); o.disconnect(); } catch (err) {}
        }, 20);
      } catch (e) {}
    }

    playDit() {
      this.startTone();
      setTimeout(() => this.stopTone(), 70);
    }

    playDah() {
      this.startTone();
      setTimeout(() => this.stopTone(), 210);
    }
  }

  const audioSynth = new FloatingAudioSynth();

  // Extension Controller
  class MorseFloatingTyper {
    constructor() {
      this.isEnabled = true;
      this.isOpen = false;
      this.isUppercase = true;
      this.theme = 'dark';
      this.currentBuffer = '';
      this.consecutiveSlashes = 0;
      this.letterTimer = null;
      this.wordTimer = null;
      this.pressStartTime = 0;
      this.isMouseDown = false;
      this.activeTargetElement = null;
      this.savedCursorPos = null;

      // Settings
      this.config = {
        leftSingle: 'dot',
        leftLong: 'none',
        rightSingle: 'dash',
        rightLong: 'none',
        middleSingle: 'slash',
        longPressThreshold: 200,
        autoCommit: true,       // Auto Character Break on silence gap
        autoSpace: true,        // Auto Word Space on silence gap
        letterTimeout: 750,
        wordTimeout: 1800,
        soundEnabled: true
      };

      this.loadSettings();
      this.initDom();
      this.attachGlobalListeners();
      this.initPowerState();
    }

    loadSettings() {
      try {
        const saved = localStorage.getItem('morse_ext_config_v4');
        if (saved) Object.assign(this.config, JSON.parse(saved));
        const power = localStorage.getItem('morse_power_enabled');
        if (power !== null) this.isEnabled = (power !== 'false');
      } catch (e) {}
    }

    saveSettings() {
      try {
        localStorage.setItem('morse_ext_config_v4', JSON.stringify(this.config));
      } catch (e) {}
    }

    initPowerState() {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['morse_power_enabled'], (res) => {
          if (res.morse_power_enabled !== undefined) {
            this.setPowerState(res.morse_power_enabled);
          }
        });
      }

      // Listen to runtime messages from popup
      if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg.action === 'toggle_power') {
            this.setPowerState(msg.enabled);
          }
        });
      }

      this.setPowerState(this.isEnabled);
    }

    setPowerState(enabled) {
      this.isEnabled = enabled;
      localStorage.setItem('morse_power_enabled', enabled ? 'true' : 'false');
      if (!enabled) {
        if (this.ball) this.ball.style.display = 'none';
        if (this.widget) this.widget.classList.remove('mext-open');
        this.isOpen = false;
      } else {
        if (!this.isOpen && this.ball) {
          this.ball.style.display = 'flex';
        }
      }
    }

    initDom() {
      // Create Floating Ball
      this.ball = document.createElement('div');
      this.ball.id = 'morse-ext-ball';
      this.ball.title = 'Morse Code Floating Typer (Click to open, Drag to move)';
      this.ball.innerHTML = `
        <svg class="mext-ball-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="42" stroke="#ffffff" stroke-width="6" opacity="0.8"/>
          <circle cx="32" cy="50" r="6" fill="#ffffff"/>
          <rect x="44" y="44" width="24" height="12" rx="6" fill="#fbbf24"/>
          <path d="M50 20 A30 30 0 0 1 80 50" stroke="#00f0ff" stroke-width="5" stroke-linecap="round"/>
        </svg>
      `;

      // Create Floating Widget
      this.widget = document.createElement('div');
      this.widget.id = 'morse-ext-widget';
      this.widget.setAttribute('data-mext-theme', this.theme);
      this.widget.innerHTML = `
        <div class="mext-header">
          <div class="mext-brand">
            <span>📡 MORSE TYPER</span>
          </div>
          <div class="mext-header-actions">
            <button class="mext-btn-icon" id="mextCaseToggle" title="Toggle UPPERCASE / lowercase">a/A</button>
            <button class="mext-btn-icon" id="mextSoundToggle" title="Toggle Sound">🔊</button>
            <button class="mext-btn-icon" id="mextSettingsToggle" title="Settings & Keybindings">⚙️</button>
            <button class="mext-btn-icon" id="mextPowerOffBtn" title="Turn OFF Floating Assistant" style="color: #ef4444;">⏻</button>
            <button class="mext-btn-icon" id="mextCloseBtn" title="Collapse into Ball">✕</button>
          </div>
        </div>

        <div class="mext-target-bar">
          <span id="mextTargetLabel">Target: None (Click any text field)</span>
          <span id="mextCaseLabel">CAPS</span>
        </div>

        <div class="mext-buffer-row">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="mext-buffer-text" id="mextBufferDisplay">— — —</span>
            <span class="mext-preview-badge" id="mextPreviewBadge"></span>
          </div>
          <svg class="mext-timer-svg" viewBox="0 0 36 36">
            <path class="mext-timer-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="mext-timer-val" id="mextTimerProgress" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
        </div>

        <div class="mext-pad" id="mextClickPad">
          <div class="mext-pad-title">CLICK OR TAP TO TRANSMIT</div>
          <div class="mext-pad-sub" id="mextPadSub">Left: DOT &bull; Right: DASH &bull; (/) Break &bull; (//) Space</div>
        </div>

        <div class="mext-toolbar">
          <button class="mext-btn" id="mextBtnDot" type="button">Dot (•)</button>
          <button class="mext-btn" id="mextBtnDash" type="button">Dash (—)</button>
          <button class="mext-btn" id="mextBtnSlash" type="button">Break (/)</button>
          <button class="mext-btn" id="mextBtnSpace" type="button">Space (//)</button>
          <button class="mext-btn" id="mextBtnBack" type="button">⌫</button>
          <button class="mext-btn" id="mextBtnClear" type="button">🗑</button>
        </div>

        <!-- Full Inline Settings Drawer -->
        <div class="mext-settings-drawer" id="mextSettingsDrawer">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="mext-form-group">
              <label>Left Single Click</label>
              <select class="mext-select" id="mextOptLeftSingle">
                <option value="dot">Dot (.)</option>
                <option value="dash">Dash (-)</option>
                <option value="slash">Letter Break (/)</option>
                <option value="double-slash">Word Space (//)</option>
                <option value="none">Disabled</option>
              </select>
            </div>
            <div class="mext-form-group">
              <label>Left Long Press</label>
              <select class="mext-select" id="mextOptLeftLong">
                <option value="none">Same as Click</option>
                <option value="dash">Dash (-)</option>
                <option value="dot">Dot (.)</option>
                <option value="slash">Letter Break (/)</option>
                <option value="double-slash">Word Space (//)</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="mext-form-group">
              <label>Right Single Click</label>
              <select class="mext-select" id="mextOptRightSingle">
                <option value="dash">Dash (-)</option>
                <option value="dot">Dot (.)</option>
                <option value="slash">Letter Break (/)</option>
                <option value="double-slash">Word Space (//)</option>
                <option value="none">Disabled</option>
              </select>
            </div>
            <div class="mext-form-group">
              <label>Right Long Press</label>
              <select class="mext-select" id="mextOptRightLong">
                <option value="none">Same as Click</option>
                <option value="dash">Dash (-)</option>
                <option value="dot">Dot (.)</option>
                <option value="slash">Letter Break (/)</option>
                <option value="double-slash">Word Space (//)</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="mext-form-group">
              <label>Middle Click Action</label>
              <select class="mext-select" id="mextOptMiddleSingle">
                <option value="slash">Letter Break (/)</option>
                <option value="double-slash">Word Space (//)</option>
                <option value="dot">Dot (.)</option>
                <option value="dash">Dash (-)</option>
                <option value="none">Disabled</option>
              </select>
            </div>
            <div class="mext-form-group">
              <label>Hold Duration (ms)</label>
              <input type="number" class="mext-input" id="mextOptHoldThresh" value="200" min="100" max="600" step="20">
            </div>
          </div>

          <div class="mext-form-group" style="margin-top: 4px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--mext-text); font-weight: 600;">
              <input type="checkbox" id="mextOptAutoCommit" checked>
              <span>Auto character break on silence gap</span>
            </label>
          </div>

          <div class="mext-form-group">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--mext-text); font-weight: 600;">
              <input type="checkbox" id="mextOptAutoSpace" checked>
              <span>Auto word space on pause gap</span>
            </label>
          </div>
        </div>
      `;

      document.documentElement.appendChild(this.ball);
      document.documentElement.appendChild(this.widget);

      this.bindElements();
      this.makeDraggable(this.ball);
      this.makeDraggable(this.widget.querySelector('.mext-header'), this.widget);
    }

    bindElements() {
      // Ball click -> Expand widget
      this.ball.addEventListener('click', (e) => {
        if (this.isDragging) return;
        this.openWidget();
      });

      // Close button -> Collapse to ball
      this.widget.querySelector('#mextCloseBtn').addEventListener('click', () => {
        this.closeWidget();
      });

      // Power Off Button in Header -> Turn off floating assistant
      this.widget.querySelector('#mextPowerOffBtn').addEventListener('click', () => {
        this.setPowerState(false);
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ morse_power_enabled: false });
        }
      });

      // Case Toggle (A/a)
      this.widget.querySelector('#mextCaseToggle').addEventListener('click', () => {
        this.isUppercase = !this.isUppercase;
        const lbl = this.widget.querySelector('#mextCaseLabel');
        const btn = this.widget.querySelector('#mextCaseToggle');
        lbl.textContent = this.isUppercase ? 'CAPS' : 'lower';
        btn.classList.toggle('mext-active', !this.isUppercase);
      });

      // Sound Toggle
      this.widget.querySelector('#mextSoundToggle').addEventListener('click', () => {
        audioSynth.muted = !audioSynth.muted;
        this.widget.querySelector('#mextSoundToggle').textContent = audioSynth.muted ? '🔇' : '🔊';
      });

      // Settings Drawer Toggle
      this.widget.querySelector('#mextSettingsToggle').addEventListener('click', () => {
        const drawer = this.widget.querySelector('#mextSettingsDrawer');
        drawer.classList.toggle('mext-drawer-open');
        this.populateSettings();
      });

      // Pad Interaction
      const pad = this.widget.querySelector('#mextClickPad');
      pad.addEventListener('contextmenu', (e) => e.preventDefault());

      pad.addEventListener('mousedown', (e) => this.handlePadDown(e));
      pad.addEventListener('mouseup', (e) => this.handlePadUp(e));
      pad.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = pad.getBoundingClientRect();
        const relativeX = touch.clientX - rect.left;
        const btnId = (relativeX > rect.width * 0.6) ? 2 : 0;
        this.handlePadDown({ button: btnId });
      }, { passive: false });
      pad.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.handlePadUp({ button: this.activePadButton || 0 });
      }, { passive: false });

      // Quick Toolbar buttons (reliably handle insertion & active target)
      this.widget.querySelector('#mextBtnDot').addEventListener('click', (e) => {
        e.preventDefault();
        this.appendSymbol('.');
        audioSynth.playDit();
        if (this.config.autoCommit) this.startCommitTimer();
      });

      this.widget.querySelector('#mextBtnDash').addEventListener('click', (e) => {
        e.preventDefault();
        this.appendSymbol('-');
        audioSynth.playDah();
        if (this.config.autoCommit) this.startCommitTimer();
      });

      this.widget.querySelector('#mextBtnSlash').addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSlashAction();
      });

      this.widget.querySelector('#mextBtnSpace').addEventListener('click', (e) => {
        e.preventDefault();
        this.commitLetterNow();
        this.insertTextToTarget(' ');
      });

      this.widget.querySelector('#mextBtnBack').addEventListener('click', (e) => {
        e.preventDefault();
        this.handleBackspace();
      });

      this.widget.querySelector('#mextBtnClear').addEventListener('click', (e) => {
        e.preventDefault();
        this.currentBuffer = '';
        this.consecutiveSlashes = 0;
        this.updateBufferUI();
      });

      // Settings fields change listeners
      this.widget.querySelector('#mextOptLeftSingle').addEventListener('change', (e) => {
        this.config.leftSingle = e.target.value;
        this.saveSettings();
        this.updatePadHint();
      });
      this.widget.querySelector('#mextOptLeftLong').addEventListener('change', (e) => {
        this.config.leftLong = e.target.value;
        this.saveSettings();
        this.updatePadHint();
      });
      this.widget.querySelector('#mextOptRightSingle').addEventListener('change', (e) => {
        this.config.rightSingle = e.target.value;
        this.saveSettings();
        this.updatePadHint();
      });
      this.widget.querySelector('#mextOptRightLong').addEventListener('change', (e) => {
        this.config.rightLong = e.target.value;
        this.saveSettings();
        this.updatePadHint();
      });
      this.widget.querySelector('#mextOptMiddleSingle').addEventListener('change', (e) => {
        this.config.middleSingle = e.target.value;
        this.saveSettings();
      });
      this.widget.querySelector('#mextOptHoldThresh').addEventListener('change', (e) => {
        this.config.longPressThreshold = parseInt(e.target.value, 10) || 200;
        this.saveSettings();
      });
      this.widget.querySelector('#mextOptAutoCommit').addEventListener('change', (e) => {
        this.config.autoCommit = e.target.checked;
        this.saveSettings();
      });
      this.widget.querySelector('#mextOptAutoSpace').addEventListener('change', (e) => {
        this.config.autoSpace = e.target.checked;
        this.saveSettings();
      });
    }

    populateSettings() {
      this.widget.querySelector('#mextOptLeftSingle').value = this.config.leftSingle;
      this.widget.querySelector('#mextOptLeftLong').value = this.config.leftLong;
      this.widget.querySelector('#mextOptRightSingle').value = this.config.rightSingle;
      this.widget.querySelector('#mextOptRightLong').value = this.config.rightLong;
      this.widget.querySelector('#mextOptMiddleSingle').value = this.config.middleSingle;
      this.widget.querySelector('#mextOptHoldThresh').value = this.config.longPressThreshold;
      this.widget.querySelector('#mextOptAutoCommit').checked = this.config.autoCommit;
      this.widget.querySelector('#mextOptAutoSpace').checked = this.config.autoSpace;
    }

    updatePadHint() {
      const hint = this.widget.querySelector('#mextPadSub');
      if (!hint) return;
      const fmt = (act) => {
        if (act === 'dot') return 'DOT';
        if (act === 'dash') return 'DASH';
        if (act === 'slash') return 'BREAK (/)';
        if (act === 'double-slash') return 'SPACE (//)';
        return 'OFF';
      };
      hint.textContent = `Left: ${fmt(this.config.leftSingle)} | Right: ${fmt(this.config.rightSingle)} | (/) Break, (//) Space`;
    }

    openWidget() {
      this.ball.style.display = 'none';
      this.widget.classList.add('mext-open');
      this.isOpen = true;
    }

    closeWidget() {
      this.widget.classList.remove('mext-open');
      if (this.isEnabled) {
        this.ball.style.display = 'flex';
      }
      this.isOpen = false;
    }

    attachGlobalListeners() {
      // Track currently focused active text element & cursor position
      const trackFocus = (e) => {
        const target = e.target;
        if (!target) return;
        // Ignore clicks inside our own widget or ball
        if (this.widget.contains(target) || this.ball.contains(target)) return;

        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (isInput) {
          this.activeTargetElement = target;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            const pos = typeof target.selectionStart === 'number' ? target.selectionStart : target.value.length;
            this.savedCursorPos = pos;
          }
          const name = target.getAttribute('placeholder') || target.getAttribute('name') || target.tagName.toLowerCase();
          const lbl = this.widget.querySelector('#mextTargetLabel');
          if (lbl) lbl.textContent = `Target: <${name.slice(0, 18)}>`;
        }
      };

      const trackCursor = (e) => {
        const target = e.target;
        if (!target) return;
        if (target === this.activeTargetElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          if (typeof target.selectionStart === 'number') {
            this.savedCursorPos = target.selectionStart;
          }
        }
      };

      document.addEventListener('focusin', trackFocus, true);
      document.addEventListener('click', trackFocus, true);
      document.addEventListener('keyup', trackCursor, true);
      document.addEventListener('mouseup', trackCursor, true);
    }

    handlePadDown(e) {
      this.isMouseDown = true;
      this.activePadButton = e.button !== undefined ? e.button : 0;
      this.pressStartTime = Date.now();
      this.clearTimers();
      this.widget.querySelector('#mextClickPad').classList.add('mext-pressed');
      audioSynth.startTone();
    }

    handlePadUp(e) {
      if (!this.isMouseDown) return;
      this.isMouseDown = false;
      const duration = Date.now() - this.pressStartTime;
      this.widget.querySelector('#mextClickPad').classList.remove('mext-pressed');
      audioSynth.stopTone();

      const btn = e.button !== undefined ? e.button : this.activePadButton;
      const isLong = duration >= this.config.longPressThreshold;

      let action = 'dot';
      if (btn === 0) { // Left Click
        action = isLong && this.config.leftLong !== 'none' ? this.config.leftLong : this.config.leftSingle;
      } else if (btn === 2) { // Right Click
        action = isLong && this.config.rightLong !== 'none' ? this.config.rightLong : this.config.rightSingle;
      } else if (btn === 1) { // Middle Click
        action = this.config.middleSingle;
      }

      if (action === 'dot') {
        this.appendSymbol('.');
      } else if (action === 'dash') {
        this.appendSymbol('-');
      } else if (action === 'slash') {
        this.handleSlashAction();
      } else if (action === 'double-slash') {
        this.commitLetterNow();
        this.insertTextToTarget(' ');
      }

      if (this.config.autoCommit) {
        this.startCommitTimer();
      }
    }

    appendSymbol(sym) {
      this.currentBuffer += sym;
      this.consecutiveSlashes = 0;
      this.updateBufferUI();
    }

    handleSlashAction() {
      if (this.currentBuffer.length > 0) {
        this.commitLetterNow();
        this.consecutiveSlashes = 1;
      } else if (this.consecutiveSlashes >= 1) {
        this.insertTextToTarget(' ');
        this.consecutiveSlashes = 0;
      } else {
        this.commitLetterNow();
        this.consecutiveSlashes = 1;
      }
    }

    updateBufferUI() {
      const disp = this.widget.querySelector('#mextBufferDisplay');
      const badge = this.widget.querySelector('#mextPreviewBadge');
      if (disp) disp.textContent = this.currentBuffer || '— — —';

      const decoded = REVERSE_DICT[this.currentBuffer];
      if (badge) {
        if (decoded) {
          const char = this.isUppercase ? decoded : decoded.toLowerCase();
          badge.textContent = `[ ${char} ]`;
        } else {
          badge.textContent = '';
        }
      }
    }

    startCommitTimer() {
      this.clearTimers();
      if (!this.config.autoCommit) return;

      this.letterTimer = setTimeout(() => {
        this.commitLetterNow();

        // Only auto space if enabled
        if (this.config.autoSpace) {
          this.wordTimer = setTimeout(() => {
            this.insertTextToTarget(' ');
          }, this.config.wordTimeout - this.config.letterTimeout);
        }
      }, this.config.letterTimeout);

      this.animateProgressRing(this.config.letterTimeout);
    }

    clearTimers() {
      if (this.letterTimer) clearTimeout(this.letterTimer);
      if (this.wordTimer) clearTimeout(this.wordTimer);
      this.letterTimer = null;
      this.wordTimer = null;
      const ring = this.widget.querySelector('#mextTimerProgress');
      if (ring) ring.style.strokeDashoffset = '100';
    }

    animateProgressRing(dur) {
      const ring = this.widget.querySelector('#mextTimerProgress');
      if (!ring) return;
      const start = Date.now();
      const update = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(1, elapsed / dur);
        ring.style.strokeDashoffset = `${100 - progress * 100}`;
        if (progress < 1 && this.letterTimer) requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    }

    commitLetterNow() {
      if (!this.currentBuffer) return;
      const raw = REVERSE_DICT[this.currentBuffer] || '?';
      const finalChar = this.isUppercase ? raw : raw.toLowerCase();

      this.insertTextToTarget(finalChar);
      this.currentBuffer = '';
      this.updateBufferUI();
      const ring = this.widget.querySelector('#mextTimerProgress');
      if (ring) ring.style.strokeDashoffset = '100';
    }

    insertTextToTarget(text) {
      const el = this.activeTargetElement || document.activeElement;
      if (!el || el === document.body) {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(text).catch(() => {});
        return;
      }

      try {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          const val = el.value || '';
          let pos = (typeof this.savedCursorPos === 'number') ? this.savedCursorPos : val.length;
          if (pos > val.length) pos = val.length;
          if (pos < 0) pos = 0;

          // If active element is focused and has valid selectionStart
          if (document.activeElement === el && typeof el.selectionStart === 'number') {
            pos = el.selectionStart;
          }

          el.value = val.slice(0, pos) + text + val.slice(pos);
          this.savedCursorPos = pos + text.length;

          try {
            el.selectionStart = el.selectionEnd = this.savedCursorPos;
          } catch (err) {}

          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.isContentEditable) {
          el.focus();
          document.execCommand('insertText', false, text);
        }
      } catch (e) {}
    }

    handleBackspace() {
      // 1. If Morse symbol buffer has symbols, delete last dot/dash
      if (this.currentBuffer.length > 0) {
        this.currentBuffer = this.currentBuffer.slice(0, -1);
        this.updateBufferUI();
        return;
      }

      // 2. Else delete previous character in active text field at saved cursor pos
      const el = this.activeTargetElement || document.activeElement;
      if (!el || el === document.body) return;

      try {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          const val = el.value || '';
          let pos = (typeof this.savedCursorPos === 'number') ? this.savedCursorPos : val.length;
          if (pos > val.length) pos = val.length;
          if (pos <= 0) return;

          if (document.activeElement === el && typeof el.selectionStart === 'number' && el.selectionStart > 0) {
            pos = el.selectionStart;
          }

          el.value = val.slice(0, pos - 1) + val.slice(pos);
          this.savedCursorPos = pos - 1;

          try {
            el.selectionStart = el.selectionEnd = this.savedCursorPos;
          } catch (err) {}

          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.isContentEditable) {
          el.focus();
          document.execCommand('delete', false, null);
        }
      } catch (e) {}
    }

    makeDraggable(handleElem, moveElem = null) {
      const target = moveElem || handleElem;
      let startX = 0, startY = 0, initialX = 0, initialY = 0;
      this.isDragging = false;

      const onStart = (e) => {
        // Ignore clicks on control buttons inside header
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        this.isDragging = false;
        const evt = e.touches ? e.touches[0] : e;
        startX = evt.clientX;
        startY = evt.clientY;
        const rect = target.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
      };

      const onMove = (e) => {
        const evt = e.touches ? e.touches[0] : e;
        const dx = evt.clientX - startX;
        const dy = evt.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this.isDragging = true;
          if (e.cancelable) e.preventDefault();
        }
        if (this.isDragging) {
          target.style.left = `${initialX + dx}px`;
          target.style.top = `${initialY + dy}px`;
          target.style.bottom = 'auto';
          target.style.right = 'auto';
        }
      };

      const onEnd = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      };

      handleElem.addEventListener('mousedown', onStart);
      handleElem.addEventListener('touchstart', onStart, { passive: true });
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new MorseFloatingTyper());
  } else {
    new MorseFloatingTyper();
  }
})();
