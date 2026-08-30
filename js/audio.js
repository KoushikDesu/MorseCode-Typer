/**
 * Web Audio API Morse Code Synthesizer
 * Zero-latency tone generator and sequencer
 */

class MorseAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.oscillator = null;
    this.gainNode = null;
    this.frequency = 700; // Hz
    this.volume = 0.3; // 0.0 - 1.0
    this.waveType = 'sine'; // sine, triangle, square, sawtooth
    this.isPlayingSequence = false;
    this.sequenceTimeouts = [];
    this.isMuted = false;
    this.onProgressCallback = null;
    this.onCompleteCallback = null;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setFrequency(freq) {
    this.frequency = Math.max(200, Math.min(2000, Number(freq) || 700));
    if (this.oscillator) {
      try {
        this.oscillator.frequency.setValueAtTime(this.frequency, this.ctx.currentTime);
      } catch (e) {}
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, Number(vol) || 0.3));
    if (this.gainNode && !this.isMuted) {
      try {
        this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      } catch (e) {}
    }
  }

  setWaveType(type) {
    if (['sine', 'triangle', 'square', 'sawtooth'].includes(type)) {
      this.waveType = type;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Starts a continuous audio tone (e.g. while key/mouse is held down)
   */
  startTone() {
    if (this.isMuted) return;
    this.initContext();
    if (this.oscillator) return; // already active

    try {
      const now = this.ctx.currentTime;
      this.oscillator = this.ctx.createOscillator();
      this.gainNode = this.ctx.createGain();

      this.oscillator.type = this.waveType;
      this.oscillator.frequency.setValueAtTime(this.frequency, now);

      // Smooth attack to avoid audio clicks
      this.gainNode.gain.setValueAtTime(0, now);
      this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 0.005);

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);
      this.oscillator.start(now);
    } catch (e) {
      console.warn('Audio startTone error:', e);
    }
  }

  /**
   * Stops the continuous audio tone
   */
  stopTone() {
    if (!this.oscillator || !this.gainNode || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Smooth release
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + 0.008);

      const osc = this.oscillator;
      this.oscillator = null;
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (err) {}
      }, 20);
    } catch (e) {
      console.warn('Audio stopTone error:', e);
    }
  }

  /**
   * Plays a single pulse for given duration
   */
  playTone(durationMs) {
    if (this.isMuted) return Promise.resolve();
    this.initContext();

    return new Promise((resolve) => {
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const durationSec = durationMs / 1000;

        osc.type = this.waveType;
        osc.frequency.setValueAtTime(this.frequency, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(this.volume, now + 0.005);
        gain.gain.setValueAtTime(this.volume, now + durationSec - 0.005);
        gain.gain.linearRampToValueAtTime(0, now + durationSec);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + durationSec);

        setTimeout(resolve, durationMs);
      } catch (e) {
        setTimeout(resolve, durationMs);
      }
    });
  }

  playDit(wpm = 18) {
    const timing = MorseCore.getMorseTiming(wpm);
    return this.playTone(timing.dit);
  }

  playDah(wpm = 18) {
    const timing = MorseCore.getMorseTiming(wpm);
    return this.playTone(timing.dah);
  }

  /**
   * Plays a full Morse code string sequence with timing gaps and visual progress
   */
  async playMorseSequence(morseStr, wpm = 18, onProgress = null, onComplete = null) {
    this.stopSequence();
    this.isPlayingSequence = true;
    this.onProgressCallback = onProgress;
    this.onCompleteCallback = onComplete;

    const timing = MorseCore.getMorseTiming(wpm);
    const chars = morseStr.split('');

    for (let i = 0; i < chars.length; i++) {
      if (!this.isPlayingSequence) break;

      const symbol = chars[i];
      if (this.onProgressCallback) {
        this.onProgressCallback(i, symbol, chars.length);
      }

      if (symbol === '.') {
        await this.playTone(timing.dit);
        await this.waitDelay(timing.intraCharGap);
      } else if (symbol === '-' || symbol === '—' || symbol === '_') {
        await this.playTone(timing.dah);
        await this.waitDelay(timing.intraCharGap);
      } else if (symbol === ' ') {
        await this.waitDelay(timing.letterGap);
      } else if (symbol === '/') {
        await this.waitDelay(timing.wordGap);
      } else {
        await this.waitDelay(timing.intraCharGap);
      }
    }

    this.isPlayingSequence = false;
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }
  }

  waitDelay(ms) {
    return new Promise((resolve) => {
      const tid = setTimeout(resolve, ms);
      this.sequenceTimeouts.push(tid);
    });
  }

  stopSequence() {
    this.isPlayingSequence = false;
    this.sequenceTimeouts.forEach(clearTimeout);
    this.sequenceTimeouts = [];
    this.stopTone();
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }
  }

  /**
   * Sound effect: Success chime
   */
  playSuccessSound() {
    if (this.isMuted) return;
    this.initContext();
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playNote(freq, 120, 'sine', 0.2);
        }, idx * 70);
      });
    } catch (e) {}
  }

  /**
   * Sound effect: Error buzzer
   */
  playErrorSound() {
    if (this.isMuted) return;
    this.initContext();
    try {
      this.playNote(220, 180, 'sawtooth', 0.25);
      setTimeout(() => {
        this.playNote(174.61, 240, 'sawtooth', 0.25);
      }, 160);
    } catch (e) {}
  }

  /**
   * Sound effect: Solo Leveling Mana Awakening Pulse
   */
  playAwakeningSound() {
    if (this.isMuted) return;
    this.initContext();
    try {
      const freqs = [150, 300, 450, 600, 900, 1200];
      freqs.forEach((freq, idx) => {
        setTimeout(() => {
          this.playNote(freq, 250, 'triangle', 0.18 + (idx * 0.02));
        }, idx * 60);
      });
    } catch (e) {}
  }

  playNote(freq, durationMs, type = 'sine', volume = 0.2) {
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const durSec = durationMs / 1000;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + durSec);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + durSec);
    } catch (e) {}
  }
}

window.morseAudio = new MorseAudioSynthesizer();
