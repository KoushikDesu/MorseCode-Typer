/**
 * Practice & Dynamic Procedural Quiz Engine (Card 4)
 * Generates endless dynamic questions with smart confusion distractors
 */

class MorsePracticeController {
  constructor() {
    this.quizModeSelect = document.getElementById('practiceQuizMode');
    this.difficultySelect = document.getElementById('practiceDifficulty');
    this.startQuizBtn = document.getElementById('startQuizBtn');
    this.nextQuestionBtn = document.getElementById('nextQuestionBtn');
    this.skipQuestionBtn = document.getElementById('skipQuestionBtn');

    // Display areas
    this.questionContainer = document.getElementById('quizQuestionContainer');
    this.questionPrompt = document.getElementById('quizQuestionPrompt');
    this.questionSubtitle = document.getElementById('quizQuestionSubtitle');
    this.audioPlayQuestionBtn = document.getElementById('quizAudioPlayBtn');
    this.optionsGrid = document.getElementById('quizOptionsGrid');
    this.interactiveTappingBox = document.getElementById('quizInteractiveTappingBox');
    this.interactiveBuffer = document.getElementById('quizInteractiveBuffer');
    this.interactiveFeedback = document.getElementById('quizInteractiveFeedback');
    this.quizDotBtn = document.getElementById('quizTapDotBtn');
    this.quizDashBtn = document.getElementById('quizTapDashBtn');
    this.quizSpaceBtn = document.getElementById('quizTapSpaceBtn');
    this.quizClearBtn = document.getElementById('quizTapClearBtn');
    this.quizSubmitBtn = document.getElementById('quizTapSubmitBtn');

    // Score & Stats UI
    this.scoreDisplay = document.getElementById('quizScoreVal');
    this.streakDisplay = document.getElementById('quizStreakVal');
    this.highScoreDisplay = document.getElementById('quizHighScoreVal');
    this.accuracyDisplay = document.getElementById('quizAccuracyVal');
    this.rankBadge = document.getElementById('quizRankBadge');

    // State
    this.currentMode = 'morse-to-text'; // 'morse-to-text', 'text-to-morse', 'audio-to-text', 'interactive-tap'
    this.difficulty = 'novice'; // 'novice' (A-Z), 'adept' (A-Z, 0-9), 'master' (Words)
    this.currentQuestion = null;
    this.score = 0;
    this.streak = 0;
    this.highScore = 0;
    this.totalQuestions = 0;
    this.correctAnswers = 0;
    this.isAnswered = false;
    this.interactiveInput = '';

    this.loadStats();
    this.init();
  }

  loadStats() {
    try {
      this.highScore = parseInt(localStorage.getItem('morse_quiz_highscore') || '0', 10);
      if (this.highScoreDisplay) {
        this.highScoreDisplay.textContent = this.highScore;
      }
    } catch (e) {}
  }

  saveStats() {
    try {
      localStorage.setItem('morse_quiz_highscore', this.highScore.toString());
    } catch (e) {}
  }

