// Workout programs — structured multi-week training with progressive overload

// PROGRAM LIBRARY

const PROGRAM_LIBRARY = [
  {
    id: 'beginner-strength',
    name: 'Beginner Strength',
    description: 'Build a foundation with basic movements. 3 days/week for 4 weeks.',
    category: 'strength',
    difficulty: 'beginner',
    durationWeeks: 4,
    daysPerWeek: 3,
    icon: '💪',
    premium: false,
    weeks: [
      {
        label: 'Week 1 — Learn the Movements',
        days: [
          { exercises: [{ type: 'squat', reps: 10 }, { type: 'pushup', reps: 8 }, { type: 'plank', holdSec: 20 }] },
          { exercises: [{ type: 'lunge', reps: 8 }, { type: 'shoulderpress', reps: 8 }, { type: 'plank', holdSec: 25 }] },
          { exercises: [{ type: 'squat', reps: 12 }, { type: 'pushup', reps: 10 }, { type: 'deadlift', reps: 8 }] }
        ]
      },
      {
        label: 'Week 2 — Build Volume',
        days: [
          { exercises: [{ type: 'squat', reps: 15 }, { type: 'pushup', reps: 12 }, { type: 'plank', holdSec: 30 }] },
          { exercises: [{ type: 'lunge', reps: 10 }, { type: 'shoulderpress', reps: 10 }, { type: 'deadlift', reps: 10 }] },
          { exercises: [{ type: 'squat', reps: 15 }, { type: 'pushup', reps: 12 }, { type: 'plank', holdSec: 35 }] }
        ]
      },
      {
        label: 'Week 3 — Push Harder',
        days: [
          { exercises: [{ type: 'squat', reps: 18 }, { type: 'pushup', reps: 15 }, { type: 'plank', holdSec: 40 }] },
          { exercises: [{ type: 'lunge', reps: 12 }, { type: 'shoulderpress', reps: 12 }, { type: 'deadlift', reps: 12 }] },
          { exercises: [{ type: 'squat', reps: 20 }, { type: 'pushup', reps: 15 }, { type: 'plank', holdSec: 45 }] }
        ]
      },
      {
        label: 'Week 4 — Test Yourself',
        days: [
          { exercises: [{ type: 'squat', reps: 20 }, { type: 'pushup', reps: 18 }, { type: 'plank', holdSec: 50 }] },
          { exercises: [{ type: 'lunge', reps: 15 }, { type: 'shoulderpress', reps: 15 }, { type: 'deadlift', reps: 15 }] },
          { exercises: [{ type: 'squat', reps: 25 }, { type: 'pushup', reps: 20 }, { type: 'plank', holdSec: 60 }] }
        ]
      }
    ]
  },
  {
    id: 'knee-rehab-4wk',
    name: '4-Week Knee Rehab',
    description: 'Gentle progression for knee recovery. Focus on quad strength and stability.',
    category: 'rehab',
    difficulty: 'beginner',
    durationWeeks: 4,
    daysPerWeek: 4,
    icon: '🦵',
    premium: true,
    weeks: [
      {
        label: 'Week 1 — Gentle Activation',
        days: [
          { exercises: [{ type: 'squat', reps: 5, note: 'Quarter depth only' }, { type: 'plank', holdSec: 15 }] },
          { exercises: [{ type: 'lunge', reps: 5, note: 'Shallow step' }, { type: 'plank', holdSec: 15 }] },
          { exercises: [{ type: 'squat', reps: 6 }, { type: 'plank', holdSec: 20 }] },
          { exercises: [{ type: 'lunge', reps: 6 }, { type: 'plank', holdSec: 20 }] }
        ]
      },
      {
        label: 'Week 2 — Building Confidence',
        days: [
          { exercises: [{ type: 'squat', reps: 8 }, { type: 'lunge', reps: 6 }, { type: 'plank', holdSec: 25 }] },
          { exercises: [{ type: 'squat', reps: 8 }, { type: 'plank', holdSec: 25 }] },
          { exercises: [{ type: 'lunge', reps: 8 }, { type: 'squat', reps: 10 }] },
          { exercises: [{ type: 'squat', reps: 10 }, { type: 'lunge', reps: 8 }, { type: 'plank', holdSec: 30 }] }
        ]
      },
      {
        label: 'Week 3 — Adding Challenge',
        days: [
          { exercises: [{ type: 'squat', reps: 12 }, { type: 'lunge', reps: 10 }, { type: 'plank', holdSec: 30 }] },
          { exercises: [{ type: 'squat', reps: 12 }, { type: 'deadlift', reps: 6 }] },
          { exercises: [{ type: 'lunge', reps: 10 }, { type: 'squat', reps: 15 }] },
          { exercises: [{ type: 'squat', reps: 15 }, { type: 'lunge', reps: 12 }, { type: 'plank', holdSec: 35 }] }
        ]
      },
      {
        label: 'Week 4 — Full Strength',
        days: [
          { exercises: [{ type: 'squat', reps: 15 }, { type: 'lunge', reps: 12 }, { type: 'deadlift', reps: 8 }] },
          { exercises: [{ type: 'squat', reps: 18 }, { type: 'plank', holdSec: 40 }] },
          { exercises: [{ type: 'lunge', reps: 15 }, { type: 'squat', reps: 20 }] },
          { exercises: [{ type: 'squat', reps: 20 }, { type: 'lunge', reps: 15 }, { type: 'plank', holdSec: 45 }] }
        ]
      }
    ]
  },
  {
    id: 'upper-body-builder',
    name: 'Upper Body Builder',
    description: 'Chest, shoulders, and arms in 3 weeks. For intermediate users.',
    category: 'strength',
    difficulty: 'intermediate',
    durationWeeks: 3,
    daysPerWeek: 3,
    icon: '🏋️',
    premium: true,
    weeks: [
      {
        label: 'Week 1 — Base',
        days: [
          { exercises: [{ type: 'pushup', reps: 15 }, { type: 'shoulderpress', reps: 12 }, { type: 'plank', holdSec: 30 }] },
          { exercises: [{ type: 'pushup', reps: 15 }, { type: 'shoulderpress', reps: 12 }] },
          { exercises: [{ type: 'pushup', reps: 18 }, { type: 'shoulderpress', reps: 15 }, { type: 'plank', holdSec: 35 }] }
        ]
      },
      {
        label: 'Week 2 — Volume',
        days: [
          { exercises: [{ type: 'pushup', reps: 20 }, { type: 'shoulderpress', reps: 15 }, { type: 'plank', holdSec: 40 }] },
          { exercises: [{ type: 'pushup', reps: 22 }, { type: 'shoulderpress', reps: 18 }] },
          { exercises: [{ type: 'pushup', reps: 25 }, { type: 'shoulderpress', reps: 20 }, { type: 'plank', holdSec: 45 }] }
        ]
      },
      {
        label: 'Week 3 — Peak',
        days: [
          { exercises: [{ type: 'pushup', reps: 28 }, { type: 'shoulderpress', reps: 22 }, { type: 'plank', holdSec: 50 }] },
          { exercises: [{ type: 'pushup', reps: 30 }, { type: 'shoulderpress', reps: 25 }] },
          { exercises: [{ type: 'pushup', reps: 30 }, { type: 'shoulderpress', reps: 25 }, { type: 'plank', holdSec: 60 }] }
        ]
      }
    ]
  },
  {
    id: 'post-surgery-gentle',
    name: 'Post-Surgery Recovery',
    description: 'Ultra-gentle return to movement. Low reps, high form focus.',
    category: 'rehab',
    difficulty: 'beginner',
    durationWeeks: 4,
    daysPerWeek: 3,
    icon: '🩺',
    premium: true,
    weeks: [
      {
        label: 'Week 1 — Movement Reintroduction',
        days: [
          { exercises: [{ type: 'plank', holdSec: 10 }] },
          { exercises: [{ type: 'squat', reps: 3, note: 'Very shallow' }] },
          { exercises: [{ type: 'plank', holdSec: 15 }, { type: 'squat', reps: 5 }] }
        ]
      },
      {
        label: 'Week 2 — Building Tolerance',
        days: [
          { exercises: [{ type: 'squat', reps: 6 }, { type: 'plank', holdSec: 20 }] },
          { exercises: [{ type: 'lunge', reps: 4 }, { type: 'plank', holdSec: 20 }] },
          { exercises: [{ type: 'squat', reps: 8 }, { type: 'lunge', reps: 5 }] }
        ]
      },
      {
        label: 'Week 3 — Light Strengthening',
        days: [
          { exercises: [{ type: 'squat', reps: 10 }, { type: 'pushup', reps: 5 }, { type: 'plank', holdSec: 25 }] },
          { exercises: [{ type: 'lunge', reps: 8 }, { type: 'shoulderpress', reps: 6 }] },
          { exercises: [{ type: 'squat', reps: 12 }, { type: 'pushup', reps: 8 }, { type: 'plank', holdSec: 30 }] }
        ]
      },
      {
        label: 'Week 4 — Functional Baseline',
        days: [
          { exercises: [{ type: 'squat', reps: 12 }, { type: 'pushup', reps: 10 }, { type: 'plank', holdSec: 30 }] },
          { exercises: [{ type: 'lunge', reps: 10 }, { type: 'shoulderpress', reps: 8 }, { type: 'deadlift', reps: 6 }] },
          { exercises: [{ type: 'squat', reps: 15 }, { type: 'pushup', reps: 12 }, { type: 'plank', holdSec: 40 }] }
        ]
      }
    ]
  },
  {
    id: 'full-body-shred',
    name: 'Full Body Shred',
    description: 'High-rep total body conditioning. 4 days/week, 3 weeks. Not for beginners.',
    category: 'strength',
    difficulty: 'advanced',
    durationWeeks: 3,
    daysPerWeek: 4,
    icon: '🔥',
    premium: true,
    weeks: [
      {
        label: 'Week 1 — Foundation',
        days: [
          { exercises: [{ type: 'squat', reps: 20 }, { type: 'pushup', reps: 15 }, { type: 'plank', holdSec: 45 }] },
          { exercises: [{ type: 'lunge', reps: 15 }, { type: 'shoulderpress', reps: 15 }, { type: 'deadlift', reps: 12 }] },
          { exercises: [{ type: 'squat', reps: 22 }, { type: 'pushup', reps: 18 }, { type: 'plank', holdSec: 50 }] },
          { exercises: [{ type: 'lunge', reps: 18 }, { type: 'shoulderpress', reps: 18 }, { type: 'deadlift', reps: 15 }] }
        ]
      },
      {
        label: 'Week 2 — Intensity',
        days: [
          { exercises: [{ type: 'squat', reps: 25 }, { type: 'pushup', reps: 20 }, { type: 'plank', holdSec: 55 }] },
          { exercises: [{ type: 'lunge', reps: 20 }, { type: 'shoulderpress', reps: 20 }, { type: 'deadlift', reps: 18 }] },
          { exercises: [{ type: 'squat', reps: 28 }, { type: 'pushup', reps: 22 }, { type: 'plank', holdSec: 60 }] },
          { exercises: [{ type: 'lunge', reps: 22 }, { type: 'shoulderpress', reps: 22 }, { type: 'deadlift', reps: 20 }] }
        ]
      },
      {
        label: 'Week 3 — Max Effort',
        days: [
          { exercises: [{ type: 'squat', reps: 30 }, { type: 'pushup', reps: 25 }, { type: 'plank', holdSec: 60 }] },
          { exercises: [{ type: 'lunge', reps: 25 }, { type: 'shoulderpress', reps: 25 }, { type: 'deadlift', reps: 22 }] },
          { exercises: [{ type: 'squat', reps: 30 }, { type: 'pushup', reps: 28 }, { type: 'plank', holdSec: 70 }] },
          { exercises: [{ type: 'lunge', reps: 25 }, { type: 'shoulderpress', reps: 25 }, { type: 'deadlift', reps: 25 }] }
        ]
      }
    ]
  }
];

