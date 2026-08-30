/**
 * Keyboard Morse Typer Engine & Board Controller (Card 2)
 */

class KeyboardMorseBoardController {
  constructor() {
    this.pad = document.getElementById('keyboardActivePad');
    this.bufferDisplay = document.getElementById('keyboardBufferDisplay');
    this.bufferCharPreview = document.getElementById('keyboardCharPreview');
    this.outputBox = document.getElementById('keyboardDecodedOutput');
    this.progressRing = document.getElementById('keyboardTimerProgress');
    this.keyStatusIndicator = document.getElementById('keyboardLiveKeyIndicator');
    this.settingsModal = document.getElementById('keyboardSettingsModal');
    this.openSettingsBtn = document.getElementById('openKeyboardSettingsBtn');
    this.closeSettingsBtn = document.getElementById('closeKeyboardSettingsBtn');

    // Action buttons
    this.copyBtn = document.getElementById('copyKeyboardOutputBtn');
    this.clearBtn = document.getElementById('clearKeyboardOutputBtn');
    this.backspaceBtn = document.getElementById('backspaceKeyboardBtn');
    this.spaceBtn = document.getElementById('spaceKeyboardBtn');
    this.slashBtn = document.getElementById('slashKeyboardBtn');
    this.speakBtn = document.getElementById('speakKeyboardBtn');
    this.playAudioBtn = document.getElementById('playKeyboardAudioBtn');

    // Config defaults
    this.config = {
      mode: 'single-key-timing', // 'single-key-timing', 'dual-key', 'direct-char'
      singleKey: ' ', // Space
      singleThreshold: 200, // ms for dash
      dualDotKey: 'j',
      dualDashKey: 'k',
      dualSlashKey: '/',
      autoCommit: true,
      letterTimeout: 750,
      wordTimeout: 1800,
      frequency: 700,
      soundVolume: 0.3,
      toneWave: 'sine'
    };

    this.currentMorseBuffer = '';
    this.lastActionWasSlash = false;
    this.letterTimer = null;
    this.wordTimer = null;
    this.pressStartTime = 0;
    this.isKeyDown = false;
    this.activeKey = null;
    this.keyListeningTarget = null;

    this.loadSavedConfig();
    this.init();
  }

  loadSavedConfig() {
    try {
      const saved = localStorage.getItem('morse_keyboard_config');
      if (saved) {
        this.config = Object.assign(this.config, JSON.parse(saved));
      }
    } catch (e) {}
  }

  saveConfig() {
    try {
      localStorage.setItem('morse_keyboard_config', JSON.stringify(this.config));
    } catch (e) {}
  }

  init() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    if (this.pad) {
      this.pad.addEventListener('click', () => {
        this.pad.focus();
        this.pad.classList.add('focused-glow');
      });
    }

