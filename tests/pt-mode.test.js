/**
 * PhysioRep PT Mode Tests
 * Tests for PTProgram, PainTracker, ComplianceReport, and exercise modifications.
 */

const { PTProgram, PainTracker, ComplianceReport, getModifications, EXERCISE_MODIFICATIONS } = require('../src/pt-mode');

// ===== PTProgram =====

describe('PTProgram', () => {
  test('creates with defaults when no data provided', () => {
    const program = new PTProgram();
    expect(program.id).toBeTruthy();
    expect(program.therapistName).toBe('');
    expect(program.exercises).toEqual([]);
    expect(program.schedule.daysPerWeek).toBe(3);
    expect(program.active).toBe(true);
  });

  test('creates from provided data', () => {
    const program = new PTProgram({
      therapistName: 'Dr. Smith',
      patientName: 'Joneil',
      diagnosis: 'ACL rehab',
      exercises: [{ exerciseType: 'squat' }, { exerciseType: 'lunge' }],
      schedule: { daysPerWeek: 5, reminderTime: '08:00' }
    });
    expect(program.therapistName).toBe('Dr. Smith');
    expect(program.patientName).toBe('Joneil');
    expect(program.exercises).toHaveLength(2);
    expect(program.schedule.daysPerWeek).toBe(5);
  });

  test('getCompliance returns 100% when no sessions expected yet', () => {
    const program = new PTProgram({
      startDate: new Date().toISOString(),
      exercises: [{ exerciseType: 'squat' }],
      schedule: { daysPerWeek: 3 }
    });
    const result = program.getCompliance([]);
    expect(result.overall).toBe(100);
    expect(result.totalExpected).toBe(0);
  });

  test('getCompliance calculates correctly with sessions', () => {
    // Use fixed midnight dates to avoid day-boundary flakiness
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14);
    startDate.setHours(0, 0, 0, 0);

    const program = new PTProgram({
      startDate: startDate.toISOString(),
      exercises: [{ exerciseType: 'squat' }],
      schedule: { daysPerWeek: 7 } // daily
    });

    // Create 10 sessions across 10 different days at noon (avoids boundary)
    const sessions = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      d.setHours(12, 0, 0, 0);
      sessions.push({
        exerciseType: 'squat',
        date: d.toISOString(),
        formScore: 80
      });
    }

    const result = program.getCompliance(sessions);
    expect(result.overall).toBeGreaterThan(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.byExercise.squat).toBeDefined();
    expect(result.byExercise.squat.avgFormScore).toBe(80);
    expect(result.totalCompleted).toBe(10);
  });

  test('getCompliance ignores non-prescribed exercises', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const program = new PTProgram({
      startDate: startDate.toISOString(),
      exercises: [{ exerciseType: 'squat' }],
      schedule: { daysPerWeek: 7 }
    });

    const sessions = [
      { exerciseType: 'pushup', date: new Date().toISOString(), formScore: 90 },
      { exerciseType: 'deadlift', date: new Date().toISOString(), formScore: 85 }
    ];

    const result = program.getCompliance(sessions);
    expect(result.totalCompleted).toBe(0);
  });

  test('getCompliance streak counts consecutive days', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const program = new PTProgram({
      startDate: startDate.toISOString(),
      exercises: [{ exerciseType: 'squat' }],
      schedule: { daysPerWeek: 7 }
    });

    // Create sessions for last 3 days
    const sessions = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      sessions.push({ exerciseType: 'squat', date: d.toISOString(), formScore: 75 });
    }

    const result = program.getCompliance(sessions);
    expect(result.streak).toBe(3);
  });
});

// ===== PainTracker =====

