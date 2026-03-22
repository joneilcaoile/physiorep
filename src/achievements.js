// Achievement system — gamification through badges and workout milestones

const BADGES = [
  { id: 'first_rep', name: 'First Rep', icon: '🌟', desc: 'Complete your first workout', check: (stats) => stats.totalWorkouts >= 1 },
  { id: 'streak_3', name: 'Hat Trick', icon: '🔥', desc: '3-day workout streak', check: (stats) => stats.streak >= 3 },
  { id: 'streak_7', name: 'Week Warrior', icon: '⚡', desc: '7-day workout streak', check: (stats) => stats.streak >= 7 },
  { id: 'streak_30', name: 'Iron Will', icon: '🏆', desc: '30-day workout streak', check: (stats) => stats.streak >= 30 },
  { id: 'perfect_form', name: 'Perfectionist', icon: '💎', desc: 'Score 100% form on any exercise', check: (stats) => stats.bestFormScore >= 100 },
  { id: 'form_master', name: 'Form Master', icon: '🎯', desc: 'Average 90%+ form across 10+ sessions', check: (stats) => stats.totalWorkouts >= 10 && stats.avgFormScore >= 90 },
  { id: 'centurion', name: 'Centurion', icon: '💯', desc: 'Complete 100 total reps in one session', check: (stats) => stats.bestSessionReps >= 100 },
  { id: 'variety', name: 'Well-Rounded', icon: '🎨', desc: 'Try all 6 exercises', check: (stats) => stats.uniqueExercises >= 6 },
  { id: 'plank_60', name: 'Plank Tank', icon: '🧱', desc: 'Hold a plank for 60+ seconds', check: (stats) => stats.bestPlankTime >= 60 },
  { id: 'early_bird', name: 'Early Bird', icon: '🌅', desc: 'Work out before 7 AM', check: (stats) => stats.hasEarlyWorkout },
  { id: 'night_owl', name: 'Night Owl', icon: '🦉', desc: 'Work out after 9 PM', check: (stats) => stats.hasLateWorkout },
  { id: 'comeback', name: 'Comeback Kid', icon: '🔄', desc: 'Return after 7+ days off', check: (stats) => stats.hasComeback },
];

class AchievementEngine {
  constructor() {
    this.unlocked = new Set();
    this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem('physiorep_achievements');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          arr.forEach(id => this.unlocked.add(id));
        } else {
          console.warn('Invalid achievements data: expected array');
        }
      }
    } catch (_e) {
      console.warn('Failed to load achievements:', _e);
    }
  }

  save() {
    try {
      localStorage.setItem('physiorep_achievements', JSON.stringify([...this.unlocked]));
    } catch (_e) { /* localStorage unavailable */ }
  }

  /**
   * Check all badges against current stats, return newly unlocked ones
   * @param {Object} stats - computed from workout history
   * @returns {Array} newly unlocked badges
   */
  evaluate(stats) {
    const newBadges = [];
    BADGES.forEach(badge => {
      if (!this.unlocked.has(badge.id) && badge.check(stats)) {
        this.unlocked.add(badge.id);
        newBadges.push(badge);
      }
    });
    if (newBadges.length > 0) this.save();
    return newBadges;
  }

  getAll() {
    return BADGES.map(b => ({
      ...b,
      unlocked: this.unlocked.has(b.id)
    }));
  }

  getUnlocked() {
    return BADGES.filter(b => this.unlocked.has(b.id));
  }

  getProgress() {
    return { unlocked: this.unlocked.size, total: BADGES.length };
  }
}

/**
 * Compute achievement stats from workout history
 * @param {Array} workouts - from physioRepDB.getWorkouts()
 * @returns {Object} stats object for evaluate()
 */
function computeAchievementStats(workouts) {
  if (!workouts || workouts.length === 0) {
    return {
      totalWorkouts: 0, streak: 0, bestFormScore: 0, avgFormScore: 0,
      bestSessionReps: 0, uniqueExercises: 0, bestPlankTime: 0,
      hasEarlyWorkout: false, hasLateWorkout: false, hasComeback: false
    };
  }

  const days = new Set();
  const exerciseTypes = new Set();
  let totalFormScore = 0;
  let bestFormScore = 0;
  let bestSessionReps = 0;
  let bestPlankTime = 0;
  let hasEarlyWorkout = false;
  let hasLateWorkout = false;

  workouts.forEach(w => {
    const d = new Date(w.date);
    days.add(d.toISOString().split('T')[0]);
    exerciseTypes.add(w.exerciseType);
    totalFormScore += (w.formScore || 0);
    if ((w.formScore || 0) > bestFormScore) bestFormScore = w.formScore;
    if ((w.reps || 0) > bestSessionReps) bestSessionReps = w.reps;
    if (w.exerciseType === 'plank' && (w.plankHoldTime || w.reps || 0) > bestPlankTime) {
      bestPlankTime = w.plankHoldTime || w.reps || 0;
    }
    const hour = d.getHours();
    if (hour < 7) hasEarlyWorkout = true;
    if (hour >= 21) hasLateWorkout = true;
  });

  // Streak from today
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.toISOString().split('T')[0])) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // Comeback detection: any gap of 7+ days between sessions
  let hasComeback = false;
  const sortedDays = [...days].sort();
  for (let i = 1; i < sortedDays.length; i++) {
    const gap = (new Date(sortedDays[i]) - new Date(sortedDays[i-1])) / (1000 * 60 * 60 * 24);
    if (gap >= 7) { hasComeback = true; break; }
  }

  return {
    totalWorkouts: workouts.length,
    streak,
    bestFormScore,
    avgFormScore: Math.round(totalFormScore / workouts.length),
    bestSessionReps,
    uniqueExercises: exerciseTypes.size,
    bestPlankTime,
    hasEarlyWorkout,
    hasLateWorkout,
    hasComeback
  };
}

const achievementEngine = new AchievementEngine();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AchievementEngine, BADGES, computeAchievementStats };
}
