// Recovery & mobility — guided stretching with pose-verified holds

// STRETCH LIBRARY

const STRETCH_LIBRARY = {
  // LOWER BODY
  quad_stretch: {
    name: 'Standing Quad Stretch',
    bodyArea: 'Legs',
    holdSec: 30,
    sides: 2, // left and right
    description: 'Stand on one leg, pull opposite foot to glutes.',
    science: 'Stretches the rectus femoris and vastus muscles. Tight quads are linked to knee pain and reduced squat depth. Static stretching post-exercise reduces DOMS by ~20% (Journal of Sports Sciences, 2018).',
    cues: ['Stand tall — don\'t lean forward', 'Pull heel to your glutes', 'Keep knees close together'],
    // Pose detection: standing leg straight, other knee bent sharply
    detectFn: 'quad_stretch'
  },
  hamstring_stretch: {
    name: 'Standing Hamstring Stretch',
    bodyArea: 'Legs',
    holdSec: 30,
    sides: 2,
    description: 'Extend one leg forward on a low surface, hinge at hips.',
    science: 'Targets the biceps femoris, semimembranosus, and semitendinosus. Hamstring flexibility directly impacts deadlift ROM and reduces lower back strain. 4 weeks of daily 30s holds improves sit-and-reach by ~4cm (ACSM, 2014).',
    cues: ['Hinge at your hips, not your waist', 'Keep your back flat', 'You should feel this behind your thigh'],
    detectFn: 'hamstring_stretch'
  },
  hip_flexor_stretch: {
    name: 'Kneeling Hip Flexor Stretch',
    bodyArea: 'Hips',
    holdSec: 30,
    sides: 2,
    description: 'Half-kneeling position, push hips forward gently.',
    science: 'Targets the iliopsoas, which becomes shortened from prolonged sitting. Tight hip flexors inhibit glute activation during squats and deadlifts (Janda\'s lower crossed syndrome). Regular stretching improves hip extension by 10-15°.',
    cues: ['Back knee on the ground', 'Squeeze your back glute', 'Gentle push forward — don\'t overextend'],
    detectFn: 'hip_flexor'
  },
  calf_stretch: {
    name: 'Wall Calf Stretch',
    bodyArea: 'Legs',
    holdSec: 25,
    sides: 2,
    description: 'Lean into a wall with one leg extended behind you.',
    science: 'Stretches the gastrocnemius and soleus. Calf flexibility affects ankle dorsiflexion, which directly determines squat depth. Limited ankle mobility is the #1 cause of heel rising during squats.',
    cues: ['Keep back heel on the ground', 'Lean into the wall', 'Straight back leg'],
    detectFn: 'calf_stretch'
  },

  // UPPER BODY
  chest_stretch: {
    name: 'Doorway Chest Stretch',
    bodyArea: 'Chest',
    holdSec: 30,
    sides: 1,
    description: 'Arms on doorframe at 90°, lean forward through doorway.',
    science: 'Targets pectoralis major and minor. Tight pecs cause rounded shoulders and reduce push-up depth. Stretching before pressing exercises does NOT reduce strength output when held <30s (NSCA, 2019).',
    cues: ['Arms at 90 degrees', 'Step through gently', 'Feel the stretch across your chest'],
    detectFn: 'chest_stretch'
  },
  shoulder_cross_body: {
    name: 'Cross-Body Shoulder Stretch',
    bodyArea: 'Shoulders',
    holdSec: 25,
    sides: 2,
    description: 'Pull one arm across your chest with the other hand.',
    science: 'Targets the posterior deltoid and infraspinatus. Essential for shoulder health, especially after pressing movements. Reduces risk of shoulder impingement syndrome.',
    cues: ['Pull arm across at chest height', 'Keep the shoulder down — don\'t shrug', 'Gentle pull, not forced'],
    detectFn: 'shoulder_cross'
  },
  tricep_stretch: {
    name: 'Overhead Tricep Stretch',
    bodyArea: 'Arms',
    holdSec: 25,
    sides: 2,
    description: 'Reach one hand behind your head, pull elbow with other hand.',
    science: 'Targets the long head of the triceps, which crosses the shoulder joint. Important after push-ups and shoulder press to maintain full overhead range of motion.',
    cues: ['Reach hand down between shoulder blades', 'Pull elbow gently behind your head', 'Keep your core engaged — don\'t arch'],
    detectFn: 'tricep_stretch'
  },

  // CORE & BACK
  cat_cow: {
    name: 'Cat-Cow Stretch',
    bodyArea: 'Back',
    holdSec: 40,
    sides: 1,
    description: 'On all fours, alternate between arching and rounding your back.',
    science: 'Dynamic stretch for the entire spinal column. Improves spinal segmental mobility and activates the multifidus and erector spinae. Used in clinical PT to reduce lower back stiffness — reduces LBP intensity by 30% over 4 weeks (Spine Journal, 2017).',
    cues: ['Inhale: drop belly, look up (cow)', 'Exhale: round back, tuck chin (cat)', 'Slow and controlled — match your breathing'],
    detectFn: 'cat_cow'
  },
  childs_pose: {
    name: 'Child\'s Pose',
    bodyArea: 'Back',
    holdSec: 45,
    sides: 1,
    description: 'Kneel, sit back on heels, reach arms forward on the ground.',
    science: 'Gently stretches the latissimus dorsi, erector spinae, and hip extensors simultaneously. Activates parasympathetic nervous system, reducing cortisol levels. Perfect cooldown position — heart rate drops 15-20% faster in this position vs standing.',
    cues: ['Sit your hips back toward your heels', 'Walk your fingers forward', 'Breathe deeply — let everything relax'],
    detectFn: 'childs_pose'
  },
  spinal_twist: {
    name: 'Seated Spinal Twist',
    bodyArea: 'Back',
    holdSec: 30,
    sides: 2,
    description: 'Sit with one leg extended, twist toward the bent knee.',
    science: 'Targets the obliques, erector spinae, and thoracolumbar fascia. Rotational stretching improves thoracic spine mobility, which directly impacts deadlift and shoulder press form. Restores ~5° of rotation per session when chronically stiff.',
    cues: ['Sit tall — don\'t slouch', 'Twist from your mid-back, not just your neck', 'Use your arm on the knee for gentle leverage'],
    detectFn: 'spinal_twist'
  }
};