// EXERCISE NAME MAP
const EXERCISE_NAMES = {
  squat: 'Squats', pushup: 'Push-Ups', plank: 'Plank',
  lunge: 'Lunges', shoulderpress: 'Shoulder Press', deadlift: 'Deadlift'
};

// PROGRAM ENGINE

class ProgramEngine {
  constructor() {
    this.activeProgram = null;
    this.progress = null;
    this._load();
  }

  /**
   * Load active program and progress from localStorage
   */
  _load() {
    try {
      const saved = localStorage.getItem('physiorep_active_program');
      if (saved) {
        const data = JSON.parse(saved);
        if (data && typeof data === 'object') {
          this.activeProgram = data.program || null;
          this.progress = data.progress || null;
        } else {
          console.warn('Invalid program data: expected object');
        }
      }
    } catch (e) {
      console.warn('ProgramEngine: Failed to load state', e);
    }
  }

  /**
   * Save current state to localStorage
   */
  _save() {
    try {
      if (this.activeProgram && this.progress) {
        localStorage.setItem('physiorep_active_program', JSON.stringify({
          program: this.activeProgram,
          progress: this.progress
        }));
      } else {
        localStorage.removeItem('physiorep_active_program');
      }
    } catch (e) {
      console.warn('ProgramEngine: Failed to save state', e);
    }
  }

