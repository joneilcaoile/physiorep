/**
 * PhysioRep Exercise Engine — Unit Tests
 * Tests angle calculation, landmark utilities, and rep counting state machine.
 */

const {
  calculateAngle,
  getLandmark,
  landmarksVisible,
  ExerciseTracker,
  EXERCISES,
  LANDMARKS
} = require('../src/exercise-engine.js');

// ===== ANGLE CALCULATION =====

describe('calculateAngle', () => {
  test('returns 90 degrees for a right angle', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 1 }; // vertex
    const c = { x: 1, y: 1 };
    const angle = calculateAngle(a, b, c);
    expect(angle).toBeCloseTo(90, 0);
  });

  test('returns 180 degrees for a straight line', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 0 };
    const c = { x: 2, y: 0 };
    const angle = calculateAngle(a, b, c);
    expect(angle).toBeCloseTo(180, 0);
  });

  test('returns 0 degrees for overlapping arms', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 0 };
    const c = { x: 0, y: 0 };
    const angle = calculateAngle(a, b, c);
    expect(angle).toBeCloseTo(0, 0);
  });

  test('returns 45 degrees correctly', () => {
    const a = { x: 1, y: 0 };
    const b = { x: 0, y: 0 };
    const c = { x: 1, y: 1 };
    const angle = calculateAngle(a, b, c);
    expect(angle).toBeCloseTo(45, 0);
  });

  test('handles negative coordinates', () => {
    const a = { x: -1, y: 0 };
    const b = { x: 0, y: 0 };
    const c = { x: 0, y: 1 };
    const angle = calculateAngle(a, b, c);
    expect(angle).toBeCloseTo(90, 0);
  });

  test('returns angle between 0 and 180', () => {
    // Random points - should always be in valid range
    for (let i = 0; i < 20; i++) {
      const a = { x: Math.random() * 10 - 5, y: Math.random() * 10 - 5 };
      const b = { x: Math.random() * 10 - 5, y: Math.random() * 10 - 5 };
      const c = { x: Math.random() * 10 - 5, y: Math.random() * 10 - 5 };
      const angle = calculateAngle(a, b, c);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThanOrEqual(180);
    }
  });
});

// ===== LANDMARK UTILITIES =====

describe('getLandmark', () => {
  const mockLandmarks = Array(33).fill(null).map((_, i) => ({
    x: i * 0.03, y: i * 0.03, visibility: 0.9
  }));

  test('returns correct landmark by name', () => {
    const lm = getLandmark(mockLandmarks, 'LEFT_SHOULDER');
    expect(lm).toBeDefined();
    expect(lm.x).toBe(mockLandmarks[11].x);
    expect(lm.y).toBe(mockLandmarks[11].y);
  });

  test('returns null for invalid name', () => {
    const lm = getLandmark(mockLandmarks, 'INVALID_NAME');
    expect(lm).toBeNull();
  });

  test('includes visibility in result', () => {
    const lm = getLandmark(mockLandmarks, 'RIGHT_HIP');
    expect(lm.visibility).toBe(0.9);
  });
});

describe('landmarksVisible', () => {
  const visibleLandmarks = Array(33).fill(null).map(() => ({
    x: 0.5, y: 0.5, visibility: 0.8
  }));

  const partialLandmarks = Array(33).fill(null).map((_, i) => ({
    x: 0.5, y: 0.5, visibility: i < 15 ? 0.8 : 0.2 // first half visible, rest not
  }));

  test('returns true when all landmarks visible', () => {
    expect(landmarksVisible(visibleLandmarks, ['LEFT_SHOULDER', 'LEFT_HIP', 'LEFT_KNEE'])).toBe(true);
  });

  test('returns false when some landmarks not visible', () => {
    expect(landmarksVisible(partialLandmarks, ['LEFT_SHOULDER', 'LEFT_HIP', 'LEFT_KNEE'])).toBe(false);
  });

  test('respects custom threshold', () => {
    expect(landmarksVisible(partialLandmarks, ['LEFT_SHOULDER'], 0.7)).toBe(true);
    expect(landmarksVisible(partialLandmarks, ['LEFT_SHOULDER'], 0.9)).toBe(false);
  });
});

