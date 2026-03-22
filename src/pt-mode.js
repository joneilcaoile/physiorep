// PT compliance mode — tracks adherence and generates shareable reports

// PT PRESCRIPTION

class PTProgram {
  constructor(data = {}) {
    this.id = data.id || Date.now().toString(36);
    this.therapistName = data.therapistName || '';
    this.patientName = data.patientName || '';
    this.diagnosis = data.diagnosis || '';
    this.startDate = data.startDate || new Date().toISOString();
    this.exercises = data.exercises || []; // [{exerciseType, sets, reps, holdTime, frequency, notes}]
    this.schedule = data.schedule || { daysPerWeek: 3, reminderTime: '09:00' };
    this.active = data.active !== undefined ? data.active : true;
  }

  /**
   * Calculate overall program compliance percentage
   * @param {Array} completedSessions - workout history from DB
   * @returns {Object} { overall, byExercise, streak, missedDays }
   */
  getCompliance(completedSessions) {
    const startDate = new Date(this.startDate);
    const now = new Date();
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    const expectedSessions = Math.floor(daysSinceStart * (this.schedule.daysPerWeek / 7));

    if (expectedSessions === 0) {
      return { overall: 100, byExercise: {}, streak: 0, missedDays: 0, totalExpected: 0, totalCompleted: 0 };
    }

    // Filter sessions that match prescribed exercises
    const prescribedTypes = new Set(this.exercises.map(e => e.exerciseType));
    const matchingSessions = completedSessions.filter(s => prescribedTypes.has(s.exerciseType));

    // Group by day
    const sessionDays = new Set();
    matchingSessions.forEach(s => {
      sessionDays.add(new Date(s.date).toISOString().split('T')[0]);
    });

    // Per-exercise compliance
    const byExercise = {};
    this.exercises.forEach(ex => {
      const exSessions = matchingSessions.filter(s => s.exerciseType === ex.exerciseType);
      const expectedForExercise = expectedSessions;
      byExercise[ex.exerciseType] = {
        name: ex.exerciseType,
        completed: exSessions.length,
        expected: expectedForExercise,
        percentage: Math.min(100, Math.round((exSessions.length / Math.max(1, expectedForExercise)) * 100)),
        avgFormScore: exSessions.length > 0
          ? Math.round(exSessions.reduce((s, e) => s + (e.formScore || 0), 0) / exSessions.length)
          : 0
      };
    });

    // Streak calculation
    let streak = 0;
    for (let i = 0; i < daysSinceStart; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (sessionDays.has(key)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    const overall = Math.min(100, Math.round((sessionDays.size / Math.max(1, expectedSessions)) * 100));

    return {
      overall,
      byExercise,
      streak,
      missedDays: Math.max(0, expectedSessions - sessionDays.size),
      totalExpected: expectedSessions,
      totalCompleted: sessionDays.size
    };
  }
}

// PAIN TRACKING

class PainTracker {
  constructor() {
    this.entries = []; // [{timestamp, level, location, context, notes}]
  }

  /**
   * Record a pain level
   * @param {number} level - 0-10 pain scale
   * @param {string} location - body area
   * @param {string} context - 'pre-workout', 'post-workout', 'daily'
   * @param {string} notes - optional free-text
   */
  record(level, location = '', context = 'daily', notes = '') {
    this.entries.push({
      timestamp: Date.now(),
      date: new Date().toISOString(),
      level: Math.min(10, Math.max(0, level)),
      location,
      context,
      notes
    });
  }

  /**
   * Get pain trend over time
   * @param {number} days - lookback period
   * @returns {Object} { trend, average, min, max, entries }
   */
  getTrend(days = 30) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recent = this.entries.filter(e => e.timestamp >= cutoff);

    if (recent.length === 0) return { trend: 'none', average: 0, min: 0, max: 0, entries: [] };

    const levels = recent.map(e => e.level);
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;

    // Calculate trend (first half vs second half)
    const mid = Math.floor(recent.length / 2);
    let trend = 'stable';
    if (recent.length >= 4) {
      const firstHalf = recent.slice(0, mid).reduce((s, e) => s + e.level, 0) / mid;
      const secondHalf = recent.slice(mid).reduce((s, e) => s + e.level, 0) / (recent.length - mid);
      if (secondHalf < firstHalf - 1) trend = 'improving';
      else if (secondHalf > firstHalf + 1) trend = 'worsening';
    }

    return {
      trend,
      average: Math.round(avg * 10) / 10,
      min: Math.min(...levels),
      max: Math.max(...levels),
      entries: recent
    };
  }

  /**
   * Get pre vs post workout pain comparison
   */
  getWorkoutPainDelta() {
    const preEntries = this.entries.filter(e => e.context === 'pre-workout');
    const postEntries = this.entries.filter(e => e.context === 'post-workout');

    if (preEntries.length === 0 || postEntries.length === 0) return null;

    const avgPre = preEntries.reduce((s, e) => s + e.level, 0) / preEntries.length;
    const avgPost = postEntries.reduce((s, e) => s + e.level, 0) / postEntries.length;

    return {
      avgPre: Math.round(avgPre * 10) / 10,
      avgPost: Math.round(avgPost * 10) / 10,
      delta: Math.round((avgPost - avgPre) * 10) / 10,
      interpretation: avgPost < avgPre ? 'Exercise reduces your pain' :
                      avgPost > avgPre + 1 ? 'Exercise may be aggravating — discuss with therapist' :
                      'Pain stays about the same with exercise'
    };
  }

  toJSON() {
    return { entries: this.entries };
  }

  static fromJSON(data) {
    const pt = new PainTracker();
    pt.entries = data.entries || [];
    return pt;
  }
}

// COMPLIANCE REPORT GENERATOR

class ComplianceReport {
  /**
   * Generate a shareable compliance report
   * @param {PTProgram} program
   * @param {Array} workoutHistory
   * @param {PainTracker} painTracker
   * @returns {Object} full report data
   */
  static generate(program, workoutHistory, painTracker) {
    const compliance = program.getCompliance(workoutHistory);
    const painTrend = painTracker.getTrend(30);
    const painDelta = painTracker.getWorkoutPainDelta();

    // ROM progression per exercise
    const romProgression = {};
    const prescribedTypes = new Set(program.exercises.map(e => e.exerciseType));
    const relevantWorkouts = workoutHistory.filter(w => prescribedTypes.has(w.exerciseType));

    prescribedTypes.forEach(type => {
      const exWorkouts = relevantWorkouts
        .filter(w => w.exerciseType === type && w.rom)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (exWorkouts.length >= 2) {
        const first = exWorkouts[0].rom;
        const last = exWorkouts[exWorkouts.length - 1].rom;
        romProgression[type] = {
          firstSession: first,
          lastSession: last,
          rangeImprovement: (last.range || 0) - (first.range || 0),
          sessions: exWorkouts.length
        };
      }
    });

    // Build report
    const report = {
      generatedAt: new Date().toISOString(),
      program: {
        therapist: program.therapistName,
        patient: program.patientName,
        diagnosis: program.diagnosis,
        startDate: program.startDate,
        prescribedExercises: program.exercises.map(e => e.exerciseType)
      },
      compliance: {
        overall: compliance.overall,
        streak: compliance.streak,
        totalCompleted: compliance.totalCompleted,
        totalExpected: compliance.totalExpected,
        missedDays: compliance.missedDays,
        byExercise: compliance.byExercise
      },
      pain: {
        trend: painTrend.trend,
        currentAverage: painTrend.average,
        min: painTrend.min,
        max: painTrend.max,
        workoutEffect: painDelta,
        recentEntries: painTrend.entries.slice(-10)
      },
      romProgression,
      formScores: {
        average: relevantWorkouts.length > 0
          ? Math.round(relevantWorkouts.reduce((s, w) => s + (w.formScore || 0), 0) / relevantWorkouts.length)
          : 0,
        trend: relevantWorkouts.length >= 4
          ? (() => {
              const mid = Math.floor(relevantWorkouts.length / 2);
              const first = relevantWorkouts.slice(0, mid).reduce((s, w) => s + (w.formScore || 0), 0) / mid;
              const second = relevantWorkouts.slice(mid).reduce((s, w) => s + (w.formScore || 0), 0) / (relevantWorkouts.length - mid);
              return second > first + 5 ? 'improving' : second < first - 5 ? 'declining' : 'stable';
            })()
          : 'insufficient data'
      },
      summary: ''
    };

    // Generate human-readable summary
    report.summary = ComplianceReport._generateSummary(report);

    return report;
  }