  /**
   * Start a program
   * @param {string} programId - ID from PROGRAM_LIBRARY
   * @returns {Object|null} The active program, or null if not found
   */
  startProgram(programId) {
    const template = PROGRAM_LIBRARY.find(p => p.id === programId);
    if (!template) return null;

    this.activeProgram = { ...template };
    this.progress = {
      startDate: new Date().toISOString(),
      currentWeek: 0,
      currentDay: 0,
      completedDays: [],  // Array of { week, day, date, workoutIds }
      skippedDays: []
    };
    this._save();
    return this.activeProgram;
  }

  /**
   * Get the active program, or null
   */
  getActiveProgram() {
    return this.activeProgram;
  }

  /**
   * Get current progress summary
   */
  getProgress() {
    if (!this.activeProgram || !this.progress) return null;

    const totalDays = this.activeProgram.weeks.reduce((sum, w) => sum + w.days.length, 0);
    const completedCount = this.progress.completedDays.length;
    const pct = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;

    return {
      programName: this.activeProgram.name,
      currentWeek: this.progress.currentWeek,
      currentDay: this.progress.currentDay,
      totalWeeks: this.activeProgram.weeks.length,
      totalDays,
      completedDays: completedCount,
      percentComplete: pct,
      startDate: this.progress.startDate
    };
  }

