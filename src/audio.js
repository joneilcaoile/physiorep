// Audio engine — voice feedback and rep counting via Web Speech API

class AudioEngine {
  constructor() {
    this.enabled = true;
    this.speaking = false;
    this.speechQueue = [];
    this.lastSpokenMessage = '';
    this.lastSpokenTime = 0;
    this.minSpeechInterval = 2500; // Don't spam — 2.5s minimum between callouts
    this.audioCtx = null;
    this.voiceRepCount = true;
    this.voiceFormFeedback = true;
    this.voiceMilestones = true;
    this.volume = 1.0;
  }

  /**
   * Initialize audio context (must be called from user gesture)
   */
  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Warm up speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }

  /**
   * Speak a message using Web Speech API
   * @param {string} message - Text to speak
   * @param {string} priority - 'low', 'normal', 'high' (high interrupts current speech)
   */
  speak(message, priority = 'normal') {
    if (!this.enabled || !('speechSynthesis' in window)) return;

    const now = Date.now();

    // Throttle — don't repeat same message within interval
    if (message === this.lastSpokenMessage && now - this.lastSpokenTime < this.minSpeechInterval) {
      return;
    }

    // For high priority, cancel current speech
    if (priority === 'high') {
      window.speechSynthesis.cancel();
      this.speaking = false;
    }

    // Don't queue if already speaking (unless high priority)
    if (this.speaking && priority !== 'high') {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.1;  // Slightly faster than default — we want snappy callouts
    utterance.pitch = 1.0;
    utterance.volume = this.volume;

    // Try to use a clear, natural voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
      v.name.includes('Samantha') || v.name.includes('Google') ||
      v.name.includes('Daniel') || v.name.includes('Alex')
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => { this.speaking = true; };
    utterance.onend = () => { this.speaking = false; };
    utterance.onerror = () => { this.speaking = false; };

    this.lastSpokenMessage = message;
    this.lastSpokenTime = now;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Announce rep count (called after each rep)
   */
  announceRep(count) {
    if (!this.voiceRepCount) return;
    this.speak(String(count), 'normal');
  }

  /**
   * Announce form feedback
   * @param {string} message - The feedback message
   * @param {string} type - 'good', 'bad', 'warn'
   */
  announceFormFeedback(message, type) {
    if (!this.voiceFormFeedback) return;
    const priority = type === 'bad' ? 'high' : 'normal';
    this.speak(message, priority);
  }

  /**
   * Announce milestones (personal bests, round numbers, etc.)
   */
  announceMilestone(message) {
    if (!this.voiceMilestones) return;
    this.speak(message, 'high');
  }

  /**
   * Countdown beeps (3, 2, 1, GO)
   * @returns {Promise} resolves when countdown complete
   */
  async countdown() {
    if (!this.audioCtx) this.init();

    const beep = (freq, duration) => {
      return new Promise(resolve => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.frequency.value = freq;
        gain.gain.value = this.volume * 0.3;
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
        setTimeout(resolve, duration * 1000);
      });
    };

    // 3
    this.speak('3', 'high');
    await beep(440, 0.15);
    await this._wait(1000);

    // 2
    this.speak('2', 'high');
    await beep(440, 0.15);
    await this._wait(1000);

    // 1
    this.speak('1', 'high');
    await beep(440, 0.15);
    await this._wait(1000);

    // GO
    this.speak('Go!', 'high');
    await beep(880, 0.3);
  }

  /**
   * Play a success chime (workout complete, personal best)
   */
  playSuccessChime() {
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.value = this.volume * 0.2;
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + i * 0.15);
      osc.start(now + i * 0.15);
      osc.stop(now + 0.5 + i * 0.15);
    });
  }

  /**
   * Play an error/warning tone
   */
  playWarningTone() {
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.frequency.value = 300;
    gain.gain.value = this.volume * 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.3);
  }

  /**
   * Toggle audio on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      window.speechSynthesis.cancel();
    }
    return this.enabled;
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton
const audioEngine = new AudioEngine();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioEngine };
}