// ===== EXERCISE TRACKER — SQUAT =====

describe('ExerciseTracker - Squat', () => {
  let tracker;

  beforeEach(() => {
    tracker = new ExerciseTracker('squat');
  });

  test('initializes with correct defaults', () => {
    expect(tracker.type).toBe('squat');
    expect(tracker.reps).toBe(0);
    expect(tracker.phase).toBe('standing');
    expect(tracker.getFormScore()).toBe(100);
  });

  test('returns warning when landmarks not visible', () => {
    const badLandmarks = Array(33).fill(null).map(() => ({
      x: 0.5, y: 0.5, visibility: 0.1
    }));
    const result = tracker.processFrame(badLandmarks);
    expect(result.feedback.type).toBe('warn');
    expect(result.feedback.message).toContain('body in frame');
  });

  test('returns warning for null landmarks', () => {
    const result = tracker.processFrame(null);
    expect(result.feedback.type).toBe('warn');
  });

  function createSquatLandmarks(kneeAngle, options = {}) {
    // Create realistic squat landmarks with specified knee angle
    const landmarks = Array(33).fill(null).map(() => ({
      x: 0.5, y: 0.5, visibility: 0.9
    }));

    // Position key joints to produce desired knee angle
    // Shoulder
    landmarks[11] = { x: 0.45, y: 0.2, visibility: 0.9 }; // left shoulder
    landmarks[12] = { x: 0.55, y: 0.2, visibility: 0.9 }; // right shoulder

    // Hips
    landmarks[23] = { x: 0.45, y: 0.5, visibility: 0.9 }; // left hip
    landmarks[24] = { x: 0.55, y: 0.5, visibility: 0.9 }; // right hip

    // Knees — adjust y position based on desired angle
    // For standing (170°): knee roughly between hip and ankle
    // For deep squat (90°): knee forward and lower
    const kneeRad = (kneeAngle * Math.PI) / 180;
    const kneeX = 0.45 + (options.kneeCave ? 0.08 : 0);
    landmarks[25] = { x: kneeX, y: 0.7, visibility: 0.9 }; // left knee
    landmarks[26] = { x: 0.55 - (options.kneeCave ? 0.08 : 0), y: 0.7, visibility: 0.9 }; // right knee

    // Ankles — position to create desired angle at knee
    const ankleOffset = Math.sin(kneeRad) * 0.2;
    landmarks[27] = { x: 0.45, y: 0.9, visibility: 0.9 }; // left ankle
    landmarks[28] = { x: 0.55, y: 0.9, visibility: 0.9 }; // right ankle

    return landmarks;
  }

  test('detects standing phase correctly', () => {
    const standingLandmarks = createSquatLandmarks(170);
    const result = tracker.processFrame(standingLandmarks);
    expect(tracker.phase).toBe('standing');
    expect(result.reps).toBe(0);
  });

  test('summary includes exercise info', () => {
    const summary = tracker.getSummary();
    expect(summary.exercise).toBe('Squats');
    expect(summary.exerciseType).toBe('squat');
    expect(summary.reps).toBe(0);
    expect(summary.formScore).toBe(100);
    expect(summary.formIssues).toEqual({});
  });

  test('form score starts at 100 and can decrease', () => {
    expect(tracker.getFormScore()).toBe(100);
    tracker.totalFormChecks = 10;
    tracker.goodFormChecks = 7;
    expect(tracker.getFormScore()).toBe(70);
  });
});

// ===== EXERCISE TRACKER — PUSHUP =====

describe('ExerciseTracker - Pushup', () => {
  let tracker;

  beforeEach(() => {
    tracker = new ExerciseTracker('pushup');
  });

  test('initializes correctly', () => {
    expect(tracker.type).toBe('pushup');
    expect(tracker.phase).toBe('up');
    expect(tracker.reps).toBe(0);
  });

  test('has correct config', () => {
    expect(tracker.config.name).toBe('Push-Ups');
    expect(tracker.config.thresholds.upElbowAngle).toBeDefined();
    expect(tracker.config.thresholds.bottomElbowAngle).toBeDefined();
  });
});