  static _generateSummary(report) {
    const lines = [];

    // Compliance
    if (report.compliance.overall >= 80) {
      lines.push(`Excellent adherence (${report.compliance.overall}%). Patient is consistently completing prescribed exercises.`);
    } else if (report.compliance.overall >= 50) {
      lines.push(`Moderate adherence (${report.compliance.overall}%). Patient is completing some but not all prescribed sessions. ${report.compliance.missedDays} sessions missed.`);
    } else {
      lines.push(`Low adherence (${report.compliance.overall}%). Patient has missed ${report.compliance.missedDays} of ${report.compliance.totalExpected} expected sessions. Intervention recommended.`);
    }

    // Pain
    if (report.pain.trend === 'improving') {
      lines.push(`Pain trending downward (avg ${report.pain.currentAverage}/10). Positive response to exercise program.`);
    } else if (report.pain.trend === 'worsening') {
      lines.push(`Pain trending upward (avg ${report.pain.currentAverage}/10). Program modification may be needed.`);
    } else if (report.pain.currentAverage > 0) {
      lines.push(`Pain stable at ${report.pain.currentAverage}/10.`);
    }

    // ROM
    const romKeys = Object.keys(report.romProgression);
    romKeys.forEach(key => {
      const rom = report.romProgression[key];
      if (rom.rangeImprovement > 5) {
        lines.push(`${key}: ROM improved by ${rom.rangeImprovement}° over ${rom.sessions} sessions.`);
      } else if (rom.rangeImprovement < -5) {
        lines.push(`${key}: ROM decreased by ${Math.abs(rom.rangeImprovement)}°. May need assessment.`);
      }
    });

    // Form
    if (report.formScores.trend === 'improving') {
      lines.push(`Exercise form is improving over time.`);
    } else if (report.formScores.trend === 'declining') {
      lines.push(`Exercise form quality declining. Patient may be fatiguing or compensating.`);
    }

    return lines.join(' ');
  }

