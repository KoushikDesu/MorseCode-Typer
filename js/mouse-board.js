/**
 * Mouse Morse Typer Engine & Board Controller (Card 1)
 * Supports full per-button custom single click & long press mapping:
 * e.g. Left Click: / (Break), Right Single Click: . (Dot), Right Long Press: - (Dash)
 * Single / = Letter Break, Double // = Word Space
 */

class MouseMorseBoardController {
  constructor() {
    this.pad = document.getElementById('mouseClickPad');
    this.bufferDisplay = document.getElementById('mouseBufferDisplay');
    this.bufferCharPreview = document.getElementById('mouseCharPreview');
    this.outputBox = document.getElementById('mouseDecodedOutput');
    this.progressRing = document.getElementById('mouseTimerProgress');
    this.padHint = document.getElementById('mousePadInstructionHint');
    this.settingsModal = document.getElementById('mouseSettingsModal');
    this.openSettingsBtn = document.getElementById('openMouseSettingsBtn');
    this.closeSettingsBtn = document.getElementById('closeMouseSettingsBtn');

    // Controls on the decoded output box
    this.copyBtn = document.getElementById('copyMouseOutputBtn');
    this.clearBtn = document.getElementById('clearMouseOutputBtn');
    this.backspaceBtn = document.getElementById('backspaceMouseBtn');
    this.spaceBtn = document.getElementById('spaceMouseBtn');
    this.slashBtn = document.getElementById('slashMouseBtn');
    this.speakBtn = document.getElementById('speakMouseBtn');
    this.playAudioBtn = document.getElementById('playMouseAudioBtn');

    // Configuration state
    this.config = {
      presetMode: 'dual-click', // 'dual-click', 'single-button', 'custom'
      longPressThreshold: 200, // ms to trigger long press

      // Left Button
      leftSingle: 'dot',       // 'dot', 'dash', 'slash', 'double-slash', 'none'
      leftLong: 'none',        // 'dash', 'dot', 'slash', 'double-slash', 'none'

      // Right Button
      rightSingle: 'dash',     // 'dash', 'dot', 'slash', 'double-slash', 'none'
      rightLong: 'none',       // 'dash', 'dot', 'slash', 'double-slash', 'none'

      // Middle Button
      middleSingle: 'slash',   // 'slash', 'double-slash', 'dot', 'dash', 'none'
      middleLong: 'none',

      autoCommit: true,
      letterTimeout: 750,      // ms
      wordTimeout: 1800,       // ms
      frequency: 700,
      soundVolume: 0.3,
      toneWave: 'sine'
    };

    this.currentMorseBuffer = '';
    this.consecutiveSlashes = 0;
    this.letterTimer = null;
    this.wordTimer = null;
    this.pressStartTime = 0;
    this.activeButton = null;
    this.isMouseDown = false;
    this.animationFrame = null;

    this.loadSavedConfig();
    this.init();
  }

  loadSavedConfig() {
    try {
      const saved = localStorage.getItem('morse_mouse_config_v3');
      if (saved) {
        this.config = Object.assign(this.config, JSON.parse(saved));
      }
    } catch (e) {}
  }

  saveConfig() {
    try {
      localStorage.setItem('morse_mouse_config_v3', JSON.stringify(this.config));
    } catch (e) {}
  }

