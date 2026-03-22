// HIIT engine — high-intensity intervals with pre-built and custom programs

// HIIT PROGRAM TEMPLATES

const HIIT_PROGRAMS = [
  {
    id: 'tabata-classic',
    name: 'Classic Tabata',
    description: '20 seconds work, 10 seconds rest. 8 rounds. The original HIIT protocol.',
    type: 'tabata',
    difficulty: 'advanced',
    duration: '4 min',
    calories: '50-80',
    icon: '⚡',
    science: 'Dr. Izumi Tabata\'s 1996 study showed this protocol improves VO2max by 14% AND anaerobic capacity by 28% in just 6 weeks — superior to 60 minutes of moderate cardio (Medicine & Science in Sports & Exercise).',
    rounds: 8,
    workSec: 20,
    restSec: 10,
    exercises: ['squat_jump', 'mountain_climbers', 'burpees', 'high_knees',
      'squat_jump', 'mountain_climbers', 'burpees', 'high_knees']
  },
  {
    id: 'tabata-beginner',
    name: 'Tabata Lite',
    description: '20 seconds work, 20 seconds rest. Same intensity, more recovery.',
    type: 'tabata',
    difficulty: 'intermediate',
    duration: '5.5 min',
    calories: '40-65',
    icon: '💡',
    science: 'Modified Tabata with equal work:rest ratio still produces significant EPOC (excess post-exercise oxygen consumption) — burning extra calories for 24-48 hours post-workout.',
    rounds: 8,
    workSec: 20,
    restSec: 20,
    exercises: ['squat', 'pushup', 'high_knees', 'plank',
      'lunge', 'mountain_climbers', 'squat', 'pushup']
  },
  {
    id: 'emom-10',
    name: 'EMOM 10',
    description: 'Every Minute On the Minute. Complete reps, rest until next minute starts.',
    type: 'emom',
    difficulty: 'intermediate',
    duration: '10 min',
    calories: '80-120',
    icon: '⏰',
    science: 'EMOM training auto-regulates intensity — as you fatigue, rest periods naturally shorten. This creates progressive overload within a single session. Studies show EMOM protocols improve work capacity by 15-20% over 4 weeks.',
    rounds: 10,
    workSec: 60,
    restSec: 0, // Rest is built into the minute
    exercises: [
      'squat', 'pushup', 'lunge', 'shoulderpress', 'plank',
      'squat', 'pushup', 'lunge', 'shoulderpress', 'plank'
    ],
    targetReps: [15, 10, 12, 10, 30, 15, 10, 12, 10, 30]
  },
  {
    id: 'amrap-15',
    name: 'AMRAP 15',
    description: 'As Many Rounds As Possible in 15 minutes. Your score = total rounds.',
    type: 'amrap',
    difficulty: 'intermediate',
    duration: '15 min',
    calories: '120-180',
    icon: '🔄',
    science: 'AMRAP creates a gamified training effect — your score (rounds completed) is a measurable, repeatable benchmark. Research shows competitive scoring increases effort output by 10-15% vs unscored workouts.',
    totalTimeSec: 900, // 15 minutes
    circuit: [
      { type: 'squat', reps: 10 },
      { type: 'pushup', reps: 8 },
      { type: 'lunge', reps: 10 },
      { type: 'plank', holdSec: 20 }
    ]
  },
  {
    id: 'circuit-full-body',
    name: 'Full Body Circuit',
    description: '6 exercises, 45 seconds each, 15 seconds rest. 3 rounds.',
    type: 'circuit',
    difficulty: 'intermediate',
    duration: '18 min',
    calories: '150-220',
    icon: '🔁',
    science: 'Circuit training maintains elevated heart rate (65-80% HRmax) throughout, combining cardiovascular and resistance benefits. Burns 30% more calories than traditional strength training with rest periods (ACSM, 2013).',
    totalRounds: 3,
    workSec: 45,
    restSec: 15,
    roundRestSec: 60,
    exercises: ['squat', 'pushup', 'lunge', 'shoulderpress', 'plank', 'deadlift']
  },
  {
    id: 'hiit-cardio-blast',
    name: 'Cardio Blast',
    description: '30 seconds work, 15 seconds rest. All cardio moves. 12 rounds.',
    type: 'interval',
    difficulty: 'advanced',
    duration: '9 min',
    calories: '90-130',
    icon: '💥',
    science: 'High-intensity cardiovascular intervals at >85% HRmax maximize mitochondrial biogenesis — your cells literally create more energy-producing powerhouses. 2 weeks of HIIT produces the same mitochondrial adaptations as 6 weeks of moderate training (Journal of Physiology, 2010).',
    rounds: 12,
    workSec: 30,
    restSec: 15,
    exercises: ['high_knees', 'jumping_jacks', 'mountain_climbers', 'squat_jump',
      'burpees', 'high_knees', 'jumping_jacks', 'mountain_climbers',
      'squat_jump', 'burpees', 'high_knees', 'jumping_jacks']
  },
  {
    id: 'beginner-interval',
    name: 'Beginner Intervals',
    description: '30 seconds work, 30 seconds rest. Simple exercises. 8 rounds.',
    type: 'interval',
    difficulty: 'beginner',
    duration: '8 min',
    calories: '50-75',
    icon: '🌱',
    science: 'Even moderate-intensity intervals (70-80% HRmax) improve cardiovascular fitness. Equal work:rest ratios are ideal for beginners — sufficient recovery prevents form breakdown while still elevating metabolism.',
    rounds: 8,
    workSec: 30,
    restSec: 30,
    exercises: ['squat', 'jumping_jacks', 'pushup', 'high_knees',
      'lunge', 'jumping_jacks', 'plank', 'squat']
  }
];