  /**
   * Get today's workout (the next uncompleted day)
   * @returns {Object|null} { week, day, weekLabel, exercises }
   */
  getTodaysWorkout() {
    if (!this.activeProgram || !this.progress) return null;

    const w = this.progress.currentWeek;
    const d = this.progress.currentDay;

    if (w >= this.activeProgram.weeks.length) return null; // Program complete

    const week = this.activeProgram.weeks[w];
    if (d >= week.days.length) return null; // Shouldn't happen

    return {
      week: w,
      day: d,
      weekLabel: week.label,
      exercises: week.days[d].exercises
    };
  }

  /**
   * Mark today's workout as complete and advance to next day
   * @param {Array} workoutIds - IDs of saved workouts from this session
   */
  completeDay(workoutIds = []) {
    if (!this.activeProgram || !this.progress) return;

    this.progress.completedDays.push({
      week: this.progress.currentWeek,
      day: this.progress.currentDay,
      date: new Date().toISOString(),
      workoutIds
    });

    // Advance
    this.progress.currentDay++;
    const currentWeekData = this.activeProgram.weeks[this.progress.currentWeek];

    if (this.progress.currentDay >= currentWeekData.days.length) {
      this.progress.currentWeek++;
      this.progress.currentDay = 0;
    }

    this._save();
  }

  /**
   * Skip a day (user can't do it today)
   */
  skipDay() {
    if (!this.activeProgram || !this.progress) return;

    this.progress.skippedDays.push({
      week: this.progress.currentWeek,
      day: this.progress.currentDay,
      date: new Date().toISOString()
    });

    // Advance same as complete
    this.progress.currentDay++;
    const currentWeekData = this.activeProgram.weeks[this.progress.currentWeek];

    if (this.progress.currentDay >= currentWeekData.days.length) {
      this.progress.currentWeek++;
      this.progress.currentDay = 0;
    }

    this._save();
  }

  /**
   * Check if the program is complete
   */
  isComplete() {
    if (!this.activeProgram || !this.progress) return false;
    return this.progress.currentWeek >= this.activeProgram.weeks.length;
  }

  /**
   * Quit the active program
   */
  quitProgram() {
    this.activeProgram = null;
    this.progress = null;
    this._save();
  }

  /**
   * Get all available programs
   * @param {string} filter - 'all', 'strength', 'rehab', 'free', 'premium'
   */
  getLibrary(filter = 'all') {
    switch (filter) {
    case 'strength': return PROGRAM_LIBRARY.filter(p => p.category === 'strength');
    case 'rehab': return PROGRAM_LIBRARY.filter(p => p.category === 'rehab');
    case 'free': return PROGRAM_LIBRARY.filter(p => !p.premium);
    case 'premium': return PROGRAM_LIBRARY.filter(p => p.premium);
    default: return [...PROGRAM_LIBRARY];
    }
  }
}

// Singleton
const programEngine = new ProgramEngine();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProgramEngine, PROGRAM_LIBRARY, EXERCISE_NAMES };
}