  init() {
    if (this.quizModeSelect) {
      this.quizModeSelect.addEventListener('change', (e) => {
        this.currentMode = e.target.value;
        this.generateNewQuestion();
      });
    }

    if (this.difficultySelect) {
      this.difficultySelect.addEventListener('change', (e) => {
        this.difficulty = e.target.value;
        this.generateNewQuestion();
      });
    }

    if (this.startQuizBtn) {
      this.startQuizBtn.addEventListener('click', () => {
        this.score = 0;
        this.streak = 0;
        this.totalQuestions = 0;
        this.correctAnswers = 0;
        this.updateStatsUI();
        this.generateNewQuestion();
      });
    }

    if (this.nextQuestionBtn) {
      this.nextQuestionBtn.addEventListener('click', () => {
        this.generateNewQuestion();
      });
    }

    if (this.skipQuestionBtn) {
      this.skipQuestionBtn.addEventListener('click', () => {
        this.streak = 0;
        this.updateStatsUI();
        this.generateNewQuestion();
      });
    }

    if (this.audioPlayQuestionBtn) {
      this.audioPlayQuestionBtn.addEventListener('click', () => {
        if (this.currentQuestion && this.currentQuestion.morse) {
          window.morseAudio.playMorseSequence(this.currentQuestion.morse, 16);
        }
      });
    }

    // Interactive Tap Buttons
    if (this.quizDotBtn) {
      this.quizDotBtn.addEventListener('click', () => {
        this.appendInteractiveSymbol('.');
        window.morseAudio.playDit();
      });
    }

    if (this.quizDashBtn) {
      this.quizDashBtn.addEventListener('click', () => {
        this.appendInteractiveSymbol('-');
        window.morseAudio.playDah();
      });
    }

    if (this.quizSpaceBtn) {
      this.quizSpaceBtn.addEventListener('click', () => {
        this.appendInteractiveSymbol(' ');
      });
    }

    if (this.quizClearBtn) {
      this.quizClearBtn.addEventListener('click', () => {
        this.interactiveInput = '';
        this.updateInteractiveUI();
      });
    }

    if (this.quizSubmitBtn) {
      this.quizSubmitBtn.addEventListener('click', () => {
        this.submitInteractiveAnswer();
      });
    }

    // Keyboard support when tapping inside interactive challenge
    window.addEventListener('keydown', (e) => {
      const practiceTab = document.getElementById('tab-practice');
      if (!practiceTab || !practiceTab.classList.contains('active-tab')) return;
      if (this.currentMode !== 'interactive-tap' || this.isAnswered) return;

      if (e.key === '.') {
        e.preventDefault();
        this.appendInteractiveSymbol('.');
        window.morseAudio.playDit();
      } else if (e.key === '-') {
        e.preventDefault();
        this.appendInteractiveSymbol('-');
        window.morseAudio.playDah();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.appendInteractiveSymbol(' ');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        this.interactiveInput = this.interactiveInput.slice(0, -1);
        this.updateInteractiveUI();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.submitInteractiveAnswer();
      }
    });

    this.generateNewQuestion();
  }

  /**
   * Procedurally generates a question without hardcoding
   */
  generateNewQuestion() {
    this.isAnswered = false;
    this.interactiveInput = '';
    this.updateInteractiveUI();
    if (this.nextQuestionBtn) this.nextQuestionBtn.style.display = 'none';

    let targetChar = '';
    let targetMorse = '';

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const numbers = '0123456789'.split('');

    if (this.difficulty === 'novice') {
      targetChar = letters[Math.floor(Math.random() * letters.length)];
      targetMorse = MorseCore.MORSE_MAP[targetChar];
    } else if (this.difficulty === 'adept') {
      const pool = [...letters, ...numbers];
      targetChar = pool[Math.floor(Math.random() * pool.length)];
      targetMorse = MorseCore.MORSE_MAP[targetChar];
    } else {
      // Shadow Master (Words)
      const wordList = MorseCore.PRACTICE_WORDS.medium;
      targetChar = wordList[Math.floor(Math.random() * wordList.length)];
      targetMorse = MorseCore.textToMorse(targetChar);
    }

    this.currentQuestion = {
      target: targetChar,
      morse: targetMorse,
      mode: this.currentMode
    };

    if (this.currentMode === 'interactive-tap') {
      this.setupInteractiveQuestion();
    } else {
      this.setupMultipleChoiceQuestion();
    }
  }