// ===== EXERCISE TRACKER — PLANK =====

describe('ExerciseTracker - Plank', () => {
  let tracker;

  beforeEach(() => {
    tracker = new ExerciseTracker('plank');
  });

  test('initializes correctly', () => {
    expect(tracker.type).toBe('plank');
    expect(tracker.phase).toBe('holding');
    expect(tracker.plankStartTime).toBeNull();
  });

  test('plank reps represent seconds held', () => {
    // Simulate plank detection with good form
    const landmarks = Array(33).fill(null).map(() => ({
      x: 0.5, y: 0.5, visibility: 0.9
    }));
    // Shoulders, hips, ankles in a straight line
    landmarks[11] = { x: 0.3, y: 0.4, visibility: 0.9 };
    landmarks[12] = { x: 0.3, y: 0.6, visibility: 0.9 };
    landmarks[23] = { x: 0.5, y: 0.4, visibility: 0.9 };
    landmarks[24] = { x: 0.5, y: 0.6, visibility: 0.9 };
    landmarks[27] = { x: 0.7, y: 0.4, visibility: 0.9 };
    landmarks[28] = { x: 0.7, y: 0.6, visibility: 0.9 };

    tracker.processFrame(landmarks);
    expect(tracker.plankStartTime).not.toBeNull();
  });

  test('summary includes plank hold time', () => {
    tracker.plankHoldTime = 45;
    const summary = tracker.getSummary();
    expect(summary.plankHoldTime).toBe(45);
  });
});

// ===== NEW EXERCISES =====

describe('ExerciseTracker - Lunge', () => {
  let tracker;
  beforeEach(() => { tracker = new ExerciseTracker('lunge'); });

  test('initializes correctly', () => {
    expect(tracker.type).toBe('lunge');
    expect(tracker.phase).toBe('standing');
  });

  test('has ROM tracking initialized', () => {
    expect(tracker.romHistory).toEqual([]);
    expect(tracker.peakROM).toBe(0);
    expect(tracker.minROM).toBe(180);
  });

  test('summary includes ROM data', () => {
    tracker._trackROM(150);
    tracker._trackROM(90);
    tracker._trackROM(120);
    const rom = tracker.getROMSummary();
    expect(rom).not.toBeNull();
    expect(rom.peak).toBe(150);
    expect(rom.min).toBe(90);
    expect(rom.range).toBe(60);
    expect(rom.samples).toBe(3);
  });
});

describe('ExerciseTracker - Shoulder Press', () => {
  let tracker;
  beforeEach(() => { tracker = new ExerciseTracker('shoulderpress'); });

  test('initializes correctly', () => {
    expect(tracker.type).toBe('shoulderpress');
    expect(tracker.phase).toBe('down');
  });

  test('config has asymmetry limit', () => {
    expect(tracker.config.thresholds.asymmetryLimit).toBeDefined();
  });
});

describe('ExerciseTracker - Deadlift', () => {
  let tracker;
  beforeEach(() => { tracker = new ExerciseTracker('deadlift'); });

  test('initializes correctly', () => {
    expect(tracker.type).toBe('deadlift');
    expect(tracker.phase).toBe('bottom');
  });

  test('config has round back threshold', () => {
    expect(tracker.config.thresholds.roundBackThreshold).toBeDefined();
  });
});

// ===== ROM TRACKING =====

describe('ROM Tracking', () => {
  let tracker;
  beforeEach(() => { tracker = new ExerciseTracker('squat'); });

  test('tracks ROM correctly', () => {
    tracker._trackROM(170);
    tracker._trackROM(90);
    tracker._trackROM(130);
    expect(tracker.peakROM).toBe(170);
    expect(tracker.minROM).toBe(90);
    expect(tracker.romHistory.length).toBe(3);
  });

  test('getROMSummary returns null with no data', () => {
    expect(tracker.getROMSummary()).toBeNull();
  });

  test('getROMSummary computes correctly', () => {
    tracker._trackROM(160);
    tracker._trackROM(80);
    const rom = tracker.getROMSummary();
    expect(rom.peak).toBe(160);
    expect(rom.min).toBe(80);
    expect(rom.range).toBe(80);
    expect(rom.avg).toBe(120);
  });
});

