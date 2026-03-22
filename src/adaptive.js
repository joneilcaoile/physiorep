// Adaptive programming — auto-adjusts workout difficulty based on performance

const STORAGE_KEY_ADAPTIVE = 'physiorep_adaptive_state';

// Difficulty multipliers
const DIFFICULTY_LEVELS = {
  deload: { label: 'Deload', multiplier: 0.7, color: '#69f0ae', icon: '🌱', description: 'Recovery day — lighter volume, focus on form' },
  easy: { label: 'Easy', multiplier: 0.85, color: '#06d6a0', icon: '😊', description: 'Building back up — moderate effort' },
  normal: { label: 'Normal', multiplier: 1.0, color: '#fff', icon: '💪', description: 'Standard programming — push yourself' },
  hard: { label: 'Hard', multiplier: 1.15, color: '#ffd166', icon: '🔥', description: 'You\'re on a roll — elevated targets' },
  intense: { label: 'Intense', multiplier: 1.3, color: '#ef476f', icon: '🏆', description: 'Peak performance mode — max effort' }
};

class AdaptiveEngine {
  constructor() {
    this.state = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ADAPTIVE);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          return data;
        } else {
          console.warn('Invalid adaptive state: expected object');
        }
      }
    } catch (e) {
      console.warn('Failed to load adaptive state:', e);
    }
    return {
      currentDifficulty: 'normal',
      readinessScore: 70, // 0-100
      performanceHistory: [], // last 14 sessions
      lastAssessment: null,
      weeklyVolume: { target: 0, actual: 0 },
      deloadWeek: false,
      consecutiveHardDays: 0,
      recoveryData: null // from wearable sync
    };
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY_ADAPTIVE, JSON.stringify(this.state));
    } catch (e) { /* ignore */ }
  }

  /**
   * Assess readiness and determine today's difficulty
   * Call this before generating today's workout
   * @param {Array} recentWorkouts - Last 7-14 workouts from DB
   * @param {Object} recoveryData - Optional { sleepHours, hrvScore, restingHR, stepsYesterday }
   * @returns {Object} { difficulty, readinessScore, recommendation, adjustments }
   */
  assessReadiness(recentWorkouts, recoveryData = null) {
    let readiness = 70; // baseline

    // === PERFORMANCE SIGNALS ===

    // 1. Form score trend (last 5 sessions)
    const formTrend = this._calcFormTrend(recentWorkouts);
    if (formTrend.direction === 'declining') readiness -= 15;
    else if (formTrend.direction === 'improving') readiness += 10;
    else if (formTrend.avgScore >= 85) readiness += 5;

    // 2. Session frequency (consistency)
    const frequency = this._calcFrequency(recentWorkouts);
    if (frequency.sessionsLast7Days >= 4) readiness += 10;
    else if (frequency.sessionsLast7Days >= 2) readiness += 5;
    else if (frequency.sessionsLast7Days === 0) readiness -= 10;

    // 3. Volume progression (are they completing prescribed work?)
    const volumeTrend = this._calcVolumeTrend(recentWorkouts);
    if (volumeTrend.completionRate >= 0.9) readiness += 10;
    else if (volumeTrend.completionRate < 0.6) readiness -= 15;

    // 4. Consecutive training days (fatigue accumulation)
    const streak = this._calcConsecutiveDays(recentWorkouts);
    if (streak >= 5) readiness -= 20;
    else if (streak >= 3) readiness -= 5;

    // 5. Time since last workout (freshness)
    const daysSinceLast = this._daysSinceLastWorkout(recentWorkouts);
    if (daysSinceLast >= 3) readiness += 10; // well rested
    else if (daysSinceLast === 0) readiness -= 5; // same day double

    // === RECOVERY SIGNALS (from wearable) ===
    if (recoveryData) {
      this.state.recoveryData = recoveryData;

      // Sleep quality
      if (recoveryData.sleepHours !== null && recoveryData.sleepHours !== undefined) {
        if (recoveryData.sleepHours >= 8) readiness += 10;
        else if (recoveryData.sleepHours >= 7) readiness += 5;
        else if (recoveryData.sleepHours < 6) readiness -= 15;
        else if (recoveryData.sleepHours < 5) readiness -= 25;
      }

      // HRV (higher = better recovery)
      if (recoveryData.hrvScore !== null && recoveryData.hrvScore !== undefined) {
        if (recoveryData.hrvScore >= 70) readiness += 10;
        else if (recoveryData.hrvScore >= 50) readiness += 5;
        else if (recoveryData.hrvScore < 30) readiness -= 15;
      }

      // Resting heart rate (lower = better recovery; elevated = stress/fatigue)
      if (recoveryData.restingHR !== null && recoveryData.restingHR !== undefined) {
        if (recoveryData.restingHR <= 55) readiness += 5;
        else if (recoveryData.restingHR >= 75) readiness -= 10;
      }
    }

    // === AUTO-DELOAD DETECTION ===
    // Every 4th week OR after 5+ consecutive hard days
    const weekNumber = this._getTrainingWeek(recentWorkouts);
    if (weekNumber > 0 && weekNumber % 4 === 0) {
      readiness -= 20; // deload week nudge
      this.state.deloadWeek = true;
    } else {
      this.state.deloadWeek = false;
    }

    // Clamp 0-100
    readiness = Math.max(0, Math.min(100, readiness));
    this.state.readinessScore = readiness;

    // Map readiness to difficulty
    let difficulty;
    if (readiness <= 25) difficulty = 'deload';
    else if (readiness <= 45) difficulty = 'easy';
    else if (readiness <= 70) difficulty = 'normal';
    else if (readiness <= 85) difficulty = 'hard';
    else difficulty = 'intense';

    this.state.currentDifficulty = difficulty;
    this.state.lastAssessment = new Date().toISOString();

    // Build recommendation
    const rec = this._buildRecommendation(difficulty, formTrend, frequency, volumeTrend, recoveryData);

    this._save();

    return {
      difficulty,
      ...DIFFICULTY_LEVELS[difficulty],
      readinessScore: readiness,
      recommendation: rec,
      adjustments: this._getAdjustments(difficulty),
      signals: {
        formTrend: formTrend.direction,
        formAvg: formTrend.avgScore,
        sessionsThisWeek: frequency.sessionsLast7Days,
        volumeCompletion: Math.round(volumeTrend.completionRate * 100),
        consecutiveDays: streak,
        daysSinceLast,
        sleepHours: recoveryData?.sleepHours || null,
        hrvScore: recoveryData?.hrvScore || null
      }
    };
  }

  /**
   * Apply difficulty adjustments to a workout plan
   * @param {Object} workout - { exercises: [{ type, targetReps, targetSets }] }
   * @returns {Object} Modified workout with adjusted targets
   */
  applyDifficulty(workout) {
    const level = DIFFICULTY_LEVELS[this.state.currentDifficulty];
    if (!level || !workout || !workout.exercises) return workout;

    const adjusted = {
      ...workout,
      difficulty: this.state.currentDifficulty,
      difficultyLabel: level.label,
      exercises: workout.exercises.map(ex => {
        const targetReps = ex.targetReps || ex.reps || 10;
        const targetSets = ex.targetSets || ex.sets || 3;

        return {
          ...ex,
          originalReps: targetReps,
          originalSets: targetSets,
          targetReps: Math.round(targetReps * level.multiplier),
          targetSets: this.state.currentDifficulty === 'deload'
            ? Math.max(1, targetSets - 1)
            : this.state.currentDifficulty === 'intense'
              ? targetSets + 1
              : targetSets,
          restModifier: this.state.currentDifficulty === 'deload' ? 1.3 :
            this.state.currentDifficulty === 'intense' ? 0.8 : 1.0
        };
      })
    };

    return adjusted;
  }

  /**
   * Record a completed session for future assessments
   * @param {Object} sessionData - { exerciseType, reps, formScore, duration, tempoScore, difficulty }
   */
  recordSession(sessionData) {
    this.state.performanceHistory.push({
      ...sessionData,
      date: new Date().toISOString(),
      difficulty: this.state.currentDifficulty
    });

    // Keep last 30 sessions
    if (this.state.performanceHistory.length > 30) {
      this.state.performanceHistory = this.state.performanceHistory.slice(-30);
    }

    // Track consecutive hard days
    if (this.state.currentDifficulty === 'hard' || this.state.currentDifficulty === 'intense') {
      this.state.consecutiveHardDays++;
    } else {
      this.state.consecutiveHardDays = 0;
    }

    this._save();
  }

  /**
   * Get the current readiness display data for home screen
   */
  getReadinessDisplay() {
    const level = DIFFICULTY_LEVELS[this.state.currentDifficulty];
    return {
      score: this.state.readinessScore,
      difficulty: this.state.currentDifficulty,
      label: level.label,
      color: level.color,
      icon: level.icon,
      description: level.description,
      isDeloadWeek: this.state.deloadWeek,
      lastAssessment: this.state.lastAssessment,
      recoveryData: this.state.recoveryData
    };
  }

  // === PRIVATE ANALYSIS METHODS ===

  _calcFormTrend(workouts) {
    const recent = workouts.slice(0, 5).filter(w => w.formScore !== null && w.formScore !== undefined);
    if (recent.length < 2) return { direction: 'stable', avgScore: recent[0]?.formScore || 75 };

    const avg = recent.reduce((s, w) => s + w.formScore, 0) / recent.length;
    const firstHalf = recent.slice(Math.floor(recent.length / 2));
    const secondHalf = recent.slice(0, Math.floor(recent.length / 2));

    const firstAvg = firstHalf.reduce((s, w) => s + w.formScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.length > 0
      ? secondHalf.reduce((s, w) => s + w.formScore, 0) / secondHalf.length
      : firstAvg;

    let direction = 'stable';
    if (secondAvg < firstAvg - 5) direction = 'declining';
    else if (secondAvg > firstAvg + 5) direction = 'improving';

    return { direction, avgScore: Math.round(avg) };
  }

  _calcFrequency(workouts) {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400000;
    const sessionsLast7Days = workouts.filter(w => new Date(w.date || w.timestamp).getTime() > sevenDaysAgo).length;
    return { sessionsLast7Days };
  }

  _calcVolumeTrend(workouts) {
    const recent = workouts.slice(0, 7);
    if (recent.length === 0) return { completionRate: 0.75 };

    // Estimate completion rate: reps achieved vs what we'd expect for the duration
    const avgReps = recent.reduce((s, w) => s + (w.reps || 0), 0) / recent.length;
    const expectedReps = 15; // baseline expectation
    const completionRate = Math.min(1, avgReps / expectedReps);
    return { completionRate };
  }

  _calcConsecutiveDays(workouts) {
    if (workouts.length === 0) return 0;

    const _today = new Date().toDateString();
    const dates = workouts
      .map(w => new Date(w.date || w.timestamp).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i); // unique dates

    let streak = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(now - i * 86400000).toDateString();
      if (dates.includes(checkDate)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  }

  _daysSinceLastWorkout(workouts) {
    if (workouts.length === 0) return 7;
    const lastDate = new Date(workouts[0].date || workouts[0].timestamp);
    return Math.floor((Date.now() - lastDate.getTime()) / 86400000);
  }

  _getTrainingWeek(workouts) {
    if (workouts.length === 0) return 0;
    const oldest = new Date(workouts[workouts.length - 1].date || workouts[workouts.length - 1].timestamp);
    return Math.floor((Date.now() - oldest.getTime()) / (7 * 86400000));
  }

  _buildRecommendation(difficulty, formTrend, frequency, volumeTrend, recoveryData) {
    const parts = [];

    if (difficulty === 'deload') {
      parts.push('Your body needs recovery. Today\'s workout is lighter — focus on movement quality, not intensity.');
      if (formTrend.direction === 'declining') parts.push('Your form has been declining, which signals fatigue.');
    } else if (difficulty === 'easy') {
      parts.push('Ease into today. You have some fatigue signals, so we\'ve dialed back the volume.');
    } else if (difficulty === 'hard') {
      parts.push('You\'re performing well! We\'ve bumped up today\'s targets. Trust your preparation.');
    } else if (difficulty === 'intense') {
      parts.push('Peak performance mode! Your form, consistency, and recovery are all strong. Let\'s push it.');
    } else {
      parts.push('Standard difficulty today. Solid, consistent effort.');
    }

    if (recoveryData && recoveryData.sleepHours !== null && recoveryData.sleepHours < 6) {
      parts.push(`You only got ${recoveryData.sleepHours}h sleep — we've adjusted intensity down.`);
    }

    if (frequency.sessionsLast7Days >= 5) {
      parts.push('5+ sessions this week — consider a rest day soon.');
    }

    return parts.join(' ');
  }

  _getAdjustments(difficulty) {
    const adj = {
      repMultiplier: DIFFICULTY_LEVELS[difficulty].multiplier,
      restMultiplier: difficulty === 'deload' ? 1.3 : difficulty === 'intense' ? 0.8 : 1.0,
      setsAdjustment: difficulty === 'deload' ? -1 : difficulty === 'intense' ? 1 : 0,
      formFocusMode: difficulty === 'deload' || difficulty === 'easy',
      suggestions: []
    };

    if (difficulty === 'deload') {
      adj.suggestions.push('Skip HIIT today — stick to controlled movements');
      adj.suggestions.push('Add extra stretching (recovery screen)');
    } else if (difficulty === 'intense') {
      adj.suggestions.push('Try a HIIT finisher after your main workout');
      adj.suggestions.push('Challenge yourself with harder exercise modifications');
    }

    return adj;
  }
}

const adaptiveEngine = new AdaptiveEngine();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AdaptiveEngine, DIFFICULTY_LEVELS };
}
