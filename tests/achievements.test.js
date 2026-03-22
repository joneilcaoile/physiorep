const { AchievementEngine, BADGES, computeAchievementStats } = require('../src/achievements');

describe('BADGES', () => {
  test('has 12 badges defined', () => {
    expect(BADGES).toHaveLength(12);
  });

  test('each badge has required fields', () => {
    BADGES.forEach(b => {
      expect(b.id).toBeTruthy();
      expect(b.name).toBeTruthy();
      expect(b.icon).toBeTruthy();
      expect(b.desc).toBeTruthy();
      expect(typeof b.check).toBe('function');
    });
  });
});

describe('computeAchievementStats', () => {
  test('returns zeros for empty workouts', () => {
    const stats = computeAchievementStats([]);
    expect(stats.totalWorkouts).toBe(0);
    expect(stats.streak).toBe(0);
    expect(stats.bestFormScore).toBe(0);
  });

  test('computes stats from workouts', () => {
    const now = new Date();
    const workouts = [
      { date: now.toISOString(), exerciseType: 'squat', formScore: 85, reps: 20 },
      { date: now.toISOString(), exerciseType: 'pushup', formScore: 90, reps: 30 },
      { date: now.toISOString(), exerciseType: 'plank', formScore: 75, reps: 45, plankHoldTime: 45 },
    ];
    const stats = computeAchievementStats(workouts);
    expect(stats.totalWorkouts).toBe(3);
    expect(stats.bestFormScore).toBe(90);
    expect(stats.bestSessionReps).toBe(45);
    expect(stats.uniqueExercises).toBe(3);
    expect(stats.bestPlankTime).toBe(45);
  });

  test('detects early workout', () => {
    const early = new Date();
    early.setHours(5, 0, 0);
    const stats = computeAchievementStats([
      { date: early.toISOString(), exerciseType: 'squat', formScore: 80, reps: 10 }
    ]);
    expect(stats.hasEarlyWorkout).toBe(true);
  });

  test('detects comeback after 7 day gap', () => {
    const d1 = new Date();
    d1.setDate(d1.getDate() - 20);
    const d2 = new Date();
    d2.setDate(d2.getDate() - 5);
    const stats = computeAchievementStats([
      { date: d1.toISOString(), exerciseType: 'squat', formScore: 80, reps: 10 },
      { date: d2.toISOString(), exerciseType: 'squat', formScore: 80, reps: 10 }
    ]);
    expect(stats.hasComeback).toBe(true);
  });
});

describe('AchievementEngine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('starts with no unlocked badges', () => {
    const engine = new AchievementEngine();
    expect(engine.getUnlocked()).toHaveLength(0);
    expect(engine.getProgress().unlocked).toBe(0);
    expect(engine.getProgress().total).toBe(12);
  });

  test('unlocks first_rep badge', () => {
    const engine = new AchievementEngine();
    const newBadges = engine.evaluate({ totalWorkouts: 1, streak: 0, bestFormScore: 70, avgFormScore: 70, bestSessionReps: 10, uniqueExercises: 1, bestPlankTime: 0, hasEarlyWorkout: false, hasLateWorkout: false, hasComeback: false });
    expect(newBadges).toHaveLength(1);
    expect(newBadges[0].id).toBe('first_rep');
  });

  test('does not re-unlock same badge', () => {
    const engine = new AchievementEngine();
    engine.evaluate({ totalWorkouts: 1, streak: 0, bestFormScore: 70, avgFormScore: 70, bestSessionReps: 10, uniqueExercises: 1, bestPlankTime: 0, hasEarlyWorkout: false, hasLateWorkout: false, hasComeback: false });
    const second = engine.evaluate({ totalWorkouts: 2, streak: 0, bestFormScore: 70, avgFormScore: 70, bestSessionReps: 10, uniqueExercises: 1, bestPlankTime: 0, hasEarlyWorkout: false, hasLateWorkout: false, hasComeback: false });
    expect(second.find(b => b.id === 'first_rep')).toBeUndefined();
  });

  test('unlocks multiple badges at once', () => {
    const engine = new AchievementEngine();
    const newBadges = engine.evaluate({
      totalWorkouts: 1, streak: 3, bestFormScore: 100, avgFormScore: 100,
      bestSessionReps: 10, uniqueExercises: 1, bestPlankTime: 0,
      hasEarlyWorkout: false, hasLateWorkout: false, hasComeback: false
    });
    const ids = newBadges.map(b => b.id);
    expect(ids).toContain('first_rep');
    expect(ids).toContain('streak_3');
    expect(ids).toContain('perfect_form');
    expect(newBadges.length).toBe(3);
  });

  test('getAll returns all badges with unlocked status', () => {
    const engine = new AchievementEngine();
    engine.evaluate({ totalWorkouts: 1, streak: 0, bestFormScore: 70, avgFormScore: 70, bestSessionReps: 10, uniqueExercises: 1, bestPlankTime: 0, hasEarlyWorkout: false, hasLateWorkout: false, hasComeback: false });
    const all = engine.getAll();
    expect(all).toHaveLength(12);
    const firstRep = all.find(b => b.id === 'first_rep');
    expect(firstRep.unlocked).toBe(true);
    const streak7 = all.find(b => b.id === 'streak_7');
    expect(streak7.unlocked).toBe(false);
  });

  test('persists to localStorage', () => {
    const engine = new AchievementEngine();
    engine.evaluate({ totalWorkouts: 1, streak: 0, bestFormScore: 70, avgFormScore: 70, bestSessionReps: 10, uniqueExercises: 1, bestPlankTime: 0, hasEarlyWorkout: false, hasLateWorkout: false, hasComeback: false });

    // Create new engine — should load from localStorage
    const engine2 = new AchievementEngine();
    expect(engine2.getUnlocked()).toHaveLength(1);
    expect(engine2.getUnlocked()[0].id).toBe('first_rep');
  });
});