// HIIT SESSION ENGINE

class HIITSession {
  constructor(programId) {
    const template = HIIT_PROGRAMS.find(p => p.id === programId);
    if (!template) throw new Error(`Unknown HIIT program: ${programId}`);

    this.program = { ...template };
    this.currentRound = 0;
    this.phase = 'warmup'; // 'warmup', 'work', 'rest', 'roundRest', 'complete'
    this.phaseTimer = 0;
    this.totalTimer = 0;
    this.isRunning = false;
    this.isPaused = false;

    // AMRAP tracking
    this.amrapRounds = 0;
    this.amrapExerciseIndex = 0;

    // Stats
    this.stats = {
      totalWorkTime: 0,
      totalRestTime: 0,
      roundsCompleted: 0,
      exercisesCompleted: 0,
      estimatedCalories: 0
    };

    // Callbacks
    this.onPhaseChange = null;   // (phase, exercise, round) => {}
    this.onTick = null;          // (timeLeft, totalTime) => {}
    this.onComplete = null;      // (stats) => {}
  }

  /**
   * Start the HIIT session
   */
  start() {
    this.isRunning = true;
    this.isPaused = false;
    this.phase = 'work';
    this.currentRound = 0;
    this.phaseTimer = this._getWorkDuration();

    if (this.onPhaseChange) {
      this.onPhaseChange('work', this._getCurrentExercise(), 0);
    }
  }

  /**
   * Tick the timer (call every second)
   * @param {number} dt - Delta time in seconds (usually 1)
   */
  tick(dt = 1) {
    if (!this.isRunning || this.isPaused) return;

    this.totalTimer += dt;
    this.phaseTimer -= dt;

    // Track work/rest time
    if (this.phase === 'work') {
      this.stats.totalWorkTime += dt;
    } else if (this.phase === 'rest' || this.phase === 'roundRest') {
      this.stats.totalRestTime += dt;
    }

    // Notify tick
    if (this.onTick) {
      this.onTick(Math.max(0, Math.ceil(this.phaseTimer)), this.totalTimer);
    }

    // AMRAP special handling
    if (this.program.type === 'amrap') {
      if (this.totalTimer >= this.program.totalTimeSec) {
        this._finish();
        return;
      }
      return; // AMRAP doesn't auto-transition phases
    }

    // Phase transition
    if (this.phaseTimer <= 0) {
      this._nextPhase();
    }
  }

  /**
   * For AMRAP: mark an exercise as complete
   */
  amrapComplete() {
    if (this.program.type !== 'amrap') return;

    this.stats.exercisesCompleted++;
    this.amrapExerciseIndex++;

    if (this.amrapExerciseIndex >= this.program.circuit.length) {
      this.amrapExerciseIndex = 0;
      this.amrapRounds++;
      this.stats.roundsCompleted++;
    }

    if (this.onPhaseChange) {
      const exercise = this.program.circuit[this.amrapExerciseIndex];
      this.onPhaseChange('work', exercise, this.amrapRounds);
    }
  }

