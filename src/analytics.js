// Progress analytics — transforms workout data into visual insights and trends

class AnalyticsEngine {
  constructor() {
    this.cache = {};
    this.cacheExpiry = 60000; // 1 minute cache
  }

  /**
   * Compute all analytics from workout history
   * @param {Array} workouts - All workouts from IndexedDB
   * @returns {Object} Full analytics payload
   */
  compute(workouts) {
    if (!workouts || workouts.length === 0) {
      return this._emptyAnalytics();
    }

    return {
      fitnessScore: this._computeFitnessScore(workouts),
      formTrends: this._computeFormTrends(workouts),
      frequencyMap: this._computeFrequencyMap(workouts),
      personalRecords: this._computePersonalRecords(workouts),
      bodyRadar: this._computeBodyRadar(workouts),
      streakStats: this._computeStreakStats(workouts),
      volumeStats: this._computeVolumeStats(workouts),
      flexibilityScores: this._computeFlexibilityScores(workouts),
      weekOverWeek: this._computeWeekOverWeek(workouts)
    };
  }

  // FITNESS SCORE (Gamification Core)

  /**
   * Single composite "Fitness Score" 0-1000
   * Factors: consistency (40%), form quality (30%), volume (20%), variety (10%)
   */
  _computeFitnessScore(workouts) {
    const last30 = this._filterDays(workouts, 30);
    const last7 = this._filterDays(workouts, 7);

    // Consistency: days with workouts in last 30 days (max ~20 workout days)
    const activeDays30 = new Set(last30.map(w => w.date ? w.date.slice(0, 10) : '')).size;
    const consistencyScore = Math.min(activeDays30 / 20, 1) * 400;

    // Form quality: average form score of last 30 days
    const formScores = last30.filter(w => w.formScore !== null && w.formScore !== undefined).map(w => w.formScore);
    const avgForm = formScores.length > 0
      ? formScores.reduce((a, b) => a + b, 0) / formScores.length
      : 0;
    const formScore = (avgForm / 100) * 300;

    // Volume: total reps in last 7 days (scaled, 200 reps = max)
    const weeklyReps = last7.reduce((sum, w) => sum + (w.reps || 0), 0);
    const volumeScore = Math.min(weeklyReps / 200, 1) * 200;

    // Variety: unique exercise types used in last 30 days (6 possible)
    const uniqueExercises = new Set(last30.map(w => w.exerciseType)).size;
    const varietyScore = Math.min(uniqueExercises / 6, 1) * 100;

    const total = Math.round(consistencyScore + formScore + volumeScore + varietyScore);

    // Determine tier
    let tier, tierColor;
    if (total >= 800) { tier = 'Elite'; tierColor = '#FFD700'; }
    else if (total >= 600) { tier = 'Advanced'; tierColor = '#C084FC'; }
    else if (total >= 400) { tier = 'Intermediate'; tierColor = '#60A5FA'; }
    else if (total >= 200) { tier = 'Beginner'; tierColor = '#34D399'; }
    else { tier = 'Starter'; tierColor = '#9CA3AF'; }

    return {
      total,
      tier,
      tierColor,
      breakdown: {
        consistency: Math.round(consistencyScore),
        form: Math.round(formScore),
        volume: Math.round(volumeScore),
        variety: Math.round(varietyScore)
      },
      maxScore: 1000,
      activeDays30,
      avgForm: Math.round(avgForm),
      weeklyReps,
      uniqueExercises
    };
  }

  // FORM TRENDS

  _computeFormTrends(workouts) {
    const byExercise = {};

    for (const w of workouts) {
      if (!w.exerciseType || w.formScore === null || w.formScore === undefined) continue;
      if (!byExercise[w.exerciseType]) byExercise[w.exerciseType] = [];
      byExercise[w.exerciseType].push({
        date: w.date,
        score: w.formScore,
        reps: w.reps || 0
      });
    }

    // Sort each by date ascending
    for (const key of Object.keys(byExercise)) {
      byExercise[key].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }

    // Compute moving averages (3-session window)
    const trends = {};
    for (const [exercise, data] of Object.entries(byExercise)) {
      trends[exercise] = data.map((d, i) => {
        const window = data.slice(Math.max(0, i - 2), i + 1);
        const avg = window.reduce((s, w) => s + w.score, 0) / window.length;
        return { ...d, movingAvg: Math.round(avg) };
      });
    }

    return trends;
  }

  // FREQUENCY HEATMAP

  /**
   * GitHub-style contribution grid for last 12 weeks
   */
  _computeFrequencyMap(workouts) {
    const now = new Date();
    const grid = [];
    const dayMs = 86400000;

    // Build 84-day (12 week) grid
    for (let i = 83; i >= 0; i--) {
      const d = new Date(now.getTime() - i * dayMs);
      const key = d.toISOString().slice(0, 10);
      grid.push({ date: key, count: 0, dayOfWeek: d.getDay() });
    }

    // Count workouts per day
    for (const w of workouts) {
      if (!w.date) continue;
      const key = w.date.slice(0, 10);
      const cell = grid.find(g => g.date === key);
      if (cell) cell.count++;
    }

    // Assign intensity levels (0-4)
    for (const cell of grid) {
      if (cell.count === 0) cell.level = 0;
      else if (cell.count === 1) cell.level = 1;
      else if (cell.count === 2) cell.level = 2;
      else if (cell.count <= 4) cell.level = 3;
      else cell.level = 4;
    }

    return grid;
  }

