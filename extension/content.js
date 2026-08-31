/**
 * Morse Code Floating Typer - Content Script
 * Direct Input Injection, Draggable Floating Widget, Web Audio, and Mobile Support
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

      // Settings
      this.config = {
        leftSingle: 'dot',
        leftLong: 'none',
        rightSingle: 'dash',
        rightLong: 'none',
        middleSingle: 'slash',
        longPressThreshold: 200,
        autoCommit: true,
        autoSpace: true,
        letterTimeout: 750,
        wordTimeout: 1800,
        soundEnabled: true
      };

      this.loadSettings();
      this.initDom();
      this.attachGlobalListeners();
    }

    loadSettings() {
      try {
        const saved = localStorage.getItem('morse_ext_config');
        if (saved) Object.assign(this.config, JSON.parse(saved));
      } catch (e) {}
    }

    saveSettings() {
      try {
        localStorage.setItem('morse_ext_config', JSON.stringify(this.config));
      } catch (e) {}
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
            <button class="mext-btn-icon" id="mextHideKbToggle" title="Hide Mobile OS Keyboard">⌨️</button>
            <button class="mext-btn-icon" id="mextSettingsToggle" title="Settings">⚙️</button>
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
          <button class="mext-btn" id="mextBtnDot">Dot (•)</button>
          <button class="mext-btn" id="mextBtnDash">Dash (—)</button>
          <button class="mext-btn" id="mextBtnSlash">Break (/)</button>
          <button class="mext-btn" id="mextBtnSpace">Space (//)</button>
          <button class="mext-btn" id="mextBtnBack">⌫</button>
          <button class="mext-btn" id="mextBtnClear">🗑</button>
        </div>

        <!-- Inline Settings Drawer -->
        <div class="mext-settings-drawer" id="mextSettingsDrawer">
          <div class="mext-form-group">
            <label>Left Click Action</label>
            <select class="mext-select" id="mextOptLeftSingle">
              <option value="dot">Dot (.)</option>
              <option value="dash">Dash (-)</option>
              <option value="slash">Letter Break (/)</option>
              <option value="double-slash">Word Space (//)</option>
            </select>
          </div>
          <div class="mext-form-group">
            <label>Right Click Action</label>
            <select class="mext-select" id="mextOptRightSingle">
              <option value="dash">Dash (-)</option>
              <option value="dot">Dot (.)</option>
              <option value="slash">Letter Break (/)</option>
              <option value="double-slash">Word Space (//)</option>
            </select>
          </div>
          <div class="mext-form-group">
            <label>Long Press Hold (Right/Left)</label>
            <select class="mext-select" id="mextOptRightLong">
              <option value="none">Disabled (Same as click)</option>
              <option value="dash">Dash (-)</option>
              <option value="slash">Letter Break (/)</option>
              <option value="double-slash">Word Space (//)</option>
            </select>
          </div>
          <div class="mext-form-group">
            <label>
              <input type="checkbox" id="mextOptAutoSpace" checked> Auto-space on pause (Disable if manual space assigned)
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

      // Hide Mobile OS Keyboard Toggle
      this.widget.querySelector('#mextHideKbToggle').addEventListener('click', () => {
        if (this.activeTargetElement) {
          if (this.activeTargetElement.inputMode === 'none') {
            this.activeTargetElement.inputMode = 'text';
            this.widget.querySelector('#mextHideKbToggle').classList.remove('mext-active');
          } else {
            this.activeTargetElement.inputMode = 'none';
            this.widget.querySelector('#mextHideKbToggle').classList.add('mext-active');
          }
        }
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
        this.handlePadDown({ button: 0 });
      }, { passive: false });
      pad.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.handlePadUp({ button: 0 });
      }, { passive: false });

      // Quick Toolbar buttons
      this.widget.querySelector('#mextBtnDot').addEventListener('click', () => {
        this.appendSymbol('.');
        audioSynth.playDit();
        if (this.config.autoCommit) this.startCommitTimer();
      });
      this.widget.querySelector('#mextBtnDash').addEventListener('click', () => {
        this.appendSymbol('-');
        audioSynth.playDah();
        if (this.config.autoCommit) this.startCommitTimer();
      });
      this.widget.querySelector('#mextBtnSlash').addEventListener('click', () => {
        this.handleSlashAction();
      });
      this.widget.querySelector('#mextBtnSpace').addEventListener('click', () => {
        this.commitLetterNow();
        this.insertTextToTarget(' ');
      });
      this.widget.querySelector('#mextBtnBack').addEventListener('click', () => {
        this.handleBackspace();
      });
      this.widget.querySelector('#mextBtnClear').addEventListener('click', () => {
        this.currentBuffer = '';
        this.updateBufferUI();
      });

      // Settings fields change listeners
      this.widget.querySelector('#mextOptLeftSingle').addEventListener('change', (e) => {
        this.config.leftSingle = e.target.value;
        this.saveSettings();
      });
      this.widget.querySelector('#mextOptRightSingle').addEventListener('change', (e) => {
        this.config.rightSingle = e.target.value;
        this.saveSettings();
      });
      this.widget.querySelector('#mextOptRightLong').addEventListener('change', (e) => {
        this.config.rightLong = e.target.value;
        this.saveSettings();
      });
      this.widget.querySelector('#mextOptAutoSpace').addEventListener('change', (e) => {
        this.config.autoSpace = e.target.checked;
        this.saveSettings();
      });
    }

    populateSettings() {
      this.widget.querySelector('#mextOptLeftSingle').value = this.config.leftSingle;
      this.widget.querySelector('#mextOptRightSingle').value = this.config.rightSingle;
      this.widget.querySelector('#mextOptRightLong').value = this.config.rightLong;
      this.widget.querySelector('#mextOptAutoSpace').checked = this.config.autoSpace;
    }

    openWidget() {
      this.ball.style.display = 'none';
      this.widget.classList.add('mext-open');
      this.isOpen = true;
    }

    closeWidget() {
      this.widget.classList.remove('mext-open');
      this.ball.style.display = 'flex';
      this.isOpen = false;
    }

    attachGlobalListeners() {
      // Track currently focused active text element
      const trackFocus = (e) => {
        const target = e.target;
        if (!target) return;
        // Ignore clicks inside our own widget
        if (this.widget.contains(target) || this.ball.contains(target)) return;

        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (isInput) {
          this.activeTargetElement = target;
          const name = target.getAttribute('placeholder') || target.getAttribute('name') || target.tagName.toLowerCase();
          const lbl = this.widget.querySelector('#mextTargetLabel');
          if (lbl) lbl.textContent = `Target: <${name}>`;
        }
      };

      document.addEventListener('focusin', trackFocus, true);
      document.addEventListener('click', trackFocus, true);
    }

    handlePadDown(e) {
      this.isMouseDown = true;
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

      const btn = e.button !== undefined ? e.button : 0;
      const isLong = duration >= this.config.longPressThreshold;

      let action = 'dot';
      if (btn === 0) {
        action = isLong && this.config.leftLong !== 'none' ? this.config.leftLong : this.config.leftSingle;
      } else if (btn === 2) {
        action = isLong && this.config.rightLong !== 'none' ? this.config.rightLong : this.config.rightSingle;
      } else if (btn === 1) {
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
      this.letterTimer = setTimeout(() => {
        this.commitLetterNow();

        // Only auto space if enabled and not disabled by manual space preference
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

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const start = el.selectionStart || el.value.length;
        const end = el.selectionEnd || el.value.length;
        el.value = el.value.slice(0, start) + text + el.value.slice(end);
        el.selectionStart = el.selectionEnd = start + text.length;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.isContentEditable) {
        document.execCommand('insertText', false, text);
      }
    }

    handleBackspace() {
      if (this.currentBuffer.length > 0) {
        this.currentBuffer = this.currentBuffer.slice(0, -1);
        this.updateBufferUI();
        return;
      }

      const el = this.activeTargetElement || document.activeElement;
      if (!el) return;

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const start = el.selectionStart;
        if (start > 0) {
          el.value = el.value.slice(0, start - 1) + el.value.slice(start);
          el.selectionStart = el.selectionEnd = start - 1;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else if (el.isContentEditable) {
        document.execCommand('delete', false, null);
      }
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
