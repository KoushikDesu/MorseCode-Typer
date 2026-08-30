/**
 * Live Real-Time Bidirectional Translator Controller
 */

class MorseTranslatorController {
  constructor() {
    this.textInput = document.getElementById('translatorTextInput');
    this.morseInput = document.getElementById('translatorMorseInput');
    this.playBtn = document.getElementById('translatorPlayBtn');
    this.playMorseBoxBtn = document.getElementById('playMorseBoxBtn');
    this.wpmSlider = document.getElementById('translatorWpm');
    this.wpmValueDisplay = document.getElementById('translatorWpmVal');
    this.copyTextBtn = document.getElementById('copyTextBtn');
    this.copyMorseBtn = document.getElementById('copyMorseBtn');
    this.clearBtn = document.getElementById('clearTranslatorBtn');
    this.speakTextBtn = document.getElementById('speakTextBtn');
    this.statusIndicator = document.getElementById('translatorStatus');

    this.isTranslating = false;
    this.isPlaying = false;
    this.wpm = 18;

    this.init();
  }

  init() {
    if (!this.textInput || !this.morseInput) return;

    // Text Input Listener -> Updates Morse
    this.textInput.addEventListener('input', () => {
      if (this.isTranslating) return;
      this.isTranslating = true;
      const text = this.textInput.value;
      this.morseInput.value = MorseCore.textToMorse(text);
      this.updateStats();
      this.isTranslating = false;
    });

    // Morse Input Listener -> Updates Text
    this.morseInput.addEventListener('input', () => {
      if (this.isTranslating) return;
      this.isTranslating = true;
      const morse = this.morseInput.value;
      this.textInput.value = MorseCore.morseToText(morse);
      this.updateStats();
      this.isTranslating = false;
    });

    // WPM Slider
    if (this.wpmSlider) {
      this.wpmSlider.addEventListener('input', (e) => {
        this.wpm = parseInt(e.target.value, 10);
        if (this.wpmValueDisplay) {
          this.wpmValueDisplay.textContent = `${this.wpm} WPM`;
        }
      });
    }

    // Play / Stop Audio Sequence from main button
    if (this.playBtn) {
      this.playBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.togglePlayback();
      });
    }

    // Play Audio Sequence from the dedicated Morse Box Speaker Icon
    if (this.playMorseBoxBtn) {
      this.playMorseBoxBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.togglePlayback();
      });
    }

    // Copy Text
    if (this.copyTextBtn) {
      this.copyTextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.copyToClipboard(this.textInput.value, 'Text copied to clipboard!');
      });
    }

    // Copy Morse
    if (this.copyMorseBtn) {
      this.copyMorseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.copyToClipboard(this.morseInput.value, 'Morse code copied to clipboard!');
      });
    }

    // Clear Both
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearTranslator();
      });
    }

    // Speak Text (Text-to-Speech)
    if (this.speakTextBtn) {
      this.speakTextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const text = this.textInput.value.trim();
        if (!text) {
          window.showToast('Nothing to speak', 'warning');
          return;
        }
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.95;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
          window.showToast('Speaking text...', 'info');
        } else {
          window.showToast('Speech synthesis not supported in your browser', 'error');
        }
      });
    }

    // Set Default Sample Text to 'WELCOME WARRIOR'
    this.setDefaultText();
  }

  setDefaultText() {
    const defaultText = 'WELCOME WARRIOR';
    this.textInput.value = defaultText;
    this.morseInput.value = MorseCore.textToMorse(defaultText);
    this.updateStats();
  }

  clearTranslator() {
    this.stopPlayback();
    this.textInput.value = '';
    this.morseInput.value = '';
    this.updateStats();
    this.textInput.focus();
    window.showToast('Translator cleared', 'info');
  }

  updateStats() {
    const textChars = this.textInput ? this.textInput.value.length : 0;
    const morseSymbols = this.morseInput ? this.morseInput.value.replace(/\s+/g, '').length : 0;
    const statsElem = document.getElementById('translatorStats');
    if (statsElem) {
      statsElem.textContent = `${textChars} Characters | ${morseSymbols} Morse Signals`;
    }
  }

  togglePlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    const morse = this.morseInput.value.trim();
    if (!morse) {
      window.showToast('Please type text or Morse code first', 'warning');
      return;
    }

    this.isPlaying = true;
    if (this.playBtn) {
      this.playBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Audio';
      this.playBtn.classList.add('playing-pulse');
    }
    if (this.playMorseBoxBtn) {
      this.playMorseBoxBtn.innerHTML = '<i class="fas fa-stop"></i>';
      this.playMorseBoxBtn.style.color = 'var(--danger)';
      this.playMorseBoxBtn.title = 'Stop Morse Audio';
    }
    if (this.statusIndicator) {
      this.statusIndicator.textContent = 'Transmitting Audio Signal...';
      this.statusIndicator.classList.add('active');
    }

    window.morseAudio.playMorseSequence(
      morse,
      this.wpm,
      (idx, symbol) => {
        // Highlighting or progress
      },
      () => {
        this.stopPlayback();
      }
    );
  }

  stopPlayback() {
    this.isPlaying = false;
    window.morseAudio.stopSequence();
    if (this.playBtn) {
      this.playBtn.innerHTML = '<i class="fas fa-play"></i> Play Morse Tone';
      this.playBtn.classList.remove('playing-pulse');
    }
    if (this.playMorseBoxBtn) {
      this.playMorseBoxBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
      this.playMorseBoxBtn.style.color = '';
      this.playMorseBoxBtn.title = 'Play Morse Audio';
    }
    if (this.statusIndicator) {
      this.statusIndicator.textContent = 'Ready';
      this.statusIndicator.classList.remove('active');
    }
  }

  copyToClipboard(content, message) {
    if (!content) {
      window.showToast('Nothing to copy', 'warning');
      return;
    }
    navigator.clipboard.writeText(content).then(() => {
      window.showToast(message, 'success');
    }).catch(() => {
      window.showToast('Failed to copy', 'error');
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.morseTranslator = new MorseTranslatorController();
});