  /**
   * Generate HTML version of report for sharing/printing
   */
  static toHTML(report) {
    const compColor = report.compliance.overall >= 80 ? '#00e676' :
                      report.compliance.overall >= 50 ? '#ffab40' : '#ff5252';

    const painColor = report.pain.trend === 'improving' ? '#00e676' :
                      report.pain.trend === 'worsening' ? '#ff5252' : '#aaa';

    let exerciseRows = '';
    Object.entries(report.compliance.byExercise).forEach(([_key, ex]) => {
      exerciseRows += `<tr>
        <td>${ex.name}</td>
        <td>${ex.completed}/${ex.expected}</td>
        <td>${ex.percentage}%</td>
        <td>${ex.avgFormScore}%</td>
      </tr>`;
    });

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>PhysioRep Compliance Report</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { color: #00c853; font-size: 24px; }
  h2 { font-size: 18px; margin-top: 24px; border-bottom: 2px solid #eee; padding-bottom: 8px; }
  .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
  .score-big { font-size: 48px; font-weight: 900; color: ${compColor}; }
  .pain-trend { font-size: 16px; font-weight: 600; color: ${painColor}; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; }
  th { font-size: 12px; text-transform: uppercase; color: #999; }
  .summary { background: #f8f8f8; padding: 16px; border-radius: 8px; margin-top: 20px; line-height: 1.6; }
  .footer { margin-top: 32px; font-size: 12px; color: #999; text-align: center; }
</style></head><body>
  <h1>PhysioRep Compliance Report</h1>
  <div class="meta">
    Patient: ${report.program.patient || 'Not specified'}<br>
    Therapist: ${report.program.therapist || 'Not specified'}<br>
    Diagnosis: ${report.program.diagnosis || 'Not specified'}<br>
    Program start: ${new Date(report.program.startDate).toLocaleDateString()}<br>
    Report generated: ${new Date(report.generatedAt).toLocaleDateString()}
  </div>

  <h2>Compliance</h2>
  <div class="score-big">${report.compliance.overall}%</div>
  <p>${report.compliance.totalCompleted} of ${report.compliance.totalExpected} sessions completed · ${report.compliance.streak}-day streak</p>

  <table>
    <tr><th>Exercise</th><th>Completed</th><th>Adherence</th><th>Avg Form</th></tr>
    ${exerciseRows}
  </table>

  <h2>Pain Tracking</h2>
  <p class="pain-trend">Trend: ${report.pain.trend} · Average: ${report.pain.currentAverage}/10</p>
  ${report.pain.workoutEffect ? `<p>${report.pain.workoutEffect.interpretation} (pre: ${report.pain.workoutEffect.avgPre}/10, post: ${report.pain.workoutEffect.avgPost}/10)</p>` : ''}

  <h2>Clinical Summary</h2>
  <div class="summary">${report.summary}</div>

  <div class="footer">PhysioRep · Exercise Compliance Report</div>
</body></html>`;
  }
}

// EXERCISE MODIFICATION ENGINE

const EXERCISE_MODIFICATIONS = {
  squat: {
    easier: [
      { name: 'Wall Squat', desc: 'Lean against wall, slide down to 90°. Reduces balance demand.' },
      { name: 'Chair Squat', desc: 'Squat to a chair, touch and stand. Limits depth safely.' },
      { name: 'Goblet Squat', desc: 'Hold weight at chest for counterbalance. Helps stay upright.' }
    ],
    harder: [
      { name: 'Pause Squat', desc: 'Hold at bottom for 3 seconds. Builds strength at weakest point.' },
      { name: 'Jump Squat', desc: 'Explode up from bottom. Adds plyometric power.' }
    ],
    painAlternatives: [
      { name: 'Leg Press (machine)', desc: 'Same muscles, less knee stress. Good for knee pain.' },
      { name: 'Hip Hinge', desc: 'Reduces knee load. Better for patellofemoral issues.' }
    ]
  },
  pushup: {
    easier: [
      { name: 'Wall Push-Up', desc: 'Stand facing wall. Minimal load on shoulders.' },
      { name: 'Incline Push-Up', desc: 'Hands on elevated surface (counter, bench). Reduces load progressively.' },
      { name: 'Knee Push-Up', desc: 'Knees on floor. Reduces load by ~40%.' }
    ],
    harder: [
      { name: 'Diamond Push-Up', desc: 'Hands close together. More triceps activation.' },
      { name: 'Decline Push-Up', desc: 'Feet elevated. Increases shoulder and chest load.' }
    ],
    painAlternatives: [
      { name: 'Chest Press (bands)', desc: 'Same motion, adjustable resistance. Good for shoulder issues.' }
    ]
  },
  plank: {
    easier: [
      { name: 'Knee Plank', desc: 'Knees on floor. Same core activation, less intensity.' },
      { name: 'Incline Plank', desc: 'Hands on elevated surface. Gradually increase difficulty.' }
    ],
    harder: [
      { name: 'Side Plank', desc: 'Target obliques. Alternate sides.' },
      { name: 'Plank with Reach', desc: 'Extend one arm forward. Anti-rotation challenge.' }
    ],
    painAlternatives: [
      { name: 'Dead Bug', desc: 'Supine core exercise. Zero wrist/shoulder load.' },
      { name: 'Bird Dog', desc: 'Quadruped position. Spine-friendly core work.' }
    ]
  },
  lunge: {
    easier: [
      { name: 'Split Squat', desc: 'Stationary lunge — no stepping. More stable.' },
      { name: 'Supported Lunge', desc: 'Hold wall or chair for balance support.' }
    ],
    harder: [
      { name: 'Walking Lunge', desc: 'Continuous forward movement. Adds coordination.' },
      { name: 'Bulgarian Split Squat', desc: 'Rear foot elevated. Maximum single-leg load.' }
    ],
    painAlternatives: [
      { name: 'Step-Up', desc: 'Lower step height for less knee flexion. Adjustable difficulty.' }
    ]
  },
  shoulderpress: {
    easier: [
      { name: 'Seated Press', desc: 'Sit against backrest. Removes core stability demand.' },
      { name: 'Lateral Raise', desc: 'Lighter load, no overhead. Good for impingement issues.' }
    ],
    harder: [
      { name: 'Push Press', desc: 'Use legs to drive weight overhead. Heavier loads possible.' },
      { name: 'Single-Arm Press', desc: 'One arm at a time. Fixes asymmetry.' }
    ],
    painAlternatives: [
      { name: 'Landmine Press', desc: 'Angled pressing. Shoulder-friendly path of motion.' }
    ]
  },
  deadlift: {
    easier: [
      { name: 'Romanian Deadlift', desc: 'Slight knee bend, focus on hip hinge. Less lower back stress.' },
      { name: 'Kettlebell Deadlift', desc: 'Weight between feet. Easier to maintain back position.' }
    ],
    harder: [
      { name: 'Single-Leg Deadlift', desc: 'Unilateral. Tests balance and fixes imbalances.' },
      { name: 'Sumo Deadlift', desc: 'Wide stance. More quad and inner thigh activation.' }
    ],
    painAlternatives: [
      { name: 'Hip Thrust', desc: 'Similar posterior chain work. Zero spinal compression.' }
    ]
  }
};

/**
 * Get exercise modifications based on context
 * @param {string} exerciseType
 * @param {string} reason - 'too-hard', 'too-easy', 'pain'
 * @returns {Array} modification suggestions
 */
function getModifications(exerciseType, reason) {
  const mods = EXERCISE_MODIFICATIONS[exerciseType];
  if (!mods) return [];

  switch (reason) {
    case 'too-hard': return mods.easier || [];
    case 'too-easy': return mods.harder || [];
    case 'pain': return mods.painAlternatives || [];
    default: return [...(mods.easier || []), ...(mods.harder || [])];
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PTProgram, PainTracker, ComplianceReport, getModifications, EXERCISE_MODIFICATIONS };
}