// ROUTINE TEMPLATES

const MOBILITY_ROUTINES = {
  pre_squat: {
    name: 'Pre-Squat Warmup',
    duration: '5 min',
    stretches: ['hip_flexor_stretch', 'calf_stretch', 'quad_stretch'],
    description: 'Open up your hips and ankles for deeper, safer squats.'
  },
  pre_pushup: {
    name: 'Pre-Push-Up Warmup',
    duration: '4 min',
    stretches: ['chest_stretch', 'shoulder_cross_body', 'cat_cow'],
    description: 'Prepare your chest and shoulders for pressing.'
  },
  pre_deadlift: {
    name: 'Pre-Deadlift Warmup',
    duration: '5 min',
    stretches: ['hamstring_stretch', 'hip_flexor_stretch', 'cat_cow'],
    description: 'Loosen your posterior chain for safer hinging.'
  },
  post_workout: {
    name: 'Post-Workout Cooldown',
    duration: '7 min',
    stretches: ['quad_stretch', 'hamstring_stretch', 'chest_stretch', 'childs_pose'],
    description: 'Full-body cooldown to kickstart recovery.'
  },
  morning_mobility: {
    name: 'Morning Mobility',
    duration: '8 min',
    stretches: ['cat_cow', 'hip_flexor_stretch', 'hamstring_stretch', 'chest_stretch', 'spinal_twist'],
    description: 'Wake up your body. Great on rest days.'
  },
  full_flexibility: {
    name: 'Full Flexibility Session',
    duration: '12 min',
    stretches: ['hip_flexor_stretch', 'hamstring_stretch', 'quad_stretch', 'calf_stretch', 'chest_stretch', 'shoulder_cross_body', 'tricep_stretch', 'cat_cow', 'spinal_twist', 'childs_pose'],
    description: 'Hit every major muscle group. Best after a workout or in the evening.'
  }
};