describe('PainTracker', () => {
  test('starts with empty entries', () => {
    const pt = new PainTracker();
    expect(pt.entries).toEqual([]);
  });

  test('record adds an entry with clamped level', () => {
    const pt = new PainTracker();
    pt.record(5, 'knee', 'pre-workout', 'slight ache');
    expect(pt.entries).toHaveLength(1);
    expect(pt.entries[0].level).toBe(5);
    expect(pt.entries[0].location).toBe('knee');
    expect(pt.entries[0].context).toBe('pre-workout');
  });

  test('record clamps level to 0-10', () => {
    const pt = new PainTracker();
    pt.record(-3);
    pt.record(15);
    expect(pt.entries[0].level).toBe(0);
    expect(pt.entries[1].level).toBe(10);
  });

  test('getTrend returns none with no entries', () => {
    const pt = new PainTracker();
    const result = pt.getTrend();
    expect(result.trend).toBe('none');
    expect(result.average).toBe(0);
  });

  test('getTrend calculates average correctly', () => {
    const pt = new PainTracker();
    pt.record(4);
    pt.record(6);
    pt.record(8);
    const result = pt.getTrend();
    expect(result.average).toBe(6);
    expect(result.min).toBe(4);
    expect(result.max).toBe(8);
  });

  test('getTrend detects improving trend', () => {
    const pt = new PainTracker();
    // First half higher
    pt.entries.push({ timestamp: Date.now() - 20 * 86400000, level: 8, date: new Date().toISOString() });
    pt.entries.push({ timestamp: Date.now() - 15 * 86400000, level: 7, date: new Date().toISOString() });
    // Second half lower
    pt.entries.push({ timestamp: Date.now() - 5 * 86400000, level: 3, date: new Date().toISOString() });
    pt.entries.push({ timestamp: Date.now() - 1 * 86400000, level: 2, date: new Date().toISOString() });

    const result = pt.getTrend(30);
    expect(result.trend).toBe('improving');
  });

  test('getTrend detects worsening trend', () => {
    const pt = new PainTracker();
    pt.entries.push({ timestamp: Date.now() - 20 * 86400000, level: 2, date: new Date().toISOString() });
    pt.entries.push({ timestamp: Date.now() - 15 * 86400000, level: 3, date: new Date().toISOString() });
    pt.entries.push({ timestamp: Date.now() - 5 * 86400000, level: 7, date: new Date().toISOString() });
    pt.entries.push({ timestamp: Date.now() - 1 * 86400000, level: 8, date: new Date().toISOString() });

    const result = pt.getTrend(30);
    expect(result.trend).toBe('worsening');
  });

  test('getWorkoutPainDelta returns null with no data', () => {
    const pt = new PainTracker();
    expect(pt.getWorkoutPainDelta()).toBeNull();
  });

  test('getWorkoutPainDelta calculates correctly', () => {
    const pt = new PainTracker();
    pt.record(6, 'knee', 'pre-workout');
    pt.record(4, 'knee', 'pre-workout');
    pt.record(3, 'knee', 'post-workout');
    pt.record(2, 'knee', 'post-workout');

    const result = pt.getWorkoutPainDelta();
    expect(result).not.toBeNull();
    expect(result.avgPre).toBe(5);
    expect(result.avgPost).toBe(2.5);
    expect(result.delta).toBe(-2.5);
    expect(result.interpretation).toBe('Exercise reduces your pain');
  });

  test('serializes and deserializes correctly', () => {
    const pt = new PainTracker();
    pt.record(5, 'back', 'daily', 'test');
    pt.record(3, 'knee', 'post-workout');

    const json = pt.toJSON();
    const restored = PainTracker.fromJSON(json);

    expect(restored.entries).toHaveLength(2);
    expect(restored.entries[0].level).toBe(5);
    expect(restored.entries[1].level).toBe(3);
  });
});

// ===== ComplianceReport =====