  // PERSONAL RECORDS

  _computePersonalRecords(workouts) {
    const records = {};

    for (const w of workouts) {
      if (!w.exerciseType) continue;
      const key = w.exerciseType;

      if (!records[key]) {
        records[key] = {
          maxReps: 0, maxRepsDate: null,
          bestForm: 0, bestFormDate: null,
          maxPlankHold: 0, maxPlankHoldDate: null,
          totalReps: 0, sessions: 0
        };
      }

      const r = records[key];
      r.sessions++;
      r.totalReps += (w.reps || 0);

      if ((w.reps || 0) > r.maxReps) {
        r.maxReps = w.reps;
        r.maxRepsDate = w.date;
      }
      if ((w.formScore || 0) > r.bestForm) {
        r.bestForm = w.formScore;
        r.bestFormDate = w.date;
      }
      if (key === 'plank' && (w.plankHoldTime || 0) > r.maxPlankHold) {
        r.maxPlankHold = w.plankHoldTime;
        r.maxPlankHoldDate = w.date;
      }
    }

    return records;
  }

  // BODY AREA RADAR

  /**
   * Strength radar by body area based on exercise volume and form
   * Areas: Legs, Chest, Core, Shoulders, Back, Arms
   */
  _computeBodyRadar(workouts) {
    const last30 = this._filterDays(workouts, 30);

    // Map exercises to body areas with weights
    const areaMap = {
      squat:        { Legs: 1.0, Core: 0.3 },
      pushup:       { Chest: 1.0, Arms: 0.5, Core: 0.3 },
      plank:        { Core: 1.0, Shoulders: 0.2 },
      lunge:        { Legs: 1.0, Core: 0.3 },
      shoulderpress:{ Shoulders: 1.0, Arms: 0.5 },
      deadlift:     { Back: 1.0, Legs: 0.5, Core: 0.3 }
    };

    const areas = { Legs: 0, Chest: 0, Core: 0, Shoulders: 0, Back: 0, Arms: 0 };
    const maxPerArea = 100; // Normalize to 0-100

    for (const w of last30) {
      const mapping = areaMap[w.exerciseType];
      if (!mapping) continue;
      const score = ((w.reps || 0) * ((w.formScore || 50) / 100));
      for (const [area, weight] of Object.entries(mapping)) {
        areas[area] += score * weight;
      }
    }

    // Normalize — scale so that 300 total weighted rep-score = 100
    const normalized = {};
    for (const [area, raw] of Object.entries(areas)) {
      normalized[area] = Math.min(Math.round((raw / 300) * 100), maxPerArea);
    }

    return normalized;
  }

  // STREAK STATS

  _computeStreakStats(workouts) {
    if (workouts.length === 0) return { current: 0, longest: 0, thisWeek: 0, thisMonth: 0 };

    const days = [...new Set(workouts.map(w => w.date ? w.date.slice(0, 10) : ''))].sort();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dayMs = 86400000;

    // Current streak (consecutive days ending today or yesterday)
    let current = 0;
    let checkDate = new Date(todayStr);
    for (let i = 0; i < 365; i++) {
      const key = checkDate.toISOString().slice(0, 10);
      if (days.includes(key)) {
        current++;
        checkDate = new Date(checkDate.getTime() - dayMs);
      } else if (i === 0) {
        // Allow today to not have a workout yet
        checkDate = new Date(checkDate.getTime() - dayMs);
        continue;
      } else {
        break;
      }
    }

    // Longest streak
    let longest = 0;
    let streak = 0;
    let prevDate = null;
    for (const d of days) {
      if (prevDate) {
        const diff = (new Date(d).getTime() - new Date(prevDate).getTime()) / dayMs;
        if (diff <= 1) {
          streak++;
        } else {
          longest = Math.max(longest, streak);
          streak = 1;
        }
      } else {
        streak = 1;
      }
      prevDate = d;
    }
    longest = Math.max(longest, streak);

    // This week
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeek = workouts.filter(w => w.date && new Date(w.date) >= weekStart).length;

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = workouts.filter(w => w.date && new Date(w.date) >= monthStart).length;

    return { current, longest, thisWeek, thisMonth };
  }

  // VOLUME STATS

  _computeVolumeStats(workouts) {
    const last7 = this._filterDays(workouts, 7);
    const prev7 = this._filterDays(workouts, 14).filter(w => !last7.includes(w));

    const thisWeekReps = last7.reduce((s, w) => s + (w.reps || 0), 0);
    const lastWeekReps = prev7.reduce((s, w) => s + (w.reps || 0), 0);
    const change = lastWeekReps > 0
      ? Math.round(((thisWeekReps - lastWeekReps) / lastWeekReps) * 100)
      : (thisWeekReps > 0 ? 100 : 0);

    return {
      thisWeekReps,
      lastWeekReps,
      weekOverWeekChange: change,
      totalAllTime: workouts.reduce((s, w) => s + (w.reps || 0), 0),
      totalSessions: workouts.length
    };
  }