// ===== MILESTONE DETECTION =====

describe('Milestone Detection', () => {
  let tracker;
  beforeEach(() => { tracker = new ExerciseTracker('squat'); });

  test('no milestone at 0 reps', () => {
    expect(tracker._checkMilestones()).toBeNull();
  });

  test('triggers milestone at 5 reps', () => {
    tracker.reps = 5;
    tracker._prevReps = 4;
    const m = tracker._checkMilestones();
    expect(m).not.toBeNull();
    expect(m.type).toBe('count');
    expect(m.message).toContain('5');
  });

  test('triggers milestone at 10 reps', () => {
    tracker.reps = 10;
    tracker._prevReps = 9;
    tracker._lastMilestoneRep = 5;
    const m = tracker._checkMilestones();
    expect(m).not.toBeNull();
    expect(m.message).toContain('10');
  });

  test('does not re-trigger same milestone', () => {
    tracker.reps = 5;
    tracker._prevReps = 4;
    tracker._checkMilestones(); // triggers
    tracker._prevReps = tracker.reps; // simulate no new rep
    expect(tracker._checkMilestones()).toBeNull();
  });

  test('perfect form milestone at 5 reps', () => {
    tracker.reps = 5;
    tracker._prevReps = 4;
    tracker.goodFormChecks = 5;
    tracker.totalFormChecks = 5;
    const m = tracker._checkMilestones();
    expect(m.type).toBe('form');
    expect(m.message).toContain('Perfect');
  });

  test('plank returns null for milestones', () => {
    const plankTracker = new ExerciseTracker('plank');
    plankTracker.reps = 10;
    expect(plankTracker._checkMilestones()).toBeNull();
  });

  test('milestones stored in array', () => {
    tracker.reps = 5;
    tracker._prevReps = 4;
    tracker._checkMilestones();
    expect(tracker.milestones.length).toBe(1);
  });
});

// ===== SUMMARY V2 =====

describe('Summary includes new fields', () => {
  test('summary includes rom and milestones', () => {
    const tracker = new ExerciseTracker('lunge');
    tracker._trackROM(150);
    tracker._trackROM(80);
    const summary = tracker.getSummary();
    expect(summary.rom).not.toBeNull();
    expect(summary.rom.range).toBe(70);
    expect(summary.milestones).toEqual([]);
  });
});

// ===== EXERCISE DEFINITIONS =====

describe('Exercise Definitions', () => {
  test('all six exercises defined', () => {
    expect(EXERCISES.squat).toBeDefined();
    expect(EXERCISES.pushup).toBeDefined();
    expect(EXERCISES.plank).toBeDefined();
    expect(EXERCISES.lunge).toBeDefined();
    expect(EXERCISES.shoulderpress).toBeDefined();
    expect(EXERCISES.deadlift).toBeDefined();
  });

  test('each exercise has required fields', () => {
    Object.values(EXERCISES).forEach(ex => {
      expect(ex.name).toBeDefined();
      expect(ex.requiredLandmarks).toBeDefined();
      expect(Array.isArray(ex.requiredLandmarks)).toBe(true);
      expect(ex.phases).toBeDefined();
      expect(ex.thresholds).toBeDefined();
    });
  });

  test('landmarks map has all expected joints', () => {
    expect(LANDMARKS.LEFT_SHOULDER).toBe(11);
    expect(LANDMARKS.RIGHT_SHOULDER).toBe(12);
    expect(LANDMARKS.LEFT_HIP).toBe(23);
    expect(LANDMARKS.RIGHT_HIP).toBe(24);
    expect(LANDMARKS.LEFT_KNEE).toBe(25);
    expect(LANDMARKS.LEFT_ANKLE).toBe(27);
  });
});
