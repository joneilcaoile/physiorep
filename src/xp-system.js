// XP & leveling — gamification with titles and progression

const XP_TITLES = [
  { level: 1, title: 'Beginner', color: '#666' },
  { level: 5, title: 'Rookie', color: '#4a9' },
  { level: 10, title: 'Regular', color: '#3b8' },
  { level: 15, title: 'Dedicated', color: '#2a7' },
  { level: 20, title: 'Committed', color: '#06d6a0' },
  { level: 25, title: 'Athlete', color: '#26a' },
  { level: 30, title: 'Warrior', color: '#19f' },
  { level: 40, title: 'Champion', color: '#a0f' },
  { level: 50, title: 'Elite', color: '#f0a' },
  { level: 60, title: 'Master', color: '#fa0' },
  { level: 75, title: 'Legend', color: '#f60' },
  { level: 90, title: 'Mythic', color: '#f00' },
  { level: 100, title: 'Transcendent', color: '#fff' }
];

const STORAGE_KEY = 'physiorep_xp_data';

class XPEngine {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          return data;
        } else {
          console.warn('Invalid XP data: expected object');
        }
      }
    } catch (e) {
      console.warn('Failed to load XP data:', e);
    }
    return { totalXP: 0, level: 1, history: [] };
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) { /* ignore */ }
  }

  /**
   * Calculate XP required for a given level
   * Uses a curve: each level needs slightly more XP
   */
  xpForLevel(level) {
    return Math.round(100 * Math.pow(level, 1.5));
  }

  /**
   * Get cumulative XP needed to reach a level
   */
  cumulativeXPForLevel(level) {
    let total = 0;
    for (let i = 1; i < level; i++) {
      total += this.xpForLevel(i);
    }
    return total;
  }

  /**
   * Award XP for a workout
   * @param {Object} workout - { exerciseType, reps, duration, formScore, isHIIT, isProgramWorkout }
   * @returns {Object} { xpEarned, multipliers, levelUp, newLevel, newTitle }
   */
  awardXP(workout) {
    const base = this._calcBaseXP(workout);
    const multipliers = this._getMultipliers(workout);
    const totalMultiplier = multipliers.reduce((m, item) => m * item.value, 1);
    const xpEarned = Math.round(base * totalMultiplier);

    this.data.totalXP += xpEarned;
    this.data.history.push({
      date: new Date().toISOString(),
      xp: xpEarned,
      exercise: workout.exerciseType,
      multipliers: multipliers.map(m => m.label)
    });

    // Keep only last 100 history entries
    if (this.data.history.length > 100) {
      this.data.history = this.data.history.slice(-100);
    }

    // Check level up
    const oldLevel = this.data.level;
    this._recalcLevel();
    const levelUp = this.data.level > oldLevel;

    this._save();

    return {
      xpEarned,
      totalXP: this.data.totalXP,
      multipliers,
      levelUp,
      newLevel: this.data.level,
      newTitle: levelUp ? this.getTitle().title : null,
      xpToNext: this._xpToNextLevel()
    };
  }

  _calcBaseXP(workout) {
    let xp = 0;

    // Reps XP (2 XP per rep)
    xp += (workout.reps || 0) * 2;

    // Duration XP (1 XP per 10 seconds)
    xp += Math.floor((workout.duration || 0) / 10);

    // Minimum 10 XP per workout
    xp = Math.max(xp, 10);

    return xp;
  }

  _getMultipliers(workout) {
    const mults = [];

    // Form bonus
    if (workout.formScore >= 90) {
      mults.push({ label: 'Perfect Form', value: 1.5, icon: '⭐' });
    } else if (workout.formScore >= 75) {
      mults.push({ label: 'Good Form', value: 1.25, icon: '👍' });
    }

    // Streak bonus (consecutive days)
    const streak = this._getStreak();
    if (streak >= 7) {
      mults.push({ label: `${streak}-Day Streak`, value: 1.5, icon: '🔥' });
    } else if (streak >= 3) {
      mults.push({ label: `${streak}-Day Streak`, value: 1.25, icon: '🔥' });
    }

    // Program workout bonus
    if (workout.isProgramWorkout) {
      mults.push({ label: 'Program Workout', value: 1.3, icon: '📋' });
    }

    // HIIT bonus
    if (workout.isHIIT) {
      mults.push({ label: 'HIIT Bonus', value: 1.2, icon: '⚡' });
    }

    // Early bird (before 8am) or night owl (after 9pm)
    const hour = new Date().getHours();
    if (hour < 8) {
      mults.push({ label: 'Early Bird', value: 1.1, icon: '🌅' });
    } else if (hour >= 21) {
      mults.push({ label: 'Night Owl', value: 1.1, icon: '🌙' });
    }

    return mults;
  }

  _getStreak() {
    const history = this.data.history;
    if (history.length === 0) return 0;

    let streak = 1;
    const today = new Date().toDateString();
    const lastDate = new Date(history[history.length - 1].date).toDateString();
    if (lastDate !== today && lastDate !== new Date(Date.now() - 86400000).toDateString()) return 0;

    const dates = [...new Set(history.map(h => new Date(h.date).toDateString()))].sort().reverse();
    for (let i = 1; i < dates.length; i++) {
      const diff = new Date(dates[i - 1]) - new Date(dates[i]);
      if (diff <= 86400000 * 1.5) { // Allow ~1.5 day gap for timezone issues
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  _recalcLevel() {
    let level = 1;
    let xpRemaining = this.data.totalXP;
    while (level < 100 && xpRemaining >= this.xpForLevel(level)) {
      xpRemaining -= this.xpForLevel(level);
      level++;
    }
    this.data.level = level;
  }

  _xpToNextLevel() {
    if (this.data.level >= 100) return 0;
    const cumNext = this.cumulativeXPForLevel(this.data.level + 1);
    return Math.max(0, cumNext - this.data.totalXP);
  }

  /**
   * Get current title based on level
   */
  getTitle() {
    let current = XP_TITLES[0];
    for (const t of XP_TITLES) {
      if (this.data.level >= t.level) current = t;
    }
    return { ...current, level: this.data.level };
  }

  /**
   * Get progress info for display
   */
  getProgress() {
    const title = this.getTitle();
    const xpNeeded = this.xpForLevel(this.data.level);
    const cumCurrent = this.cumulativeXPForLevel(this.data.level);
    const xpInLevel = this.data.totalXP - cumCurrent;
    const percent = this.data.level >= 100 ? 100 : Math.round((xpInLevel / xpNeeded) * 100);

    return {
      level: this.data.level,
      title: title.title,
      titleColor: title.color,
      totalXP: this.data.totalXP,
      xpInLevel,
      xpNeeded,
      percent: Math.min(percent, 100),
      xpToNext: this._xpToNextLevel(),
      streak: this._getStreak(),
      recentHistory: this.data.history.slice(-10).reverse()
    };
  }

  /**
   * Reset all XP data
   */
  reset() {
    this.data = { totalXP: 0, level: 1, history: [] };
    this._save();
  }
}

const xpEngine = new XPEngine();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { XPEngine, XP_TITLES };
}