describe('ComplianceReport', () => {
  test('generates a report with all required fields', () => {
    const program = new PTProgram({
      therapistName: 'Dr. Test',
      patientName: 'Patient X',
      diagnosis: 'Test diagnosis',
      exercises: [{ exerciseType: 'squat' }],
      schedule: { daysPerWeek: 3 }
    });

    const workouts = [];
    const painTracker = new PainTracker();

    const report = ComplianceReport.generate(program, workouts, painTracker);

    expect(report.generatedAt).toBeTruthy();
    expect(report.program.therapist).toBe('Dr. Test');
    expect(report.program.patient).toBe('Patient X');
    expect(report.compliance).toBeDefined();
    expect(report.compliance.overall).toBeDefined();
    expect(report.pain).toBeDefined();
    expect(report.romProgression).toBeDefined();
    expect(report.formScores).toBeDefined();
    expect(report.summary).toBeDefined();
  });

  test('generates report with workout and pain data', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14);

    const program = new PTProgram({
      startDate: startDate.toISOString(),
      exercises: [{ exerciseType: 'squat' }],
      schedule: { daysPerWeek: 7 }
    });

    const workouts = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      workouts.push({
        exerciseType: 'squat',
        date: d.toISOString(),
        formScore: 70 + i,
        rom: { peak: 120 + i, min: 40, range: 80 + i }
      });
    }

    const painTracker = new PainTracker();
    painTracker.record(6, 'knee', 'pre-workout');
    painTracker.record(4, 'knee', 'post-workout');

    const report = ComplianceReport.generate(program, workouts, painTracker);

    expect(report.compliance.totalCompleted).toBeGreaterThan(0);
    expect(report.formScores.average).toBeGreaterThan(0);
    expect(report.pain.currentAverage).toBeGreaterThan(0);
    expect(report.romProgression.squat).toBeDefined();
    expect(report.summary.length).toBeGreaterThan(0);
  });

  test('toHTML produces valid HTML string', () => {
    const program = new PTProgram({
      therapistName: 'Dr. HTML',
      patientName: 'Test Patient',
      exercises: [{ exerciseType: 'squat' }],
      schedule: { daysPerWeek: 3 }
    });

    const report = ComplianceReport.generate(program, [], new PainTracker());
    const html = ComplianceReport.toHTML(report);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('PhysioRep Compliance Report');
    expect(html).toContain('Dr. HTML');
    expect(html).toContain('Test Patient');
  });

  test('summary reflects high compliance', () => {
    const program = new PTProgram({
      startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      exercises: [{ exerciseType: 'squat' }],
      schedule: { daysPerWeek: 7 }
    });

    // Provide a session for every day
    const workouts = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      workouts.push({ exerciseType: 'squat', date: d.toISOString(), formScore: 90 });
    }

    const report = ComplianceReport.generate(program, workouts, new PainTracker());
    expect(report.summary).toContain('adherence');
  });
});

// ===== Exercise Modifications =====

describe('getModifications', () => {
  test('returns easier modifications for too-hard', () => {
    const mods = getModifications('squat', 'too-hard');
    expect(mods.length).toBeGreaterThan(0);
    expect(mods[0].name).toBeTruthy();
    expect(mods[0].desc).toBeTruthy();
  });

  test('returns harder modifications for too-easy', () => {
    const mods = getModifications('pushup', 'too-easy');
    expect(mods.length).toBeGreaterThan(0);
  });

  test('returns pain alternatives', () => {
    const mods = getModifications('plank', 'pain');
    expect(mods.length).toBeGreaterThan(0);
    expect(mods[0].name).toBeTruthy();
  });

  test('returns empty array for unknown exercise', () => {
    const mods = getModifications('burpee', 'too-hard');
    expect(mods).toEqual([]);
  });

  test('returns all mods for unknown reason', () => {
    const mods = getModifications('squat', 'unknown');
    expect(mods.length).toBeGreaterThan(0);
    // Should include both easier and harder
  });

  test('all 6 exercises have modifications', () => {
    const exercises = ['squat', 'pushup', 'plank', 'lunge', 'shoulderpress', 'deadlift'];
    exercises.forEach(ex => {
      expect(EXERCISE_MODIFICATIONS[ex]).toBeDefined();
      expect(EXERCISE_MODIFICATIONS[ex].easier.length).toBeGreaterThan(0);
      expect(EXERCISE_MODIFICATIONS[ex].harder.length).toBeGreaterThan(0);
      expect(EXERCISE_MODIFICATIONS[ex].painAlternatives.length).toBeGreaterThan(0);
    });
  });
});
