/**
 * Mouse Morse Typer Engine & Board Controller (Card 1)
 */

class MouseMorseBoardController {
  constructor() {
    this.pad = document.getElementById('mouseClickPad');
    this.bufferDisplay = document.getElementById('mouseBufferDisplay');
    this.bufferCharPreview = document.getElementById('mouseCharPreview');
    this.outputBox = document.getElementById('mouseDecodedOutput');
    this.progressRing = document.getElementById('mouseTimerProgress');
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
      mode: 'dual-click', // 'dual-click', 'single-click-timing', 'custom'
      dualLeft: 'dot',
      dualRight: 'dash',
      dualMiddle: 'slash',
      singleThreshold: 200, // ms for long press (dash)
      customLongPress: 'dash',
      autoCommit: true,
      letterTimeout: 750, // ms
      wordTimeout: 1800, // ms
      frequency: 700,
      soundVolume: 0.3,
      toneWave: 'sine'
    };

    this.currentMorseBuffer = '';
    this.lastActionWasSlash = false;
    this.letterTimer = null;
    this.wordTimer = null;
    this.pressStartTime = 0;
    this.isMouseDown = false;
    this.animationFrame = null;

    this.loadSavedConfig();
    this.init();
  }

  loadSavedConfig() {
    try {
      const saved = localStorage.getItem('morse_mouse_config');
      if (saved) {
        this.config = Object.assign(this.config, JSON.parse(saved));
      }
    } catch (e) {}
  }

  saveConfig() {
    try {
      localStorage.setItem('morse_mouse_config', JSON.stringify(this.config));
    } catch (e) {}
  }

  init() {
    if (!this.pad) return;

    // Prevent context menu on pad
    this.pad.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Mouse events
    this.pad.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.pad.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    window.addEventListener('mouseup', (e) => {
      if (this.isMouseDown) this.handleMouseUp(e);
    });

    // Touch events for mobile
    this.pad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handleMouseDown({ button: 0, clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });

    this.pad.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleMouseUp({ button: 0 });
    }, { passive: false });

    // Output Box Buttons
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
        window.showToast('Mouse board cleared', 'info');
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
  }

  handleMouseDown(e) {
    this.isMouseDown = true;
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
    this.pad.classList.remove('active-pressed');
    window.morseAudio.stopTone();

    const button = e.button !== undefined ? e.button : 0; // 0=left, 1=middle, 2=right

    if (this.config.mode === 'dual-click') {
      if (button === 0) {
        this.appendSymbol('.');
      } else if (button === 2) {
        this.appendSymbol('-');
      } else if (button === 1) {
        this.handleSlashAction();
      }
    } else if (this.config.mode === 'single-click-timing') {
      if (button === 2) {
        // Right click performs slash / space action
        this.handleSlashAction();
      } else {
        if (duration >= this.config.singleThreshold) {
          if (this.config.customLongPress === 'slash') {
            this.handleSlashAction();
          } else if (this.config.customLongPress === 'space') {
            this.commitLetterNow();
            this.commitWordSpace();
          } else {
            this.appendSymbol('-'); // default dash
          }
        } else {
          this.appendSymbol('.');
        }
      }
    } else if (this.config.mode === 'custom') {
      const action = button === 0 ? this.config.dualLeft : (button === 2 ? this.config.dualRight : this.config.dualMiddle);
      this.executeAction(action);
    }

    if (this.config.autoCommit) {
      this.startCommitTimer();
    }
  }

  executeAction(action) {
    if (action === 'dot') {
      this.appendSymbol('.');
    } else if (action === 'dash') {
      this.appendSymbol('-');
    } else if (action === 'slash') {
      this.handleSlashAction();
    } else if (action === 'double-slash' || action === 'space') {
      this.commitLetterNow();
      this.commitWordSpace();
    }
  }

  /**
   * "/" breaks the character, "//" creates a word space
   */
  handleSlashAction() {
    if (this.currentMorseBuffer.length > 0) {
      // First slash: commits the active character
      this.commitLetterNow();
      this.lastActionWasSlash = true;
    } else if (this.lastActionWasSlash) {
      // Second consecutive slash: // -> Word space!
      this.commitWordSpace();
      this.lastActionWasSlash = false;
      window.showToast('Word Space (//)', 'info');
    } else {
      this.commitLetterNow();
      this.lastActionWasSlash = true;
    }
  }

  appendSymbol(sym) {
    this.currentMorseBuffer += sym;
    this.lastActionWasSlash = false;
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
  }

  clearAll() {
    this.clearCommitTimers();
    this.currentMorseBuffer = '';
    this.lastActionWasSlash = false;
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

    const saveBtn = document.getElementById('saveMouseSettingsBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveSettingsFromForm();
        if (this.settingsModal) this.settingsModal.classList.remove('open');
        window.showToast('Mouse Settings Saved', 'success');
      });
    }
  }

  populateSettingsForm() {
    const modeSelect = document.getElementById('mouseModeSelect');
    const singleThreshInput = document.getElementById('mouseSingleThreshInput');
    const customLongPressSelect = document.getElementById('mouseCustomLongPress');
    const letterTimeInput = document.getElementById('mouseLetterTimeInput');
    const wordTimeInput = document.getElementById('mouseWordTimeInput');
    const autoCommitCheck = document.getElementById('mouseAutoCommitCheck');
    const leftActionSelect = document.getElementById('mouseLeftAction');
    const rightActionSelect = document.getElementById('mouseRightAction');
    const middleActionSelect = document.getElementById('mouseMiddleAction');
    const freqInput = document.getElementById('mouseFreqInput');
    const volInput = document.getElementById('mouseVolInput');
    const waveSelect = document.getElementById('mouseWaveSelect');

    if (modeSelect) modeSelect.value = this.config.mode;
    if (singleThreshInput) singleThreshInput.value = this.config.singleThreshold;
    if (customLongPressSelect) customLongPressSelect.value = this.config.customLongPress;
    if (letterTimeInput) letterTimeInput.value = this.config.letterTimeout;
    if (wordTimeInput) wordTimeInput.value = this.config.wordTimeout;
    if (autoCommitCheck) autoCommitCheck.checked = this.config.autoCommit;
    if (leftActionSelect) leftActionSelect.value = this.config.dualLeft;
    if (rightActionSelect) rightActionSelect.value = this.config.dualRight;
    if (middleActionSelect) middleActionSelect.value = this.config.dualMiddle;
    if (freqInput) freqInput.value = this.config.frequency;
    if (volInput) volInput.value = Math.round(this.config.soundVolume * 100);
    if (waveSelect) waveSelect.value = this.config.toneWave;

    this.updateModalFieldVisibility();
    if (modeSelect) {
      modeSelect.onchange = () => this.updateModalFieldVisibility();
    }
  }

  updateModalFieldVisibility() {
    const mode = document.getElementById('mouseModeSelect')?.value;
    const singleGroup = document.getElementById('mouseSingleTimingGroup');
    const customGroup = document.getElementById('mouseCustomActionGroup');

    if (singleGroup) singleGroup.style.display = mode === 'single-click-timing' ? 'block' : 'none';
    if (customGroup) customGroup.style.display = mode === 'custom' ? 'block' : 'none';
  }

  saveSettingsFromForm() {
    this.config.mode = document.getElementById('mouseModeSelect')?.value || 'dual-click';
    this.config.singleThreshold = parseInt(document.getElementById('mouseSingleThreshInput')?.value, 10) || 200;
    this.config.customLongPress = document.getElementById('mouseCustomLongPress')?.value || 'dash';
    this.config.letterTimeout = parseInt(document.getElementById('mouseLetterTimeInput')?.value, 10) || 750;
    this.config.wordTimeout = parseInt(document.getElementById('mouseWordTimeInput')?.value, 10) || 1800;
    this.config.autoCommit = document.getElementById('mouseAutoCommitCheck')?.checked ?? true;
    this.config.dualLeft = document.getElementById('mouseLeftAction')?.value || 'dot';
    this.config.dualRight = document.getElementById('mouseRightAction')?.value || 'dash';
    this.config.dualMiddle = document.getElementById('mouseMiddleAction')?.value || 'slash';
    this.config.frequency = parseInt(document.getElementById('mouseFreqInput')?.value, 10) || 700;
    this.config.soundVolume = (parseInt(document.getElementById('mouseVolInput')?.value, 10) || 30) / 100;
    this.config.toneWave = document.getElementById('mouseWaveSelect')?.value || 'sine';

    this.saveConfig();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.mouseMorseBoard = new MouseMorseBoardController();
});
