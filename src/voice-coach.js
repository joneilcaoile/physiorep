// Voice coach — real-time smart coaching cues during exercises

class VoiceCoach {
  constructor() {
    this.enabled = true;
    this.coachingLevel = 'standard'; // 'minimal', 'standard', 'chatty'
    this.lastCueTime = {};  // { cueType: timestamp } — per-cue throttle
    this.repHistory = [];   // Track rep timing for pacing feedback
    this.sessionStats = { goodReps: 0, totalReps: 0, cuesGiven: 0 };
    this.personalBests = this._loadPBs();
    this.currentWeight = 0; // If user sets a weight for the exercise

    // Throttle windows (ms) — prevent nagging
    this.THROTTLE = {
      form: 5000,       // Don't repeat same form cue within 5s
      pace: 8000,       // Pacing cue every 8s max
      motivation: 15000, // Motivational callout every 15s max
      milestone: 0       // Milestones always fire immediately
    };
  }

  /**
   * Load personal bests from localStorage
   */
  _loadPBs() {
    try {
      const raw = localStorage.getItem('physiorep_personal_bests');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          return data;
        } else {
          console.warn('Invalid personal bests data: expected object');
          return {};
        }
      }
      return {};
    } catch (_e) {
      console.warn('Failed to load personal bests:', _e);
      return {};
    }
  }

  /**
   * Save personal bests
   */
  _savePBs() {
    try {
      localStorage.setItem('physiorep_personal_bests', JSON.stringify(this.personalBests));
    } catch (_e) { /* silent */ }
  }

  /**
   * Check throttle — returns true if this cue type can fire
   */
  _canCue(type) {
    const now = Date.now();
    const last = this.lastCueTime[type] || 0;
    const window = this.THROTTLE[type] || 5000;
    if (now - last < window) return false;
    this.lastCueTime[type] = now;
    return true;
  }

  /**
   * Set the weight the user is using for this session
   */
  setWeight(lbs) {
    this.currentWeight = lbs;
  }

  /**
   * Reset for new workout
   */
  reset() {
    this.lastCueTime = {};
    this.repHistory = [];
    this.sessionStats = { goodReps: 0, totalReps: 0, cuesGiven: 0 };
    this.currentWeight = 0;
  }

  /**
   * Process a completed rep and generate appropriate voice cues
   * @param {Object} repData - { exerciseType, reps, formScore, feedback, issues, angles }
   * @param {AudioEngine} audio - The audio engine to speak through
   * @returns {Array<string>} Cues that were spoken
   */
  onRep(repData, audio) {
    if (!this.enabled || !audio || !audio.enabled) return [];

    const cues = [];
    this.sessionStats.totalReps++;
    this.repHistory.push({ time: Date.now(), data: repData });

    const isGoodForm = repData.feedback && repData.feedback.type === 'good';
    if (isGoodForm) this.sessionStats.goodReps++;

    // 1. Form corrections (highest priority)
    const formCue = this._getFormCue(repData);
    if (formCue) {
      cues.push(formCue);
    }

    // 2. Pacing feedback
    const paceCue = this._getPaceCue(repData);
    if (paceCue && !formCue) { // Don't stack with form cue
      cues.push(paceCue);
    }

    // 3. Rep milestones (fun!)
    const milestoneCue = this._getMilestoneCue(repData);
    if (milestoneCue) {
      cues.push(milestoneCue);
    }

    // 4. Motivational (only if no other cue this rep)
    if (cues.length === 0) {
      const motivCue = this._getMotivationCue(repData);
      if (motivCue) cues.push(motivCue);
    }

    // Speak the first cue (don't stack — overwhelming)
    if (cues.length > 0) {
      const priority = formCue ? 'high' : 'normal';
      audio.speak(cues[0], priority);
      this.sessionStats.cuesGiven++;
    }

    return cues;
  }

  /**
   * Process plank hold update
   * @param {Object} holdData - { holdTime, formScore, feedback, hipAngle }
   * @param {AudioEngine} audio
   */
  onPlankUpdate(holdData, audio) {
    if (!this.enabled || !audio || !audio.enabled) return [];

    const cues = [];
    const secs = Math.floor(holdData.holdTime);

    // Time milestones
    if (secs > 0 && secs % 10 === 0 && this._canCue('milestone')) {
      if (secs === 60) {
        cues.push('One minute! You\'re crushing it!');
      } else if (secs === 30) {
        cues.push('Thirty seconds! Halfway to a minute!');
      } else {
        cues.push(`${secs} seconds!`);
      }
    }

    // Form cues for plank
    if (holdData.feedback && holdData.feedback.type !== 'good' && this._canCue('form')) {
      if (holdData.feedback.message && holdData.feedback.message.includes('hips')) {
        cues.push('Hips up! Keep a straight line from shoulders to ankles.');
      } else if (holdData.feedback.message && holdData.feedback.message.includes('pike')) {
        cues.push('Lower your hips a bit. Don\'t pike up.');
      }
    }

    // Encouragement during long holds
    if (secs > 20 && secs % 15 === 0 && this._canCue('motivation')) {
      const phrases = [
        'Keep breathing! You\'ve got this.',
        'Strong and steady!',
        'Don\'t forget to breathe!',
        'Hold that position!'
      ];
      cues.push(phrases[Math.floor(secs / 15) % phrases.length]);
    }

    if (cues.length > 0) {
      audio.speak(cues[0], cues[0].includes('Hips') ? 'high' : 'normal');
    }

    return cues;
  }

  /**
   * Called when workout ends — check for personal bests
   * @param {Object} summary - Exercise summary from ExerciseTracker
   * @param {AudioEngine} audio
   * @returns {Object|null} PR info if achieved
   */
  onWorkoutEnd(summary, audio) {
    if (!summary || !summary.exerciseType) return null;

    const key = summary.exerciseType;
    const weightKey = this.currentWeight > 0 ? `${key}_${this.currentWeight}lbs` : key;
    const prev = this.personalBests[weightKey];

    let isPR = false;
    let prType = '';

    // Check rep PR
    if (!prev || summary.reps > (prev.maxReps || 0)) {
      isPR = true;
      prType = 'reps';
    }

    // Check form score PR (only if 5+ reps)
    if (summary.reps >= 5 && summary.formScore &&
        (!prev || summary.formScore > (prev.bestFormScore || 0))) {
      isPR = true;
      prType = prType ? 'reps and form' : 'form';
    }

    // Check plank PR
    if (summary.exerciseType === 'plank' && summary.plankHoldTime) {
      if (!prev || summary.plankHoldTime > (prev.maxHold || 0)) {
        isPR = true;
        prType = 'hold time';
      }
    }

    if (isPR) {
      // Save new PB
      this.personalBests[weightKey] = {
        maxReps: Math.max(summary.reps || 0, (prev && prev.maxReps) || 0),
        bestFormScore: Math.max(summary.formScore || 0, (prev && prev.bestFormScore) || 0),
        maxHold: summary.exerciseType === 'plank'
          ? Math.max(summary.plankHoldTime || 0, (prev && prev.maxHold) || 0)
          : undefined,
        weight: this.currentWeight || undefined,
        date: new Date().toISOString()
      };
      this._savePBs();

      // Celebratory callout
      if (audio && audio.enabled) {
        const weightStr = this.currentWeight > 0 ? ` at ${this.currentWeight} pounds` : '';
        const prMessages = [
          `New personal best${weightStr}! ${prType}!`,
          `P-R! New record for ${prType}${weightStr}!`,
          `That's a new personal record${weightStr}! Amazing!`
        ];
        const msg = prMessages[Math.floor(Math.random() * prMessages.length)];
        audio.speak(msg, 'high');
        audio.playSuccessChime();
      }

      return { type: prType, weight: this.currentWeight, previous: prev, current: this.personalBests[weightKey] };
    }

    return null;
  }

  /**
   * Get personal bests for an exercise
   */
  getPersonalBests(exerciseType) {
    const results = {};
    for (const [key, val] of Object.entries(this.personalBests)) {
      if (key === exerciseType || key.startsWith(exerciseType + '_')) {
        results[key] = val;
      }
    }
    return results;
  }

  /**
   * Get all personal bests
   */
  getAllPersonalBests() {
    return { ...this.personalBests };
  }

  // PRIVATE CUE GENERATORS

  _getFormCue(repData) {
    if (!repData.feedback || repData.feedback.type === 'good') return null;
    if (!this._canCue('form_' + (repData.feedback.message || 'generic'))) return null;

    // Map feedback messages to friendly coaching cues
    const msg = (repData.feedback.message || '').toLowerCase();

    // Squat cues
    if (msg.includes('deeper') || msg.includes('depth')) {
      return this.coachingLevel === 'chatty'
        ? 'Try to get a bit deeper! Push your hips back and down.'
        : 'Go deeper!';
    }
    if (msg.includes('knee') && msg.includes('toe')) {
      return 'Knees behind toes! Sit back more.';
    }
    if (msg.includes('knee') && (msg.includes('cave') || msg.includes('valgus'))) {
      return 'Push your knees out! Don\'t let them cave in.';
    }

    // Pushup cues
    if (msg.includes('hip') && msg.includes('sag')) {
      return 'Tighten your core! Keep your hips up.';
    }
    if (msg.includes('elbow') && msg.includes('flare')) {
      return 'Tuck your elbows in closer to your body.';
    }
    if (msg.includes('lower') || msg.includes('depth')) {
      return 'Go lower! Chest close to the ground.';
    }

    // Lunge cues
    if (msg.includes('lean')) {
      return 'Stay upright! Chest up, core tight.';
    }

    // Shoulder press cues
    if (msg.includes('overhead') || msg.includes('wrist')) {
      return 'Press all the way up! Lock out overhead.';
    }
    if (msg.includes('asymmetr') || msg.includes('uneven')) {
      return 'Keep both arms even! Press symmetrically.';
    }

    // Deadlift cues
    if (msg.includes('round') && msg.includes('back')) {
      return this.coachingLevel === 'chatty'
        ? 'Straighten your back! Pull your shoulders back and chest up.'
        : 'Flat back! Shoulders back.';
    }

    // Generic bad form
    if (repData.feedback.type === 'bad' || repData.feedback.type === 'warn') {
      return 'Watch your form!';
    }

    return null;
  }

  _getPaceCue(repData) {
    if (this.repHistory.length < 3) return null;
    if (!this._canCue('pace')) return null;

    // Calculate recent rep duration
    const recent = this.repHistory.slice(-3);
    const gaps = [];
    for (let i = 1; i < recent.length; i++) {
      gaps.push(recent[i].time - recent[i - 1].time);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    // Too fast (less than 1.5s per rep for most exercises)
    if (avgGap < 1500 && repData.exerciseType !== 'plank') {
      return this.coachingLevel === 'chatty'
        ? 'Slow it down a bit! Controlled reps build more strength.'
        : 'Slow and controlled!';
    }

    // Much slower than their average (fatigue)
    if (this.repHistory.length > 6) {
      const early = this.repHistory.slice(0, 3);
      const earlyGaps = [];
      for (let i = 1; i < early.length; i++) {
        earlyGaps.push(early[i].time - early[i - 1].time);
      }
      const earlyAvg = earlyGaps.reduce((a, b) => a + b, 0) / earlyGaps.length;
      if (avgGap > earlyAvg * 2) {
        return 'Slowing down? Push through! You can do this!';
      }
    }

    return null;
  }

  _getMilestoneCue(repData) {
    const reps = repData.reps;
    if (!reps) return null;

    // Round number milestones
    if (reps === 10) return this._canCue('milestone') ? 'Ten reps! Keep it going!' : null;
    if (reps === 20) return this._canCue('milestone') ? 'Twenty! You\'re on fire!' : null;
    if (reps === 25) return this._canCue('milestone') ? 'Twenty five! Beast mode!' : null;
    if (reps === 30) return this._canCue('milestone') ? 'Thirty reps! Incredible!' : null;
    if (reps === 50) return this._canCue('milestone') ? 'Fifty reps! You\'re a machine!' : null;

    // Perfect form streak
    if (this.sessionStats.goodReps > 0 && this.sessionStats.goodReps % 5 === 0 &&
        this.sessionStats.goodReps === this.sessionStats.totalReps) {
      if (this._canCue('milestone')) {
        return `${this.sessionStats.goodReps} perfect reps in a row!`;
      }
    }

    return null;
  }

  _getMotivationCue(repData) {
    if (this.coachingLevel === 'minimal') return null;
    if (!this._canCue('motivation')) return null;

    const isGoodForm = repData.feedback && repData.feedback.type === 'good';

    if (isGoodForm) {
      const phrases = [
        'Nice!', 'Good form!', 'Perfect!', 'That\'s it!',
        'Solid rep!', 'Clean!', 'Beautiful!', 'Textbook!'
      ];
      return phrases[Math.floor(Math.random() * phrases.length)];
    }

    return null;
  }

  /**
   * Get session stats for the voice coach
   */
  getSessionStats() {
    return {
      ...this.sessionStats,
      formRate: this.sessionStats.totalReps > 0
        ? Math.round((this.sessionStats.goodReps / this.sessionStats.totalReps) * 100)
        : 0
    };
  }
}

// Singleton
const voiceCoach = new VoiceCoach();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VoiceCoach };
}