  init() {
    if (!this.pad) return;

    // Prevent default context menu on pad
    this.pad.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Mouse events on pad
    this.pad.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.pad.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    window.addEventListener('mouseup', (e) => {
      if (this.isMouseDown) this.handleMouseUp(e);
    });

    // Touch events for mobile
    this.pad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.pad.getBoundingClientRect();
      const relativeX = touch.clientX - rect.left;
      // If tapped on the right 40% of pad on mobile, act as Right button
      const buttonId = (relativeX > rect.width * 0.6) ? 2 : 0;
      this.handleMouseDown({ button: buttonId, clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });

    this.pad.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleMouseUp({ button: this.activeButton });
    }, { passive: false });

    // Output Box Action Buttons
    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
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
      this.clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearAll();
        window.showToast('Mouse board cleared', 'info');
      });
    }

    if (this.backspaceBtn) {
      this.backspaceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleBackspace();
      });
    }

    if (this.spaceBtn) {
      this.spaceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.commitLetterNow();
        this.commitWordSpace();
      });
    }

    if (this.slashBtn) {
      this.slashBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSlashAction();
      });
    }

    if (this.speakBtn) {
      this.speakBtn.addEventListener('click', (e) => {
        e.preventDefault();
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
      this.playAudioBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const text = this.outputBox.value.trim();
        if (!text) return;
        const morse = MorseCore.textToMorse(text);
        window.morseAudio.playMorseSequence(morse, 18);
      });
    }

    this.bindSettingsModal();
    this.updatePadInstructionHint();
  }

  handleMouseDown(e) {
    this.isMouseDown = true;
    this.activeButton = e.button !== undefined ? e.button : 0;
    this.pressStartTime = Date.now();
    this.clearCommitTimers();
    this.pad.classList.add('active-pressed');

    this.createRipple(e);

    window.morseAudio.setFrequency(this.config.frequency);
    window.morseAudio.setVolume(this.config.soundVolume);
    window.morseAudio.setWaveType(this.config.toneWave);
    window.morseAudio.startTone();
  }

  handleMouseUp(e) {
    if (!this.isMouseDown) return;
    this.isMouseDown = false;
    const duration = Date.now() - this.pressStartTime;
    const btn = (e.button !== undefined && e.button !== null) ? e.button : this.activeButton;
    this.pad.classList.remove('active-pressed');
    window.morseAudio.stopTone();

    const isLongPress = duration >= this.config.longPressThreshold;

    let action = 'none';

    if (btn === 0) { // Left Click
      action = isLongPress && this.config.leftLong !== 'none' ? this.config.leftLong : this.config.leftSingle;
    } else if (btn === 2) { // Right Click
      action = isLongPress && this.config.rightLong !== 'none' ? this.config.rightLong : this.config.rightSingle;
    } else if (btn === 1) { // Middle Click
      action = isLongPress && this.config.middleLong !== 'none' ? this.config.middleLong : this.config.middleSingle;
    }

    this.executeAction(action, isLongPress);

    if (this.config.autoCommit) {
      this.startCommitTimer();
    }
  }

  executeAction(action, isLongPress = false) {
    if (navigator.vibrate) {
      if (action === 'dot') navigator.vibrate(25);
      else if (action === 'dash') navigator.vibrate(60);
      else if (action === 'slash') navigator.vibrate(40);
      else if (action === 'double-slash' || action === 'space') navigator.vibrate([30, 30, 30]);
    }

    if (action === 'dot') {
      this.appendSymbol('.');
      this.consecutiveSlashes = 0;
    } else if (action === 'dash') {
      this.appendSymbol('-');
      this.consecutiveSlashes = 0;
    } else if (action === 'slash') {
      this.handleSlashAction();
    } else if (action === 'double-slash' || action === 'space') {
      this.commitLetterNow();
      this.commitWordSpace();
      this.consecutiveSlashes = 0;
      window.showToast('Word Space (//)', 'info');
    }
  }

  /**
   * Slash Logic:
   * 1st click of / = Letter Break (commits current buffer)
   * 2nd consecutive click of / = Double Slash // = Word Space
   */
  handleSlashAction() {
    if (this.currentMorseBuffer.length > 0) {
      this.commitLetterNow();
      this.consecutiveSlashes = 1;
      window.showToast('Letter Break (/)', 'info');
    } else if (this.consecutiveSlashes >= 1) {
      this.commitWordSpace();
      this.consecutiveSlashes = 0;
      window.showToast('Word Space (//)', 'info');
    } else {
      this.commitLetterNow();
      this.consecutiveSlashes = 1;
      window.showToast('Letter Break (/)', 'info');
    }
  }

  appendSymbol(sym) {
    this.currentMorseBuffer += sym;
    this.consecutiveSlashes = 0;
    this.updateBufferUI();
    this.pulsePad(sym);
  }

  pulsePad(sym) {
    this.pad.classList.add(sym === '.' ? 'pulse-dot' : 'pulse-dash');
    setTimeout(() => {
      this.pad.classList.remove('pulse-dot', 'pulse-dash');
    }, 150);
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
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
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
        this.animationFrame = requestAnimationFrame(update);
      }
    };
    this.animationFrame = requestAnimationFrame(update);
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
    this.consecutiveSlashes = 0;
  }

  clearAll() {
    this.clearCommitTimers();
    this.currentMorseBuffer = '';
    this.consecutiveSlashes = 0;
    this.updateBufferUI();
    if (this.outputBox) this.outputBox.value = '';
  }

  flashCommitAnimation(letter) {
    const flashElem = document.getElementById('mouseCommitFlash');
    if (flashElem) {
      flashElem.textContent = letter;
      flashElem.classList.add('flash-active');
      setTimeout(() => flashElem.classList.remove('flash-active'), 300);
    }
  }

  createRipple(e) {
    if (!this.pad) return;
    const rect = this.pad.getBoundingClientRect();
    const x = (e.clientX || (rect.left + rect.width / 2)) - rect.left;
    const y = (e.clientY || (rect.top + rect.height / 2)) - rect.top;

    const ripple = document.createElement('span');
    ripple.className = 'click-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    this.pad.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  updatePadInstructionHint() {
    if (!this.padHint) return;
    const formatAction = (act) => {
      if (act === 'dot') return 'DOT (.)';
      if (act === 'dash') return 'DASH (-)';
      if (act === 'slash') return 'BREAK (/)';
      if (act === 'double-slash' || act === 'space') return 'SPACE (//)';
      return 'NONE';
    };

    const lText = `Left: ${formatAction(this.config.leftSingle)}` + (this.config.leftLong !== 'none' ? ` (Hold: ${formatAction(this.config.leftLong)})` : '');
    const rText = `Right: ${formatAction(this.config.rightSingle)}` + (this.config.rightLong !== 'none' ? ` (Hold: ${formatAction(this.config.rightLong)})` : '');
    this.padHint.textContent = `${lText} | ${rText} | (/) = Break, (//) = Space`;
  }

  bindSettingsModal() {
    if (this.openSettingsBtn) {
      this.openSettingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.populateSettingsForm();
        if (this.settingsModal) this.settingsModal.classList.add('open');
      });
    }

    if (this.closeSettingsBtn) {
      this.closeSettingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.settingsModal) this.settingsModal.classList.remove('open');
      });
    }

    const saveBtn = document.getElementById('saveMouseSettingsBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveSettingsFromForm();
        if (this.settingsModal) this.settingsModal.classList.remove('open');
        this.updatePadInstructionHint();
        window.showToast('Mouse Options Saved!', 'success');
      });
    }

    // Quick Preset buttons in Settings Modal
    const presetSelect = document.getElementById('mousePresetSelect');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        this.applyPreset(e.target.value);
      });
    }
  }

  applyPreset(presetName) {
    if (presetName === 'dual-click') {
      document.getElementById('mouseLeftSingle').value = 'dot';
      document.getElementById('mouseLeftLong').value = 'none';
      document.getElementById('mouseRightSingle').value = 'dash';
      document.getElementById('mouseRightLong').value = 'none';
      document.getElementById('mouseMiddleSingle').value = 'slash';
    } else if (presetName === 'single-button-right-hold') {
      document.getElementById('mouseLeftSingle').value = 'slash';
      document.getElementById('mouseLeftLong').value = 'none';
      document.getElementById('mouseRightSingle').value = 'dot';
      document.getElementById('mouseRightLong').value = 'dash';
      document.getElementById('mouseMiddleSingle').value = 'double-slash';
    } else if (presetName === 'single-button-left-hold') {
      document.getElementById('mouseLeftSingle').value = 'dot';
      document.getElementById('mouseLeftLong').value = 'dash';
      document.getElementById('mouseRightSingle').value = 'slash';
      document.getElementById('mouseRightLong').value = 'none';
      document.getElementById('mouseMiddleSingle').value = 'double-slash';
    }
  }

  populateSettingsForm() {
    const leftSingle = document.getElementById('mouseLeftSingle');
    const leftLong = document.getElementById('mouseLeftLong');
    const rightSingle = document.getElementById('mouseRightSingle');
    const rightLong = document.getElementById('mouseRightLong');
    const middleSingle = document.getElementById('mouseMiddleSingle');
    const threshInput = document.getElementById('mouseLongPressThreshInput');
    const letterTimeInput = document.getElementById('mouseLetterTimeInput');
    const wordTimeInput = document.getElementById('mouseWordTimeInput');
    const autoCommitCheck = document.getElementById('mouseAutoCommitCheck');
    const freqInput = document.getElementById('mouseFreqInput');
    const volInput = document.getElementById('mouseVolInput');
    const waveSelect = document.getElementById('mouseWaveSelect');

    if (leftSingle) leftSingle.value = this.config.leftSingle;
    if (leftLong) leftLong.value = this.config.leftLong;
    if (rightSingle) rightSingle.value = this.config.rightSingle;
    if (rightLong) rightLong.value = this.config.rightLong;
    if (middleSingle) middleSingle.value = this.config.middleSingle;
    if (threshInput) threshInput.value = this.config.longPressThreshold;
    if (letterTimeInput) letterTimeInput.value = this.config.letterTimeout;
    if (wordTimeInput) wordTimeInput.value = this.config.wordTimeout;
    if (autoCommitCheck) autoCommitCheck.checked = this.config.autoCommit;
    if (freqInput) freqInput.value = this.config.frequency;
    if (volInput) volInput.value = Math.round(this.config.soundVolume * 100);
    if (waveSelect) waveSelect.value = this.config.toneWave;
  }

  saveSettingsFromForm() {
    this.config.leftSingle = document.getElementById('mouseLeftSingle')?.value || 'dot';
    this.config.leftLong = document.getElementById('mouseLeftLong')?.value || 'none';
    this.config.rightSingle = document.getElementById('mouseRightSingle')?.value || 'dash';
    this.config.rightLong = document.getElementById('mouseRightLong')?.value || 'none';
    this.config.middleSingle = document.getElementById('mouseMiddleSingle')?.value || 'slash';
    this.config.longPressThreshold = parseInt(document.getElementById('mouseLongPressThreshInput')?.value, 10) || 200;
    this.config.letterTimeout = parseInt(document.getElementById('mouseLetterTimeInput')?.value, 10) || 750;
    this.config.wordTimeout = parseInt(document.getElementById('mouseWordTimeInput')?.value, 10) || 1800;
    this.config.autoCommit = document.getElementById('mouseAutoCommitCheck')?.checked ?? true;
    this.config.frequency = parseInt(document.getElementById('mouseFreqInput')?.value, 10) || 700;
    this.config.soundVolume = (parseInt(document.getElementById('mouseVolInput')?.value, 10) || 30) / 100;
    this.config.toneWave = document.getElementById('mouseWaveSelect')?.value || 'sine';

    this.saveConfig();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.mouseMorseBoard = new MouseMorseBoardController();
});
