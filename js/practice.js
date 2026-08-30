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

    // Display elements
    this.questionPrompt = document.getElementById('quizQuestionPrompt');
    this.questionSubtitle = document.getElementById('quizQuestionSubtitle');
    this.audioPlayContainer = document.getElementById('quizAudioContainer');
    this.audioPlayQuestionBtn = document.getElementById('quizAudioPlayBtn');
    this.optionsGrid = document.getElementById('quizOptionsGrid');
    this.interactiveTappingBox = document.getElementById('quizInteractiveTappingBox');
    this.interactiveBuffer = document.getElementById('quizInteractiveBuffer');
    this.interactiveFeedback = document.getElementById('quizInteractiveFeedback');
    
    // Tapping buttons
    this.quizDotBtn = document.getElementById('quizTapDotBtn');
    this.quizDashBtn = document.getElementById('quizTapDashBtn');
    this.quizSlashBtn = document.getElementById('quizTapSlashBtn');
    this.quizSpaceBtn = document.getElementById('quizTapSpaceBtn');
    this.quizBackspaceBtn = document.getElementById('quizTapBackspaceBtn');
    this.quizClearBtn = document.getElementById('quizTapClearBtn');
    this.quizSubmitBtn = document.getElementById('quizTapSubmitBtn');

    // Score & Stats UI
    this.scoreDisplay = document.getElementById('quizScoreVal');
    this.streakDisplay = document.getElementById('quizStreakVal');
    this.highScoreDisplay = document.getElementById('quizHighScoreVal');
    this.accuracyDisplay = document.getElementById('quizAccuracyVal');
    this.rankBadge = document.getElementById('quizRankBadge');

    // State
    this.selectedMode = 'all-mixed'; // 'all-mixed' (Default), 'morse-to-text', 'text-to-morse', 'audio-to-text', 'interactive-tap'
    this.activeQuestionMode = 'morse-to-text';
    this.difficulty = 'novice';
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
      this.quizModeSelect.value = 'all-mixed';
      this.quizModeSelect.addEventListener('change', (e) => {
        this.selectedMode = e.target.value;
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
        window.showToast('Quiz arena restarted!', 'info');
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
        window.showToast('Question skipped', 'info');
      });
    }

    // Audio Play Button
    if (this.audioPlayQuestionBtn) {
      this.audioPlayQuestionBtn.addEventListener('click', () => {
        this.playCurrentAudioQuestion();
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

    if (this.quizSlashBtn) {
      this.quizSlashBtn.addEventListener('click', () => {
        this.appendInteractiveSymbol(' / ');
      });
    }

    if (this.quizSpaceBtn) {
      this.quizSpaceBtn.addEventListener('click', () => {
        this.appendInteractiveSymbol(' ');
      });
    }

    if (this.quizBackspaceBtn) {
      this.quizBackspaceBtn.addEventListener('click', () => {
        this.handleInteractiveBackspace();
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

    // Direct Keyboard Support in Practice Mode
    window.addEventListener('keydown', (e) => {
      const practiceTab = document.getElementById('tab-practice');
      if (!practiceTab || !practiceTab.classList.contains('active-tab')) return;
      if (this.activeQuestionMode !== 'interactive-tap' || this.isAnswered) return;

      if (e.key === '.') {
        e.preventDefault();
        this.appendInteractiveSymbol('.');
        window.morseAudio.playDit();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        this.appendInteractiveSymbol('-');
        window.morseAudio.playDah();
      } else if (e.key === '/') {
        e.preventDefault();
        this.appendInteractiveSymbol(' / ');
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.appendInteractiveSymbol(' ');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        this.handleInteractiveBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.submitInteractiveAnswer();
      }
    });

    this.generateNewQuestion();
  }

  handleInteractiveBackspace() {
    if (this.interactiveInput.endsWith(' / ')) {
      this.interactiveInput = this.interactiveInput.slice(0, -3);
    } else if (this.interactiveInput.length > 0) {
      this.interactiveInput = this.interactiveInput.slice(0, -1);
    }
    this.updateInteractiveUI();
  }

  playCurrentAudioQuestion() {
    if (this.currentQuestion && this.currentQuestion.morse) {
      if (this.audioPlayQuestionBtn) {
        this.audioPlayQuestionBtn.classList.add('playing-pulse');
      }
      window.morseAudio.playMorseSequence(
        this.currentQuestion.morse,
        16,
        null,
        () => {
          if (this.audioPlayQuestionBtn) {
            this.audioPlayQuestionBtn.classList.remove('playing-pulse');
          }
        }
      );
    }
  }

  /**
   * Procedural Question Generator
   */
  generateNewQuestion() {
    this.isAnswered = false;
    this.interactiveInput = '';
    this.updateInteractiveUI();
    if (this.nextQuestionBtn) this.nextQuestionBtn.style.display = 'none';

    // Determine Mode for this question
    if (this.selectedMode === 'all-mixed') {
      const modes = ['morse-to-text', 'text-to-morse', 'audio-to-text', 'interactive-tap'];
      this.activeQuestionMode = modes[Math.floor(Math.random() * modes.length)];
    } else {
      this.activeQuestionMode = this.selectedMode;
    }

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
      // Master
      const wordList = MorseCore.PRACTICE_WORDS.medium;
      targetChar = wordList[Math.floor(Math.random() * wordList.length)];
      targetMorse = MorseCore.textToMorse(targetChar);
    }

    this.currentQuestion = {
      target: targetChar,
      morse: targetMorse,
      mode: this.activeQuestionMode
    };

    if (this.activeQuestionMode === 'interactive-tap') {
      this.setupInteractiveQuestion();
    } else {
      this.setupMultipleChoiceQuestion();
    }
  }

  setupMultipleChoiceQuestion() {
    if (this.optionsGrid) this.optionsGrid.style.display = 'grid';
    if (this.interactiveTappingBox) this.interactiveTappingBox.style.display = 'none';

    if (this.activeQuestionMode === 'morse-to-text') {
      if (this.audioPlayContainer) this.audioPlayContainer.style.display = 'none';
      this.questionPrompt.style.display = 'block';
      this.questionPrompt.textContent = this.currentQuestion.morse;
      this.questionSubtitle.textContent = 'Question: Decode the Morse code to English:';
      this.generateDistractorsAndRender(this.currentQuestion.target, false);
    } else if (this.activeQuestionMode === 'text-to-morse') {
      if (this.audioPlayContainer) this.audioPlayContainer.style.display = 'none';
      this.questionPrompt.style.display = 'block';
      this.questionPrompt.textContent = this.currentQuestion.target;
      this.questionSubtitle.textContent = 'Question: Select the matching Morse code sequence:';
      this.generateDistractorsAndRender(this.currentQuestion.morse, true);
    } else if (this.activeQuestionMode === 'audio-to-text') {
      if (this.audioPlayContainer) this.audioPlayContainer.style.display = 'flex';
      this.questionPrompt.style.display = 'none';
      this.questionSubtitle.textContent = 'Question: Listen to the audio tone and choose the answer:';
      this.generateDistractorsAndRender(this.currentQuestion.target, false);
      
      // Play audio automatically after small delay
      setTimeout(() => {
        this.playCurrentAudioQuestion();
      }, 350);
    }
  }

  setupInteractiveQuestion() {
    if (this.optionsGrid) this.optionsGrid.style.display = 'none';
    if (this.audioPlayContainer) this.audioPlayContainer.style.display = 'none';
    if (this.interactiveTappingBox) this.interactiveTappingBox.style.display = 'block';

    this.questionPrompt.style.display = 'block';
    this.questionPrompt.textContent = this.currentQuestion.target;
    this.questionSubtitle.textContent = 'Challenge: Tap the exact Morse code for this character/word:';
    if (this.interactiveFeedback) {
      this.interactiveFeedback.innerHTML = `<span>Target: <strong>${this.currentQuestion.target}</strong> (${this.currentQuestion.morse})</span>`;
    }
  }

  /**
   * Generates 4 options with smart confusing distractors
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
        if (this.difficulty === 'master') {
          const wList = MorseCore.PRACTICE_WORDS.medium;
          distractor = wList[Math.floor(Math.random() * wList.length)];
        } else {
          distractor = allPool[Math.floor(Math.random() * allPool.length)];
        }
      } else {
        if (Math.random() < 0.4) {
          distractor = correctValue.replace(/\./g, 'X').replace(/-/g, '.').replace(/X/g, '-');
        } else if (Math.random() < 0.7) {
          distractor = correctValue.split('').reverse().join('');
        } else {
          const randChar = allPool[Math.floor(Math.random() * allPool.length)];
          distractor = MorseCore.MORSE_MAP[randChar] || '.-';
        }
      }

      if (distractor && !options.includes(distractor)) {
        options.push(distractor);
      }
    }

    // Shuffle options array
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    // Render Option Buttons
    options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.innerHTML = `<span class="opt-index">${['A', 'B', 'C', 'D'][idx]}</span> <span class="opt-val">${opt}</span>`;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
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
      window.showToast(`Incorrect. Correct answer was "${correctValue}"`, 'error');

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
      this.interactiveBuffer.textContent = this.interactiveInput || 'Tap code using buttons or keyboard...';
    }
  }

  submitInteractiveAnswer() {
    if (this.isAnswered) return;
    const cleanUser = this.interactiveInput.trim().replace(/[—–−_]/g, '-').replace(/[•·]/g, '').replace(/\s+/g, ' ');
    const cleanTarget = this.currentQuestion.morse.trim().replace(/[—–−_]/g, '-').replace(/[•·]/g, '').replace(/\s+/g, ' ');

    if (!cleanUser) {
      window.showToast('Please enter Morse code first', 'warning');
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
        this.interactiveFeedback.innerHTML = `<span class="correct-text"><i class="fas fa-check-circle"></i> CORRECT! Perfect signal (+15 pts)</span>`;
      }
      window.showToast('Perfect signal match!', 'success');
    } else {
      this.streak = 0;
      window.morseAudio.playErrorSound();
      if (this.interactiveFeedback) {
        this.interactiveFeedback.innerHTML = `<span class="wrong-text"><i class="fas fa-times-circle"></i> Mismatch: Entered [${cleanUser}], expected [${cleanTarget}]</span>`;
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