    // Output Action Buttons
    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', () => {
        const text = this.outputBox.value;
        if (!text) {
          window.showToast('Nothing to copy', 'warning');
          return;
        }
        navigator.clipboard.writeText(text).then(() => {
          window.showToast('Output copied to clipboard!', 'success');
        });
      });
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.clearAll();
        window.showToast('Keyboard board cleared', 'info');
      });
    }

    if (this.backspaceBtn) {
      this.backspaceBtn.addEventListener('click', () => {
        this.handleBackspace();
      });
    }

    if (this.spaceBtn) {
      this.spaceBtn.addEventListener('click', () => {
        this.commitWordSpace();
      });
    }

    if (this.slashBtn) {
      this.slashBtn.addEventListener('click', () => {
        this.handleSlashAction();
      });
    }

    if (this.speakBtn) {
      this.speakBtn.addEventListener('click', () => {
        const text = this.outputBox.value.trim();
        if (!text) return;
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const ut = new SpeechSynthesisUtterance(text);
          window.speechSynthesis.speak(ut);
        }
      });
    }

    if (this.playAudioBtn) {
      this.playAudioBtn.addEventListener('click', () => {
        const text = this.outputBox.value.trim();
        if (!text) return;
        const morse = MorseCore.textToMorse(text);
        window.morseAudio.playMorseSequence(morse, 18);
      });
    }

    this.bindSettingsModal();
    this.updateKeyHintBadge();
  }

  isKeyboardCardActive() {
    const activeElem = document.activeElement;
    if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA') && activeElem !== this.pad) {
      return false;
    }
    const keyboardTab = document.getElementById('tab-keyboard');
    return keyboardTab && keyboardTab.classList.contains('active-tab');
  }

  handleKeyDown(e) {
    if (this.keyListeningTarget) {
      e.preventDefault();
      this.recordKeyBinding(e.key);
      return;
    }

    if (!this.isKeyboardCardActive()) return;

    const key = e.key.toLowerCase();
    const rawKey = e.key;

    // GLOBAL DIRECT KEYS: Always allow typing . and - and / regardless of mode!
    if (rawKey === '.' && this.config.singleKey !== '.') {
      e.preventDefault();
      if (e.repeat) return;
      this.clearCommitTimers();
      this.appendSymbol('.');
      window.morseAudio.playDit();
      this.setPadVisualActive(true, 'DOT (.) DIRECT KEY');
      if (this.config.autoCommit) this.startCommitTimer();
      return;
    }

    if ((rawKey === '-' || rawKey === '_') && this.config.singleKey !== '-') {
      e.preventDefault();
      if (e.repeat) return;
      this.clearCommitTimers();
      this.appendSymbol('-');
      window.morseAudio.playDah();
      this.setPadVisualActive(true, 'DASH (-) DIRECT KEY');
      if (this.config.autoCommit) this.startCommitTimer();
      return;
    }

    if (rawKey === '/') {
      e.preventDefault();
      this.handleSlashAction();
      this.setPadVisualActive(true, 'SLASH (/) BREAK');
      return;
    }

    // Common keys
    if (key === 'backspace') {
      e.preventDefault();
      this.handleBackspace();
      return;
    }

    if (key === 'enter') {
      e.preventDefault();
      this.commitLetterNow();
      this.commitWordSpace();
      return;
    }

    // Mode 1: Single Key Timing Mode (Spacebar default)
    if (this.config.mode === 'single-key-timing') {
      if (rawKey === this.config.singleKey || key === this.config.singleKey.toLowerCase()) {
        e.preventDefault();
        if (this.isKeyDown) return;
        this.isKeyDown = true;
        this.activeKey = rawKey;
        this.pressStartTime = Date.now();
        this.clearCommitTimers();
        this.setPadVisualActive(true, 'HOLDING KEY...');
        window.morseAudio.startTone();
      }
    }

    // Mode 2: Dual-Key Mode
    else if (this.config.mode === 'dual-key') {
      const dotK = this.config.dualDotKey.toLowerCase();
      const dashK = this.config.dualDashKey.toLowerCase();
      const slashK = (this.config.dualSlashKey || '/').toLowerCase();

      if (key === dotK) {
        e.preventDefault();
        if (e.repeat) return;
        this.clearCommitTimers();
        this.appendSymbol('.');
        window.morseAudio.playDit();
        this.setPadVisualActive(true, 'DOT (.)');
        if (this.config.autoCommit) this.startCommitTimer();
      } else if (key === dashK) {
        e.preventDefault();
        if (e.repeat) return;
        this.clearCommitTimers();
        this.appendSymbol('-');
        window.morseAudio.playDah();
        this.setPadVisualActive(true, 'DASH (-)');
        if (this.config.autoCommit) this.startCommitTimer();
      } else if (key === slashK) {
        e.preventDefault();
        this.handleSlashAction();
        this.setPadVisualActive(true, 'SLASH (/) BREAK');
      } else if (key === ' ') {
        e.preventDefault();
        this.commitLetterNow();
        this.commitWordSpace();
      }
    }

    // Mode 3: Direct Char Mode
    else if (this.config.mode === 'direct-char') {
      if (rawKey === ' ') {
        e.preventDefault();
        this.commitLetterNow();
        this.commitWordSpace();
      }
    }
  }

  handleKeyUp(e) {
    if (!this.isKeyboardCardActive()) return;

    if (this.config.mode === 'single-key-timing' && this.isKeyDown) {
      const rawKey = e.key;
      if (rawKey === this.config.singleKey || rawKey.toLowerCase() === this.config.singleKey.toLowerCase()) {
        this.isKeyDown = false;
        window.morseAudio.stopTone();
        const duration = Date.now() - this.pressStartTime;

        if (duration >= this.config.singleThreshold) {
          this.appendSymbol('-');
          this.setPadVisualActive(false, 'DASH (-) RECORDED');
        } else {
          this.appendSymbol('.');
          this.setPadVisualActive(false, 'DOT (.) RECORDED');
        }

        if (this.config.autoCommit) {
          this.startCommitTimer();
        }
      }
    } else {
      this.setPadVisualActive(false, 'READY');
    }
  }

  handleSlashAction() {
    if (this.currentMorseBuffer.length > 0) {
      this.commitLetterNow();
      this.lastActionWasSlash = true;
    } else if (this.lastActionWasSlash) {
      this.commitWordSpace();
      this.lastActionWasSlash = false;
      window.showToast('Word Space (//)', 'info');
    } else {
      this.commitLetterNow();
      this.lastActionWasSlash = true;
    }
  }

  setPadVisualActive(active, text) {
    if (!this.pad) return;
    if (active) {
      this.pad.classList.add('active-pressed');
    } else {
      this.pad.classList.remove('active-pressed');
    }
    if (this.keyStatusIndicator && text) {
      this.keyStatusIndicator.textContent = text;
    }
  }

  appendSymbol(sym) {
    this.currentMorseBuffer += sym;
    this.lastActionWasSlash = false;
    this.updateBufferUI();
    if (this.pad) {
      this.pad.classList.add(sym === '.' ? 'pulse-dot' : 'pulse-dash');
      setTimeout(() => this.pad.classList.remove('pulse-dot', 'pulse-dash'), 150);
    }
  }

  updateBufferUI() {
    if (!this.bufferDisplay) return;
    this.bufferDisplay.textContent = this.currentMorseBuffer || '— — —';
    const decoded = MorseCore.decodeSingleMorse(this.currentMorseBuffer);
    if (this.bufferCharPreview) {
      if (this.currentMorseBuffer) {
        this.bufferCharPreview.textContent = decoded === '?' ? '...' : `[ ${decoded} ]`;
        this.bufferCharPreview.classList.add('visible');
      } else {
        this.bufferCharPreview.textContent = '';
        this.bufferCharPreview.classList.remove('visible');
      }
    }
  }

  startCommitTimer() {
    this.clearCommitTimers();

    this.letterTimer = setTimeout(() => {
      this.commitLetterNow();

      this.wordTimer = setTimeout(() => {
        this.commitWordSpace();
      }, this.config.wordTimeout - this.config.letterTimeout);

    }, this.config.letterTimeout);

    this.animateProgressRing(this.config.letterTimeout);
  }

  clearCommitTimers() {
    if (this.letterTimer) clearTimeout(this.letterTimer);
    if (this.wordTimer) clearTimeout(this.wordTimer);
    this.letterTimer = null;
    this.wordTimer = null;
    if (this.progressRing) {
      this.progressRing.style.strokeDashoffset = '100';
    }
  }

  animateProgressRing(duration) {
    if (!this.progressRing) return;
    const start = Date.now();
    const update = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      this.progressRing.style.strokeDashoffset = `${100 - progress * 100}`;
      if (progress < 1 && this.letterTimer) {
        requestAnimationFrame(update);
      }
    };
    requestAnimationFrame(update);
  }

  commitLetterNow() {
    if (!this.currentMorseBuffer) return;
    const decoded = MorseCore.decodeSingleMorse(this.currentMorseBuffer);
    if (decoded && decoded !== '?') {
      this.appendOutputText(decoded);
      this.flashCommitAnimation(decoded);
    } else if (this.currentMorseBuffer) {
      this.appendOutputText('?');
    }
    this.currentMorseBuffer = '';
    this.updateBufferUI();
    if (this.progressRing) {
      this.progressRing.style.strokeDashoffset = '100';
    }
  }

  commitWordSpace() {
    const currentText = this.outputBox.value;
    if (currentText && !currentText.endsWith(' ')) {
      this.appendOutputText(' ');
    }
  }

  appendOutputText(char) {
    if (!this.outputBox) return;
    this.outputBox.value += char;
    this.outputBox.scrollTop = this.outputBox.scrollHeight;
  }

  handleBackspace() {
    if (this.currentMorseBuffer.length > 0) {
      this.currentMorseBuffer = this.currentMorseBuffer.slice(0, -1);
      this.updateBufferUI();
    } else if (this.outputBox && this.outputBox.value.length > 0) {
      this.outputBox.value = this.outputBox.value.slice(0, -1);
    }
  }

  clearAll() {
    this.clearCommitTimers();
    this.currentMorseBuffer = '';
    this.lastActionWasSlash = false;
    this.updateBufferUI();
    if (this.outputBox) this.outputBox.value = '';
  }

  flashCommitAnimation(letter) {
    const flashElem = document.getElementById('keyboardCommitFlash');
    if (flashElem) {
      flashElem.textContent = letter;
      flashElem.classList.add('flash-active');
      setTimeout(() => flashElem.classList.remove('flash-active'), 300);
    }
  }

  updateKeyHintBadge() {
    const badge = document.getElementById('keyboardKeyHintBadge');
    if (!badge) return;
    if (this.config.mode === 'single-key-timing') {
      const keyName = this.config.singleKey === ' ' ? 'SPACEBAR' : this.config.singleKey.toUpperCase();
      badge.textContent = `Active Key: [ ${keyName} ] (Tap = Dot, Hold = Dash) | Also [ . ] [ - ] [ / ] active`;
    } else if (this.config.mode === 'dual-key') {
      badge.textContent = `Active Keys: Dot [ ${this.config.dualDotKey.toUpperCase()} ] | Dash [ ${this.config.dualDashKey.toUpperCase()} ] | [ / ] Break`;
    } else {
      badge.textContent = `Direct Typing: [ . ] [ - ] [ / ] [ Space ]`;
    }
  }

  bindSettingsModal() {
    if (this.openSettingsBtn) {
      this.openSettingsBtn.addEventListener('click', () => {
        this.populateSettingsForm();
        if (this.settingsModal) this.settingsModal.classList.add('open');
      });
    }

    if (this.closeSettingsBtn) {
      this.closeSettingsBtn.addEventListener('click', () => {
        if (this.settingsModal) this.settingsModal.classList.remove('open');
      });
    }

    document.querySelectorAll('.key-record-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetField = e.currentTarget.getAttribute('data-target');
        this.startListeningForKey(targetField, e.currentTarget);
      });
    });

    const saveBtn = document.getElementById('saveKeyboardSettingsBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveSettingsFromForm();
        if (this.settingsModal) this.settingsModal.classList.remove('open');
        this.updateKeyHintBadge();
        window.showToast('Keyboard Settings Saved', 'success');
      });
    }
  }

  startListeningForKey(field, buttonElem) {
    this.keyListeningTarget = { field, buttonElem };
    buttonElem.textContent = 'PRESS ANY KEY...';
    buttonElem.classList.add('listening');
  }

  recordKeyBinding(keyName) {
    if (!this.keyListeningTarget) return;
    const { field, buttonElem } = this.keyListeningTarget;
    const displayVal = keyName === ' ' ? 'Space' : keyName.toUpperCase();

    const inputElem = document.getElementById(field);
    if (inputElem) {
      inputElem.value = keyName;
    }

    buttonElem.textContent = `Set: ${displayVal}`;
    buttonElem.classList.remove('listening');
    this.keyListeningTarget = null;
    window.showToast(`Bound to "${displayVal}"`, 'info');
  }

  populateSettingsForm() {
    const modeSelect = document.getElementById('keyboardModeSelect');
    const singleKeyInput = document.getElementById('kbSingleKeyInput');
    const threshInput = document.getElementById('kbSingleThreshInput');
    const letterTimeInput = document.getElementById('kbLetterTimeInput');
    const wordTimeInput = document.getElementById('kbWordTimeInput');
    const autoCommitCheck = document.getElementById('kbAutoCommitCheck');
    const dualDotInput = document.getElementById('kbDualDotInput');
    const dualDashInput = document.getElementById('kbDualDashInput');
    const dualSlashInput = document.getElementById('kbDualSlashInput');

    if (modeSelect) modeSelect.value = this.config.mode;
    if (singleKeyInput) singleKeyInput.value = this.config.singleKey;
    if (threshInput) threshInput.value = this.config.singleThreshold;
    if (letterTimeInput) letterTimeInput.value = this.config.letterTimeout;
    if (wordTimeInput) wordTimeInput.value = this.config.wordTimeout;
    if (autoCommitCheck) autoCommitCheck.checked = this.config.autoCommit;
    if (dualDotInput) dualDotInput.value = this.config.dualDotKey;
    if (dualDashInput) dualDashInput.value = this.config.dualDashKey;
    if (dualSlashInput) dualSlashInput.value = this.config.dualSlashKey || '/';

    this.updateModalFieldVisibility();
    if (modeSelect) {
      modeSelect.onchange = () => this.updateModalFieldVisibility();
    }
  }

  updateModalFieldVisibility() {
    const mode = document.getElementById('keyboardModeSelect')?.value;
    const singleGroup = document.getElementById('kbSingleTimingGroup');
    const dualGroup = document.getElementById('kbDualKeyGroup');

    if (singleGroup) singleGroup.style.display = mode === 'single-key-timing' ? 'block' : 'none';
    if (dualGroup) dualGroup.style.display = mode === 'dual-key' ? 'block' : 'none';
  }

  saveSettingsFromForm() {
    this.config.mode = document.getElementById('keyboardModeSelect')?.value || 'single-key-timing';
    this.config.singleKey = document.getElementById('kbSingleKeyInput')?.value || ' ';
    this.config.singleThreshold = parseInt(document.getElementById('kbSingleThreshInput')?.value, 10) || 200;
    this.config.letterTimeout = parseInt(document.getElementById('kbLetterTimeInput')?.value, 10) || 750;
    this.config.wordTimeout = parseInt(document.getElementById('kbWordTimeInput')?.value, 10) || 1800;
    this.config.autoCommit = document.getElementById('kbAutoCommitCheck')?.checked ?? true;
    this.config.dualDotKey = document.getElementById('kbDualDotInput')?.value || 'j';
    this.config.dualDashKey = document.getElementById('kbDualDashInput')?.value || 'k';
    this.config.dualSlashKey = document.getElementById('kbDualSlashInput')?.value || '/';

    this.saveConfig();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.keyboardMorseBoard = new KeyboardMorseBoardController();
});