  setupMultipleChoiceQuestion() {
    if (this.optionsGrid) this.optionsGrid.style.display = 'grid';
    if (this.interactiveTappingBox) this.interactiveTappingBox.style.display = 'none';
    if (this.audioPlayQuestionBtn) this.audioPlayQuestionBtn.style.display = (this.currentMode === 'audio-to-text') ? 'inline-flex' : 'none';

    // Set Question Prompt based on Mode
    if (this.currentMode === 'morse-to-text') {
      this.questionPrompt.textContent = this.currentQuestion.morse;
      this.questionSubtitle.textContent = 'Identify the decoded letter or word:';
      this.generateDistractorsAndRender(this.currentQuestion.target, false);
    } else if (this.currentMode === 'text-to-morse') {
      this.questionPrompt.textContent = this.currentQuestion.target;
      this.questionSubtitle.textContent = 'Select the correct Morse code sequence:';
      this.generateDistractorsAndRender(this.currentQuestion.morse, true);
    } else if (this.currentMode === 'audio-to-text') {
      this.questionPrompt.textContent = '🎧 [ AUDIO SIGNAL ]';
      this.questionSubtitle.textContent = 'Listen carefully to the beeps and choose the answer:';
      this.generateDistractorsAndRender(this.currentQuestion.target, false);
      // Auto play audio tone
      setTimeout(() => {
        window.morseAudio.playMorseSequence(this.currentQuestion.morse, 16);
      }, 300);
    }
  }

  setupInteractiveQuestion() {
    if (this.optionsGrid) this.optionsGrid.style.display = 'none';
    if (this.interactiveTappingBox) this.interactiveTappingBox.style.display = 'block';
    if (this.audioPlayQuestionBtn) this.audioPlayQuestionBtn.style.display = 'inline-flex';

    this.questionPrompt.textContent = this.currentQuestion.target;
    this.questionSubtitle.textContent = 'Tap the exact Morse code using buttons or keyboard:';
    if (this.interactiveFeedback) {
      this.interactiveFeedback.innerHTML = `<span>Expected: <strong>${this.currentQuestion.target}</strong></span>`;
    }
  }

