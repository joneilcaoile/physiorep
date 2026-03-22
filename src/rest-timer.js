// Smart rest timer — intelligent rest period recommendations

const REST_PRESETS = {
  strength: { label: 'Strength', min: 180, max: 300, description: '3-5 min for heavy lifts' },
  hypertrophy: { label: 'Hypertrophy', min: 60, max: 90, description: '60-90s for muscle growth' },
  endurance: { label: 'Endurance', min: 30, max: 60, description: '30-60s for conditioning' },
  hiit: { label: 'HIIT', min: 10, max: 30, description: '10-30s maximum intensity' }
};

const EXERCISE_INTENSITY = {
  squat: 'high', deadlift: 'high', lunge: 'medium',
  pushup: 'medium', shoulderpress: 'medium',
  plank: 'low', wall_sit: 'medium',
  glute_bridge: 'low', calf_raises: 'low',
  mountain_climbers: 'high', burpees: 'high',
  jumping_jacks: 'medium', high_knees: 'high',
  squat_jump: 'high', superman: 'low',
  tricep_dip: 'medium', side_plank: 'low',
  bicycle_crunch: 'low'
};

class SmartRestTimer {
  constructor() {
    this.goal = 'hypertrophy'; // default training goal
    this.currentSet = 0;
    this.lastRecommendation = null;
    this.heartRateHistory = [];
    this.restHistory = [];

    this._loadGoal();
  }

  _loadGoal() {
    try {
      const saved = localStorage.getItem('physiorep_rest_goal');
      if (saved && REST_PRESETS[saved]) this.goal = saved;
    } catch (e) { /* ignore */ }
  }

  setGoal(goal) {
    if (!REST_PRESETS[goal]) return;
    this.goal = goal;
    try { localStorage.setItem('physiorep_rest_goal', goal); } catch (e) { /* ignore */ }
  }

  /**
   * Calculate recommended rest time
   * @param {Object} setData - { exerciseType, reps, formScore, setNumber, heartRate }
   * @returns {Object} { seconds, label, reason, readyIndicators }
   */
  recommend(setData) {
    const preset = REST_PRESETS[this.goal];
    const intensity = EXERCISE_INTENSITY[setData.exerciseType] || 'medium';

    let baseSec = (preset.min + preset.max) / 2;

    // Adjust for exercise intensity
    if (intensity === 'high') baseSec *= 1.3;
    else if (intensity === 'low') baseSec *= 0.7;

    // Adjust for rep count (higher reps = more metabolic fatigue)
    if (setData.reps > 15) baseSec *= 1.2;
    else if (setData.reps < 5) baseSec *= 1.1; // heavy = needs recovery too

    // Adjust for form degradation (poor form = fatigue signal)
    if (setData.formScore !== null && setData.formScore !== undefined) {
      if (setData.formScore < 60) baseSec *= 1.4; // significant fatigue
      else if (setData.formScore < 80) baseSec *= 1.15;
    }

    // Adjust for set number (later sets need more rest)
    const setNum = setData.setNumber || this.currentSet;
    if (setNum >= 4) baseSec *= 1.2;
    else if (setNum >= 2) baseSec *= 1.1;

    // Clamp to preset range (with some flexibility)
    const minSec = Math.round(preset.min * 0.8);
    const maxSec = Math.round(preset.max * 1.5);
    const seconds = Math.round(Math.max(minSec, Math.min(maxSec, baseSec)));

    // Build reason string
    const reasons = [];
    if (intensity === 'high') reasons.push('high-intensity exercise');
    if (setData.formScore !== null && setData.formScore < 70) reasons.push('form fatigue detected');
    if (setNum >= 3) reasons.push(`set ${setNum} recovery`);
    if (setData.reps > 15) reasons.push('high rep fatigue');

    // Ready indicators (things to check before next set)
    const readyIndicators = [
      { label: 'Breathing normalized', key: 'breathing' },
      { label: 'Heart rate recovered', key: 'hr', hasData: !!setData.heartRate },
      { label: 'Grip/muscles feel ready', key: 'muscles' }
    ];

    this.lastRecommendation = {
      seconds,
      label: this._formatTime(seconds),
      reason: reasons.length > 0 ? `Adjusted for ${reasons.join(', ')}` : `Standard ${preset.label.toLowerCase()} rest`,
      goal: this.goal,
      goalLabel: preset.label,
      readyIndicators,
      setNumber: setNum + 1
    };

    this.currentSet++;
    return this.lastRecommendation;
  }

  /**
   * Check if heart rate has recovered enough
   * @param {number} currentHR - Current heart rate from rPPG
   * @param {number} restingHR - Estimated resting HR
   * @returns {Object} { recovered, percent, message }
   */
  checkHRRecovery(currentHR, restingHR = 70) {
    if (!currentHR) return { recovered: false, percent: 0, message: 'No HR data' };

    // Recovery target: within 20% of resting HR
    const target = restingHR * 1.2;
    const maxHR = Math.max(...this.heartRateHistory, currentHR);
    const recoveryRange = maxHR - restingHR;
    const currentRecovery = maxHR - currentHR;
    const percent = Math.min(100, Math.round((currentRecovery / recoveryRange) * 100));

    this.heartRateHistory.push(currentHR);

    return {
      recovered: currentHR <= target,
      percent,
      message: currentHR <= target ? 'HR recovered — ready!' : `HR: ${currentHR} bpm (target: <${Math.round(target)})`
    };
  }

  /**
   * Reset for new exercise
   */
  resetSets() {
    this.currentSet = 0;
    this.heartRateHistory = [];
  }

  _formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${mins}:00`;
  }

  /**
   * Get all presets for settings UI
   */
  getPresets() {
    return Object.entries(REST_PRESETS).map(([key, preset]) => ({
      key,
      ...preset,
      active: key === this.goal
    }));
  }
}

const smartRestTimer = new SmartRestTimer();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SmartRestTimer, REST_PRESETS, EXERCISE_INTENSITY };
}
