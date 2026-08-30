/**
 * Learn Morse Code Interactive Engine (Card 3)
 * Letter-by-Letter Visual Mnemonics & Audio Playback
 */

class MorseLearnController {
  constructor() {
    this.gridContainer = document.getElementById('learnCardsGrid');
    this.filterButtons = document.querySelectorAll('.learn-filter-btn');
    this.searchInput = document.getElementById('learnSearchInput');
    this.viewFullChartBtn = document.getElementById('viewFullChartBtn');
    this.chartModal = document.getElementById('mnemonicChartModal');
    this.closeChartModalBtn = document.getElementById('closeChartModalBtn');

    // Letter Test Sandbox Modal
    this.sandboxModal = document.getElementById('learnSandboxModal');
    this.sandboxTargetChar = document.getElementById('sandboxTargetChar');
    this.sandboxTargetMorse = document.getElementById('sandboxTargetMorse');
    this.sandboxUserBuffer = document.getElementById('sandboxUserBuffer');
    this.sandboxFeedback = document.getElementById('sandboxFeedback');
    this.sandboxTapDotBtn = document.getElementById('sandboxTapDot');
    this.sandboxTapDashBtn = document.getElementById('sandboxTapDash');
    this.sandboxClearBtn = document.getElementById('sandboxClear');
    this.closeSandboxBtn = document.getElementById('closeSandboxBtn');

    this.activeFilter = 'all';
    this.activeSandboxChar = null;
    this.sandboxBuffer = '';

    this.init();
  }