  /**
   * Generates 4 options (1 correct + 3 smart confusing distractors)
   */
  generateDistractorsAndRender(correctValue, isMorse = false) {
    if (!this.optionsGrid) return;
    this.optionsGrid.innerHTML = '';

    const options = [correctValue];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const numbers = '0123456789'.split('');
    const allPool = [...letters, ...numbers];

    let safety = 0;
    while (options.length < 4 && safety < 100) {
      safety++;
      let distractor = '';

      if (!isMorse) {
        // Character distractors: pick random similar character or word
        if (this.difficulty === 'master') {
          const wList = MorseCore.PRACTICE_WORDS.medium;
          distractor = wList[Math.floor(Math.random() * wList.length)];
        } else {
          distractor = allPool[Math.floor(Math.random() * allPool.length)];
        }
      } else {
        // Morse code distractors: generate plausible Morse confusion
        if (Math.random() < 0.4) {
          // Invert dots and dashes
          distractor = correctValue.replace(/\./g, 'X').replace(/-/g, '.').replace(/X/g, '-');
        } else if (Math.random() < 0.7) {
          // Reverse symbol order
          distractor = correctValue.split('').reverse().join('');
        } else {
          // Pick a random other symbol's Morse code
          const randChar = allPool[Math.floor(Math.random() * allPool.length)];
          distractor = MorseCore.MORSE_MAP[randChar] || '.-';
        }
      }

      if (distractor && !options.includes(distractor)) {
        options.push(distractor);
      }
    }

    // Shuffle options array (Fisher-Yates)
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    // Render Option Buttons
    options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.innerHTML = `<span class="opt-index">${['A', 'B', 'C', 'D'][idx]}</span> <span class="opt-val">${opt}</span>`;

      btn.addEventListener('click', () => {
        this.handleMultipleChoiceAnswer(btn, opt, correctValue);
      });

      this.optionsGrid.appendChild(btn);
    });
  }

  handleMultipleChoiceAnswer(selectedBtn, selectedValue, correctValue) {
    if (this.isAnswered) return;
    this.isAnswered = true;
    this.totalQuestions++;

    const isCorrect = (selectedValue === correctValue);

    if (isCorrect) {
      selectedBtn.classList.add('correct-choice');
      this.score += 10 + (this.streak * 2);
      this.streak++;
      this.correctAnswers++;
      window.morseAudio.playSuccessSound();
      window.showToast('Correct! +Points', 'success');
    } else {
      selectedBtn.classList.add('wrong-choice');
      this.streak = 0;
      window.morseAudio.playErrorSound();
      window.showToast(`Incorrect. Correct answer was ${correctValue}`, 'error');

      // Highlight the correct button
      const allBtns = this.optionsGrid.querySelectorAll('.quiz-option-btn');
      allBtns.forEach(btn => {
        if (btn.querySelector('.opt-val').textContent === correctValue) {
          btn.classList.add('correct-choice');
        }
      });
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveStats();
    }

    this.updateStatsUI();

    if (this.nextQuestionBtn) {
      this.nextQuestionBtn.style.display = 'inline-flex';
    }

    // Auto proceed on correct after short delay
    if (isCorrect) {
      setTimeout(() => {
        if (this.isAnswered) this.generateNewQuestion();
      }, 1200);
    }
  }

  appendInteractiveSymbol(sym) {
    if (this.isAnswered) return;
    this.interactiveInput += sym;
    this.updateInteractiveUI();
  }

  updateInteractiveUI() {
    if (this.interactiveBuffer) {
      this.interactiveBuffer.textContent = this.interactiveInput || 'Tap code here...';
    }
  }

  submitInteractiveAnswer() {
    if (this.isAnswered) return;
    const cleanUser = this.interactiveInput.trim().replace(/[—–−_]/g, '-').replace(/[•·]/g, '.');
    const cleanTarget = this.currentQuestion.morse.trim().replace(/[—–−_]/g, '-').replace(/[•·]/g, '.');

    if (!cleanUser) {
      window.showToast('Please tap Morse symbols first', 'warning');
      return;
    }

    this.isAnswered = true;
    this.totalQuestions++;
    const isCorrect = (cleanUser === cleanTarget);

    if (isCorrect) {
      this.score += 15 + (this.streak * 3);
      this.streak++;
      this.correctAnswers++;
      window.morseAudio.playSuccessSound();
      if (this.interactiveFeedback) {
        this.interactiveFeedback.innerHTML = `<span class="correct-text"><i class="fas fa-check-circle"></i> AWESOME! Perfect match! (+15 pts)</span>`;
      }
      window.showToast('Spot on! Perfect signal!', 'success');
    } else {
      this.streak = 0;
      window.morseAudio.playErrorSound();
      if (this.interactiveFeedback) {
        this.interactiveFeedback.innerHTML = `<span class="wrong-text"><i class="fas fa-times-circle"></i> Wrong: You entered [${cleanUser}], expected [${cleanTarget}]</span>`;
      }
      window.showToast('Signal mismatch!', 'error');
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveStats();
    }

    this.updateStatsUI();

    if (this.nextQuestionBtn) {
      this.nextQuestionBtn.style.display = 'inline-flex';
    }

    if (isCorrect) {
      setTimeout(() => {
        if (this.isAnswered) this.generateNewQuestion();
      }, 1400);
    }
  }

  updateStatsUI() {
    if (this.scoreDisplay) this.scoreDisplay.textContent = this.score;
    if (this.streakDisplay) this.streakDisplay.textContent = this.streak;
    if (this.highScoreDisplay) this.highScoreDisplay.textContent = this.highScore;

    const accuracy = this.totalQuestions > 0 ? Math.round((this.correctAnswers / this.totalQuestions) * 100) : 100;
    if (this.accuracyDisplay) this.accuracyDisplay.textContent = `${accuracy}%`;

    // Dynamic Rank Title (Solo Leveling inspired)
    if (this.rankBadge) {
      if (this.score >= 300) {
        this.rankBadge.textContent = '👑 Shadow Monarch';
        this.rankBadge.className = 'rank-badge rank-monarch';
      } else if (this.score >= 150) {
        this.rankBadge.textContent = '⚔️ S-Rank Hunter';
        this.rankBadge.className = 'rank-badge rank-s';
      } else if (this.score >= 70) {
        this.rankBadge.textContent = '🛡️ A-Rank Operator';
        this.rankBadge.className = 'rank-badge rank-a';
      } else {
        this.rankBadge.textContent = '🔰 Novice Scout';
        this.rankBadge.className = 'rank-badge rank-novice';
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.morsePractice = new MorsePracticeController();
});