  /**
   * Pause/resume
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  /**
   * Get current exercise info
   */
  getCurrentInfo() {
    return {
      phase: this.phase,
      exercise: this._getCurrentExercise(),
      round: this.currentRound + 1,
      totalRounds: this.program.rounds || this.program.totalRounds || 0,
      timeLeft: Math.max(0, Math.ceil(this.phaseTimer)),
      totalTime: this.totalTimer,
      amrapRounds: this.amrapRounds
    };
  }

  // PRIVATE

  _nextPhase() {
    if (this.phase === 'work') {
      this.stats.exercisesCompleted++;
      this.currentRound++;

      // Check if done
      const totalRounds = this.program.rounds || 0;
      if (this.program.type === 'circuit') {
        const exercisesPerRound = this.program.exercises.length;
        const totalExercises = exercisesPerRound * this.program.totalRounds;
        if (this.stats.exercisesCompleted >= totalExercises) {
          this._finish();
          return;
        }
        // Check if we need a round rest
        if (this.stats.exercisesCompleted % exercisesPerRound === 0 && this.program.roundRestSec) {
          this.phase = 'roundRest';
          this.phaseTimer = this.program.roundRestSec;
          this.stats.roundsCompleted++;
          if (this.onPhaseChange) this.onPhaseChange('roundRest', null, this.currentRound);
          return;
        }
      } else if (totalRounds > 0 && this.currentRound >= totalRounds) {
        this._finish();
        return;
      }

      // Transition to rest
      const restDuration = this._getRestDuration();
      if (restDuration > 0) {
        this.phase = 'rest';
        this.phaseTimer = restDuration;
        if (this.onPhaseChange) this.onPhaseChange('rest', null, this.currentRound);
      } else {
        // No rest (EMOM rest is built in)
        this.phase = 'work';
        this.phaseTimer = this._getWorkDuration();
        if (this.onPhaseChange) this.onPhaseChange('work', this._getCurrentExercise(), this.currentRound);
      }
    } else if (this.phase === 'rest' || this.phase === 'roundRest') {
      this.phase = 'work';
      this.phaseTimer = this._getWorkDuration();
      if (this.onPhaseChange) this.onPhaseChange('work', this._getCurrentExercise(), this.currentRound);
    }
  }

  _finish() {
    this.isRunning = false;
    this.phase = 'complete';

    // Estimate calories (rough: 8-12 cal/min of work time)
    const workMinutes = this.stats.totalWorkTime / 60;
    this.stats.estimatedCalories = Math.round(workMinutes * 10);
    this.stats.roundsCompleted = this.program.type === 'amrap'
      ? this.amrapRounds
      : this.currentRound;

    if (this.onComplete) this.onComplete(this.stats);
  }

  _getCurrentExercise() {
    if (this.program.type === 'amrap') {
      return this.program.circuit[this.amrapExerciseIndex];
    }
    const exercises = this.program.exercises;
    if (!exercises) return null;
    const idx = this.program.type === 'circuit'
      ? this.stats.exercisesCompleted % exercises.length
      : this.currentRound;
    return exercises[idx] || exercises[exercises.length - 1];
  }

  _getWorkDuration() {
    return this.program.workSec || 30;
  }

  _getRestDuration() {
    return this.program.restSec || 0;
  }
}

// CALORIE ESTIMATION

/**
 * Estimate calories burned for an exercise session
 * @param {string} exerciseType
 * @param {number} durationSec
 * @param {number} reps
 * @param {number} bodyWeightKg - Optional, default 70kg
 * @returns {Object} { calories, met, confidence }
 */
function estimateCalories(exerciseType, durationSec, reps, bodyWeightKg = 70) {
  // MET values (Compendium of Physical Activities, 2011)
  const METS = {
    squat: 5.0, pushup: 3.8, plank: 3.0, lunge: 5.0,
    shoulderpress: 3.5, deadlift: 6.0, wall_sit: 2.5,
    glute_bridge: 3.0, mountain_climbers: 8.0, burpees: 8.0,
    jumping_jacks: 7.0, high_knees: 8.0, squat_jump: 8.5,
    superman: 2.5, calf_raises: 3.0, tricep_dip: 3.5,
    side_plank: 3.0, bicycle_crunch: 3.5
  };

  const met = METS[exerciseType] || 4.0;
  const hours = durationSec / 3600;
  const calories = Math.round(met * bodyWeightKg * hours);

  return {
    calories: Math.max(calories, 1),
    met,
    confidence: METS[exerciseType] ? 'moderate' : 'low'
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HIIT_PROGRAMS, HIITSession, estimateCalories };
}