  init() {
    this.renderCards();

    // Filter Buttons
    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.filterButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeFilter = e.currentTarget.getAttribute('data-filter');
        this.renderCards();
      });
    });

    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        this.renderCards();
      });
    }

    // Full Chart Modal
    if (this.viewFullChartBtn && this.chartModal) {
      this.viewFullChartBtn.addEventListener('click', () => {
        this.chartModal.classList.add('open');
      });
    }

    if (this.closeChartModalBtn && this.chartModal) {
      this.closeChartModalBtn.addEventListener('click', () => {
        this.chartModal.classList.remove('open');
      });
    }

    // Sandbox Modal Events
    if (this.closeSandboxBtn && this.sandboxModal) {
      this.closeSandboxBtn.addEventListener('click', () => {
        this.sandboxModal.classList.remove('open');
      });
    }

    if (this.sandboxTapDotBtn) {
      this.sandboxTapDotBtn.addEventListener('click', () => {
        this.appendSandboxSymbol('.');
        window.morseAudio.playDit();
      });
    }

    if (this.sandboxTapDashBtn) {
      this.sandboxTapDashBtn.addEventListener('click', () => {
        this.appendSandboxSymbol('-');
        window.morseAudio.playDah();
      });
    }

    if (this.sandboxClearBtn) {
      this.sandboxClearBtn.addEventListener('click', () => {
        this.sandboxBuffer = '';
        this.updateSandboxUI();
      });
    }
  }

  renderCards() {
    if (!this.gridContainer) return;
    this.gridContainer.innerHTML = '';

    const query = this.searchInput ? this.searchInput.value.trim().toUpperCase() : '';

    const allKeys = Object.keys(MorseCore.MORSE_MAP);

    const filteredKeys = allKeys.filter(char => {
      // Check query
      if (query && !char.includes(query) && !MorseCore.MORSE_MAP[char].includes(query)) {
        return false;
      }

      // Check category filter
      if (this.activeFilter === 'letters') {
        return /^[A-Z]$/.test(char);
      } else if (this.activeFilter === 'numbers') {
        return /^[0-9]$/.test(char);
      } else if (this.activeFilter === 'punctuation') {
        return !/^[A-Z0-9]$/.test(char);
      }
      return true; // 'all'
    });

    if (filteredKeys.length === 0) {
      this.gridContainer.innerHTML = `
        <div class="empty-results">
          <i class="fas fa-search"></i>
          <p>No Morse symbols found for "${query}"</p>
        </div>
      `;
      return;
    }

    filteredKeys.forEach(char => {
      const morse = MorseCore.MORSE_MAP[char];
      const mnemonic = MorseCore.MNEMONICS[char] || { word: '', hint: '', pattern: morse };
      const card = document.createElement('div');
      card.className = 'learn-char-card';
      card.setAttribute('data-char', char);

      // Render Visual Morse Dots & Dashes
      const visualSymbolsHtml = morse.split('').map(s => {
        return `<span class="symbol-pill ${s === '.' ? 'pill-dot' : 'pill-dash'}">${s === '.' ? '•' : '—'}</span>`;
      }).join('');

      card.innerHTML = `
        <div class="card-top">
          <span class="char-badge">${char}</span>
          <button class="play-char-btn" title="Listen to Morse Sound">
            <i class="fas fa-volume-up"></i>
          </button>
        </div>
        <div class="card-morse-row">
          <span class="morse-text">${morse}</span>
          <div class="morse-visual-pills">${visualSymbolsHtml}</div>
        </div>
        ${mnemonic.word ? `
          <div class="mnemonic-section">
            <div class="mnemonic-word"><i class="fas fa-lightbulb"></i> <strong>${mnemonic.word}</strong></div>
            <div class="mnemonic-hint">${mnemonic.hint}</div>
          </div>
        ` : ''}
        <button class="try-char-btn" data-char="${char}" data-morse="${morse}">
          <i class="fas fa-hand-pointer"></i> Practice This Letter
        </button>
      `;

      // Audio click
      const playBtn = card.querySelector('.play-char-btn');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.morseAudio.playMorseSequence(morse, 16);
      });

      // Try letter click
      const tryBtn = card.querySelector('.try-char-btn');
      tryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openSandbox(char, morse);
      });

      this.gridContainer.appendChild(card);
    });
  }

  openSandbox(char, morse) {
    this.activeSandboxChar = char;
    this.activeSandboxMorse = morse;
    this.sandboxBuffer = '';

    if (this.sandboxTargetChar) this.sandboxTargetChar.textContent = char;
    if (this.sandboxTargetMorse) this.sandboxTargetMorse.textContent = morse;
    this.updateSandboxUI();

    if (this.sandboxModal) {
      this.sandboxModal.classList.add('open');
    }
  }

  appendSandboxSymbol(sym) {
    this.sandboxBuffer += sym;
    this.updateSandboxUI();

    // Check match
    if (this.sandboxBuffer === this.activeSandboxMorse) {
      if (this.sandboxFeedback) {
        this.sandboxFeedback.innerHTML = `<span class="correct-text"><i class="fas fa-check-circle"></i> PERFECT MATCH! Excellent!</span>`;
      }
      window.morseAudio.playSuccessSound();
      setTimeout(() => {
        this.sandboxBuffer = '';
        this.updateSandboxUI();
      }, 1200);
    } else if (this.sandboxBuffer.length >= this.activeSandboxMorse.length) {
      if (this.sandboxFeedback) {
        this.sandboxFeedback.innerHTML = `<span class="wrong-text"><i class="fas fa-times-circle"></i> Incorrect. Try again!</span>`;
      }
      window.morseAudio.playErrorSound();
      setTimeout(() => {
        this.sandboxBuffer = '';
        this.updateSandboxUI();
      }, 900);
    }
  }

  updateSandboxUI() {
    if (this.sandboxUserBuffer) {
      this.sandboxUserBuffer.textContent = this.sandboxBuffer || 'Tap Dot or Dash below';
    }
    if (!this.sandboxBuffer && this.sandboxFeedback) {
      this.sandboxFeedback.innerHTML = `<span>Recreate the pattern: <strong>${this.activeSandboxMorse}</strong></span>`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.morseLearn = new MorseLearnController();
});