  // FLEXIBILITY SCORES

  /**
   * Estimate flexibility from ROM data saved in workouts
   * Uses max joint angles achieved with good form
   */
  _computeFlexibilityScores(workouts) {
    const last30 = this._filterDays(workouts, 30);
    const scores = {};

    // Squat depth → hip/knee flexibility
    const squats = last30.filter(w => w.exerciseType === 'squat' && w.rom);
    if (squats.length > 0) {
      const minKneeAngles = squats
        .map(w => w.rom && w.rom.minKneeAngle)
        .filter(a => a !== null && a !== undefined && a > 0);
      if (minKneeAngles.length > 0) {
        const bestAngle = Math.min(...minKneeAngles);
        // Lower angle = deeper squat = better flexibility. 60° = perfect, 120° = stiff
        scores.squat_depth = {
          angle: Math.round(bestAngle),
          score: Math.min(Math.round(((120 - bestAngle) / 60) * 100), 100),
          label: bestAngle < 70 ? 'Excellent' : bestAngle < 90 ? 'Good' : bestAngle < 110 ? 'Fair' : 'Limited'
        };
      }
    }

    // Shoulder press ROM → shoulder flexibility
    const presses = last30.filter(w => w.exerciseType === 'shoulderpress' && w.rom);
    if (presses.length > 0) {
      const maxElbowAngles = presses
        .map(w => w.rom && w.rom.maxElbowAngle)
        .filter(a => a !== null && a !== undefined);
      if (maxElbowAngles.length > 0) {
        const bestAngle = Math.max(...maxElbowAngles);
        // Higher angle = fuller extension = better. 170° = perfect, 130° = limited
        scores.shoulder_mobility = {
          angle: Math.round(bestAngle),
          score: Math.min(Math.round(((bestAngle - 130) / 40) * 100), 100),
          label: bestAngle > 165 ? 'Excellent' : bestAngle > 150 ? 'Good' : bestAngle > 140 ? 'Fair' : 'Limited'
        };
      }
    }

    // Deadlift hip hinge → hamstring flexibility
    const deadlifts = last30.filter(w => w.exerciseType === 'deadlift' && w.rom);
    if (deadlifts.length > 0) {
      const minHipAngles = deadlifts
        .map(w => w.rom && w.rom.minHipAngle)
        .filter(a => a !== null && a !== undefined && a > 0);
      if (minHipAngles.length > 0) {
        const bestAngle = Math.min(...minHipAngles);
        scores.hamstring_flexibility = {
          angle: Math.round(bestAngle),
          score: Math.min(Math.round(((120 - bestAngle) / 50) * 100), 100),
          label: bestAngle < 80 ? 'Excellent' : bestAngle < 95 ? 'Good' : bestAngle < 110 ? 'Fair' : 'Limited'
        };
      }
    }

    // Overall flexibility score (average of available scores)
    const allScores = Object.values(scores).map(s => s.score).filter(s => s !== null && s !== undefined);
    const overall = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : null;

    return { ...scores, overall };
  }

  // WEEK OVER WEEK

  _computeWeekOverWeek(workouts) {
    const now = new Date();
    const weeks = [];

    for (let i = 0; i < 8; i++) {
      const weekEnd = new Date(now.getTime() - i * 7 * 86400000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
      const weekWorkouts = workouts.filter(w => {
        if (!w.date) return false;
        const d = new Date(w.date);
        return d >= weekStart && d < weekEnd;
      });

      weeks.push({
        weekLabel: `Week -${i}`,
        startDate: weekStart.toISOString().slice(0, 10),
        sessions: weekWorkouts.length,
        reps: weekWorkouts.reduce((s, w) => s + (w.reps || 0), 0),
        avgForm: weekWorkouts.length > 0
          ? Math.round(weekWorkouts.reduce((s, w) => s + (w.formScore || 0), 0) / weekWorkouts.length)
          : 0
      });
    }

    return weeks.reverse(); // oldest first
  }

  // HELPERS

  _filterDays(workouts, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return workouts.filter(w => w.date && new Date(w.date) >= cutoff);
  }

  _emptyAnalytics() {
    return {
      fitnessScore: { total: 0, tier: 'Starter', tierColor: '#9CA3AF', breakdown: { consistency: 0, form: 0, volume: 0, variety: 0 }, maxScore: 1000 },
      formTrends: {},
      frequencyMap: [],
      personalRecords: {},
      bodyRadar: { Legs: 0, Chest: 0, Core: 0, Shoulders: 0, Back: 0, Arms: 0 },
      streakStats: { current: 0, longest: 0, thisWeek: 0, thisMonth: 0 },
      volumeStats: { thisWeekReps: 0, lastWeekReps: 0, weekOverWeekChange: 0, totalAllTime: 0, totalSessions: 0 },
      flexibilityScores: { overall: null },
      weekOverWeek: []
    };
  }
}

// Singleton
const analyticsEngine = new AnalyticsEngine();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AnalyticsEngine };
}