// WARMUP RECOMMENDATIONS

/**
 * Get recommended warmup based on planned exercise
 * @param {string} exerciseType - The exercise about to be performed
 * @returns {Object|null} Recommended mobility routine
 */
function getWarmupRecommendation(exerciseType) {
  const map = {
    squat: 'pre_squat',
    lunge: 'pre_squat',
    pushup: 'pre_pushup',
    shoulderpress: 'pre_pushup',
    deadlift: 'pre_deadlift'
  };

  const routineKey = map[exerciseType];
  if (!routineKey) return null;

  const routine = MOBILITY_ROUTINES[routineKey];
  return routine ? { key: routineKey, ...routine } : null;
}

// RECOVERY SESSION TRACKER

class RecoverySession {
  constructor(routineKey) {
    const routine = MOBILITY_ROUTINES[routineKey];
    if (!routine) throw new Error(`Unknown routine: ${routineKey}`);

    this.routineKey = routineKey;
    this.routine = routine;
    this.currentStretchIndex = 0;
    this.currentSide = 1; // 1 or 2 (for bilateral stretches)
    this.holdTimer = 0;
    this.isHolding = false;
    this.completed = false;
    this.stretchResults = []; // { stretchId, holdTime, posture }
  }

  /**
   * Get the current stretch to perform
   */
  getCurrentStretch() {
    if (this.completed) return null;
    const stretchId = this.routine.stretches[this.currentStretchIndex];
    const stretch = STRETCH_LIBRARY[stretchId];
    if (!stretch) return null;

    return {
      ...stretch,
      id: stretchId,
      index: this.currentStretchIndex,
      total: this.routine.stretches.length,
      currentSide: this.currentSide,
      sideLabel: stretch.sides === 2
        ? (this.currentSide === 1 ? 'Left Side' : 'Right Side')
        : null
    };
  }

  /**
   * Start hold timer for current stretch
   */
  startHold() {
    this.isHolding = true;
    this.holdTimer = 0;
  }

  /**
   * Update hold timer (call each frame or second)
   * @param {number} dt - Delta time in seconds
   * @returns {Object} { holding, timeLeft, done }
   */
  updateHold(dt) {
    if (!this.isHolding) return { holding: false, timeLeft: 0, done: false };

    this.holdTimer += dt;
    const stretch = this.getCurrentStretch();
    if (!stretch) return { holding: false, timeLeft: 0, done: true };

    const timeLeft = Math.max(0, stretch.holdSec - this.holdTimer);
    const done = timeLeft <= 0;

    if (done) {
      this.isHolding = false;
      this.stretchResults.push({
        stretchId: stretch.id,
        side: this.currentSide,
        holdTime: this.holdTimer
      });
    }

    return { holding: !done, timeLeft, done };
  }

  /**
   * Advance to next stretch (or next side)
   * @returns {boolean} true if there are more stretches
   */
  advance() {
    const stretch = this.getCurrentStretch();
    if (!stretch) { this.completed = true; return false; }

    // If bilateral and on side 1, switch to side 2
    if (stretch.sides === 2 && this.currentSide === 1) {
      this.currentSide = 2;
      this.holdTimer = 0;
      return true;
    }

    // Move to next stretch
    this.currentStretchIndex++;
    this.currentSide = 1;
    this.holdTimer = 0;

    if (this.currentStretchIndex >= this.routine.stretches.length) {
      this.completed = true;
      return false;
    }

    return true;
  }

  /**
   * Get summary at end of session
   */
  getSummary() {
    const totalHoldTime = this.stretchResults.reduce((s, r) => s + r.holdTime, 0);
    return {
      routine: this.routine.name,
      stretchesCompleted: this.stretchResults.length,
      totalHoldTime: Math.round(totalHoldTime),
      results: this.stretchResults
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STRETCH_LIBRARY, MOBILITY_ROUTINES, getWarmupRecommendation, RecoverySession };
}
