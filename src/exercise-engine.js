// Exercise engine — calculates angles, evaluates form, counts reps

// ANGLE UTILITIES

/**
 * Calculate angle (in degrees) at point B formed by points A-B-C
 * @param {Object} a - {x, y}
 * @param {Object} b - {x, y} (vertex)
 * @param {Object} c - {x, y}
 * @returns {number} angle in degrees [0-180]
 */
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180 / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

/**
 * Get a named landmark from MediaPipe results
 * MediaPipe Pose landmark indices
 */
const LANDMARKS = {
  NOSE: 0, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14, LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24, LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28
};

function getLandmark(landmarks, name) {
  const idx = LANDMARKS[name];
  if (idx === undefined || !landmarks[idx]) return null;
  const lm = landmarks[idx];
  return { x: lm.x, y: lm.y, visibility: lm.visibility || 0 };
}

/**
 * Check if key landmarks are visible enough to evaluate
 */
function landmarksVisible(landmarks, names, threshold = 0.5) {
  return names.every(name => {
    const lm = getLandmark(landmarks, name);
    return lm && lm.visibility >= threshold;
  });
}

// EXERCISE DEFINITIONS

const EXERCISES = {
  squat: {
    name: 'Squats',
    requiredLandmarks: ['LEFT_HIP', 'LEFT_KNEE', 'LEFT_ANKLE', 'RIGHT_HIP', 'RIGHT_KNEE', 'RIGHT_ANKLE', 'LEFT_SHOULDER', 'RIGHT_SHOULDER'],
    // State machine: standing -> descending -> bottom -> ascending -> standing (=1 rep)
    phases: ['standing', 'descending', 'bottom', 'ascending'],
    thresholds: {
      standingKneeAngle: 160,   // near straight
      bottomKneeAngle: 100,     // parallel or below
      kneeOverToeLimit: 0.08,   // knee x shouldn't exceed toe x by this margin
      kneeCaveLimit: 0.03       // knees caving inward threshold
    }
  },
  pushup: {
    name: 'Push-Ups',
    requiredLandmarks: ['LEFT_SHOULDER', 'LEFT_ELBOW', 'LEFT_WRIST', 'RIGHT_SHOULDER', 'RIGHT_ELBOW', 'RIGHT_WRIST', 'LEFT_HIP', 'RIGHT_HIP'],
    phases: ['up', 'descending', 'bottom', 'ascending'],
    thresholds: {
      upElbowAngle: 155,
      bottomElbowAngle: 90,
      hipSagThreshold: 15  // degrees deviation from straight line
    }
  },
  plank: {
    name: 'Plank',
    requiredLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_ANKLE', 'RIGHT_ANKLE'],
    phases: ['holding'],
    thresholds: {
      hipDropAngle: 160,   // shoulder-hip-ankle should be ~180
      hipPikeAngle: 195,
      holdInterval: 5       // give feedback every 5 seconds
    }
  },
  lunge: {
    name: 'Lunges',
    icon: '🦿',
    requiredLandmarks: ['LEFT_HIP', 'LEFT_KNEE', 'LEFT_ANKLE', 'RIGHT_HIP', 'RIGHT_KNEE', 'RIGHT_ANKLE', 'LEFT_SHOULDER', 'RIGHT_SHOULDER'],
    phases: ['standing', 'descending', 'bottom', 'ascending'],
    thresholds: {
      standingKneeAngle: 160,
      bottomKneeAngle: 100,
      torsoLeanLimit: 0.06   // torso should stay upright
    }
  },
  shoulderpress: {
    name: 'Shoulder Press',
    icon: '🏋️',
    requiredLandmarks: ['LEFT_SHOULDER', 'LEFT_ELBOW', 'LEFT_WRIST', 'RIGHT_SHOULDER', 'RIGHT_ELBOW', 'RIGHT_WRIST'],
    phases: ['down', 'pressing', 'top', 'lowering'],
    thresholds: {
      downElbowAngle: 90,
      topElbowAngle: 160,
      asymmetryLimit: 20      // degrees difference between arms
    }
  },
  deadlift: {
    name: 'Deadlift',
    icon: '💪',
    requiredLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE'],
    phases: ['bottom', 'lifting', 'top', 'lowering'],
    thresholds: {
      topHipAngle: 170,       // fully standing
      bottomHipAngle: 100,    // hinged over
      roundBackThreshold: 0.06 // shoulder-hip vertical deviation
    }
  },
  wall_sit: {
    name: 'Wall Sit',
    icon: '🧱',
    requiredLandmarks: ['LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE', 'LEFT_SHOULDER', 'RIGHT_SHOULDER'],
    phases: ['holding'],
    thresholds: {
      targetKneeAngle: 90,
      kneeAngleTolerance: 15,
      backAngleTolerance: 20,
      holdInterval: 5
    }
  },
  glute_bridge: {
    name: 'Glute Bridge',
    icon: '🍑',
    requiredLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE'],
    phases: ['down', 'lifting', 'top', 'lowering'],
    thresholds: {
      downHipAngle: 110,
      topHipAngle: 160,
      asymmetryLimit: 15
    }
  },
  mountain_climbers: {
    name: 'Mountain Climbers',
    icon: '⛰️',
    requiredLandmarks: ['LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE', 'LEFT_SHOULDER', 'RIGHT_SHOULDER'],
    phases: ['extended', 'driving', 'tucked', 'returning'],
    thresholds: {
      extendedHipAngle: 155,
      drivingHipAngle: 110,
      hipFlexionMin: 90,
      kneeCaveThreshold: 0.05
    }
  },
  burpees: {
    name: 'Burpees',
    icon: '💥',
    requiredLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE'],
    phases: ['standing', 'descending', 'plank', 'ascending'],
    thresholds: {
      standingKneeAngle: 160,
      bottomKneeAngle: 100,
      plankBodyAngle: 165,
      jumpDetectionThreshold: 0.15
    }
  },
  jumping_jacks: {
    name: 'Jumping Jacks',
    icon: '🤸',
    requiredLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_WRIST', 'RIGHT_WRIST'],
    phases: ['closed', 'opening', 'open', 'closing'],
    thresholds: {
      closedArmAngle: 40,
      openArmAngle: 120,
      closedLegDistance: 0.08,
      openLegDistance: 0.30
    }
  },
  high_knees: {
    name: 'High Knees',
    icon: '🦵',
    requiredLandmarks: ['LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE'],
    phases: ['standing', 'driving', 'peak', 'returning'],
    thresholds: {
      standingHipAngle: 160,
      drivingHipAngle: 100,
      peakHipAngle: 80,
      hipFlexionThreshold: 0.10
    }
  },
  squat_jump: {
    name: 'Squat Jump',
    icon: '🦘',
    requiredLandmarks: ['LEFT_HIP', 'LEFT_KNEE', 'LEFT_ANKLE', 'RIGHT_HIP', 'RIGHT_KNEE', 'RIGHT_ANKLE', 'LEFT_SHOULDER', 'RIGHT_SHOULDER'],
    phases: ['standing', 'descending', 'bottom', 'jumping'],
    thresholds: {
      standingKneeAngle: 160,
      bottomKneeAngle: 100,
      jumpThreshold: 0.20,
      kneeCaveLimit: 0.03
    }
  },
  superman: {
    name: 'Superman',
    icon: '🦸',
    requiredLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_ANKLE', 'RIGHT_ANKLE'],
    phases: ['holding'],
    thresholds: {
      bodyExtensionAngle: 170,
      extensionTolerance: 20,
      holdInterval: 5
    }
  },
  calf_raises: {
    name: 'Calf Raises',
    icon: '🦶',
    requiredLandmarks: ['LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE', 'LEFT_HIP', 'RIGHT_HIP'],
    phases: ['flat', 'rising', 'peak', 'lowering'],
    thresholds: {
      flatAnkleAngle: 90,
      peakAnkleAngle: 130,
      asymmetryLimit: 12
    }
  },
  tricep_dip: {
    name: 'Tricep Dip',
    icon: '💪',
    requiredLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW', 'LEFT_WRIST', 'RIGHT_WRIST', 'LEFT_HIP', 'RIGHT_HIP'],
    phases: ['up', 'descending', 'bottom', 'ascending'],
    thresholds: {
      upElbowAngle: 155,
      bottomElbowAngle: 90,
      shoulderDipLimit: 0.10
    }
  },
  side_plank: {
    name: 'Side Plank',
    icon: '⬅️',
    requiredLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_ANKLE', 'RIGHT_ANKLE'],
    phases: ['holding'],
    thresholds: {
      bodyAlignmentAngle: 170,
      alignmentTolerance: 20,
      holdInterval: 5
    }
  },
  bicycle_crunch: {
    name: 'Bicycle Crunch',
    icon: '🚴',
    requiredLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ELBOW', 'RIGHT_ELBOW'],
    phases: ['center', 'twisting', 'peak', 'returning'],
    thresholds: {
      centerDistance: 0.25,
      peakDistance: 0.10,
      torsoRotationThreshold: 0.08
    }
  }
};

// REP COUNTER STATE MACHINE

class ExerciseTracker {
  constructor(exerciseType) {
    this.type = exerciseType;
    this.config = EXERCISES[exerciseType];
    this.reps = 0;
    this.phase = this.config.phases[0];
    this.formIssues = {};       // { issueName: count }
    this.goodFormReps = 0;
    this.totalFormChecks = 0;
    this.goodFormChecks = 0;
    this.lastFeedback = { message: '', type: '', timestamp: 0 };
    this.plankStartTime = null;
    this.plankHoldTime = 0;
    this.lastPlankFeedbackTime = 0;

    // ROM tracking (for rehab features)
    this.romHistory = [];         // [{angle, timestamp}] — track range of motion over session
    this.peakROM = 0;             // Best ROM achieved this session
    this.minROM = 180;            // Minimum angle (deepest point)

    // Milestone tracking
    this.milestones = [];         // [{type, message, rep}] — triggered milestones
    this._lastMilestoneRep = 0;
    this._prevReps = 0;
  }

  /**
   * Process a frame of landmarks and return feedback
   * @param {Array} landmarks - MediaPipe pose landmarks
   * @returns {Object} { reps, feedback: {message, type}, formScore }
   */
  processFrame(landmarks) {
    if (!landmarks || !landmarksVisible(landmarks, this.config.requiredLandmarks)) {
      return {
        reps: this.reps,
        feedback: { message: 'Position your full body in frame', type: 'warn' },
        formScore: this.getFormScore()
      };
    }

    let result;
    switch (this.type) {
      case 'squat': result = this._processSquat(landmarks); break;
      case 'pushup': result = this._processPushup(landmarks); break;
      case 'plank': result = this._processPlank(landmarks); break;
      case 'lunge': result = this._processLunge(landmarks); break;
      case 'shoulderpress': result = this._processShoulderPress(landmarks); break;
      case 'deadlift': result = this._processDeadlift(landmarks); break;
      case 'wall_sit': result = this._processWallSit(landmarks); break;
      case 'glute_bridge': result = this._processGluteBridge(landmarks); break;
      case 'mountain_climbers': result = this._processMountainClimbers(landmarks); break;
      case 'burpees': result = this._processBurpees(landmarks); break;
      case 'jumping_jacks': result = this._processJumpingJacks(landmarks); break;
      case 'high_knees': result = this._processHighKnees(landmarks); break;
      case 'squat_jump': result = this._processSquatJump(landmarks); break;
      case 'superman': result = this._processSuperman(landmarks); break;
      case 'calf_raises': result = this._processCalfRaises(landmarks); break;
      case 'tricep_dip': result = this._processTricepDip(landmarks); break;
      case 'side_plank': result = this._processSidePlank(landmarks); break;
      case 'bicycle_crunch': result = this._processBicycleCrunch(landmarks); break;
      default: result = { feedback: { message: '', type: '' } };
    }

    // Check for milestones after processing
    const milestone = this._checkMilestones();
    if (milestone) {
      result.milestone = milestone;
    }

    return {
      reps: this.reps,
      feedback: result.feedback,
      formScore: this.getFormScore(),
      plankHoldTime: this.plankHoldTime
    };
  }

  _processSquat(landmarks) {
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const lAnkle = getLandmark(landmarks, 'LEFT_ANKLE');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');
    const rAnkle = getLandmark(landmarks, 'RIGHT_ANKLE');
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');

    // Average both sides for knee angle
    const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

    // Back angle (shoulder-hip-knee)
    // eslint-disable-next-line no-unused-vars -- reserved for future forward-lean scoring
    const _leftBackAngle = calculateAngle(lShoulder, lHip, lKnee);
    // eslint-disable-next-line no-unused-vars
    const _rightBackAngle = calculateAngle(rShoulder, rHip, rKnee);

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    // Form checks
    // 1. Knee cave check (knees collapsing inward)
    const kneeDist = Math.abs(lKnee.x - rKnee.x);
    const hipDist = Math.abs(lHip.x - rHip.x);
    if (kneeAngle < t.standingKneeAngle && kneeDist < hipDist * 0.6) {
      feedback = { message: 'Knees caving in! Push knees out', type: 'bad' };
      this._recordIssue('Knee valgus (knees caving)');
      currentFormGood = false;
    }

    // 2. Forward lean check
    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    if (kneeAngle < 130 && midShoulder.y > midHip.y + 0.05) {
      // Shoulders significantly forward of hips while deep in squat
      if (feedback.type !== 'bad') {
        feedback = { message: 'Chest up! Avoid forward lean', type: 'warn' };
        this._recordIssue('Excessive forward lean');
        currentFormGood = false;
      }
    }

    // State machine transitions
    if (this.phase === 'standing' && kneeAngle < t.standingKneeAngle - 10) {
      this.phase = 'descending';
    } else if (this.phase === 'descending' && kneeAngle <= t.bottomKneeAngle) {
      this.phase = 'bottom';
      if (currentFormGood && feedback.type === '') {
        feedback = { message: 'Good depth!', type: 'good' };
      }
    } else if (this.phase === 'descending' && kneeAngle > t.standingKneeAngle - 5) {
      // Went back up without hitting depth
      this.phase = 'standing';
      feedback = { message: 'Go deeper! Hit parallel', type: 'warn' };
      this._recordIssue('Insufficient depth');
    } else if (this.phase === 'bottom' && kneeAngle > t.bottomKneeAngle + 15) {
      this.phase = 'ascending';
    } else if (this.phase === 'ascending' && kneeAngle >= t.standingKneeAngle - 5) {
      this.phase = 'standing';
      this.reps++;
      this.totalFormChecks++;
      if (currentFormGood) {
        this.goodFormChecks++;
        feedback = { message: 'Great rep!', type: 'good' };
      }
    }

    return { feedback };
  }

  _processPushup(landmarks) {
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const lElbow = getLandmark(landmarks, 'LEFT_ELBOW');
    const lWrist = getLandmark(landmarks, 'LEFT_WRIST');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    const rElbow = getLandmark(landmarks, 'RIGHT_ELBOW');
    const rWrist = getLandmark(landmarks, 'RIGHT_WRIST');
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');

    // Elbow angle (shoulder-elbow-wrist)
    const leftElbowAngle = calculateAngle(lShoulder, lElbow, lWrist);
    const rightElbowAngle = calculateAngle(rShoulder, rElbow, rWrist);
    const elbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    // Hip sag check: shoulder-hip should be roughly straight line toward ankle
    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    // Form check: hip sag
    // In pushup position (viewed from side), hips sagging means hip.y > interpolated shoulder-ankle line
    const hipDrop = midHip.y - midShoulder.y;
    if (hipDrop > 0.08) {
      feedback = { message: 'Hips sagging! Tighten your core', type: 'bad' };
      this._recordIssue('Hip sag');
      currentFormGood = false;
    } else if (hipDrop < -0.08) {
      feedback = { message: 'Hips too high! Straighten body', type: 'warn' };
      this._recordIssue('Hip pike');
      currentFormGood = false;
    }

    // Form check: elbow flare (elbows going too wide)
    const elbowWidth = Math.abs(lElbow.x - rElbow.x);
    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
    if (elbowAngle < 130 && elbowWidth > shoulderWidth * 1.6) {
      if (feedback.type !== 'bad') {
        feedback = { message: 'Elbows flaring! Tuck them in', type: 'warn' };
        this._recordIssue('Elbow flare');
        currentFormGood = false;
      }
    }

    // State machine
    if (this.phase === 'up' && elbowAngle < t.upElbowAngle - 15) {
      this.phase = 'descending';
    } else if (this.phase === 'descending' && elbowAngle <= t.bottomElbowAngle) {
      this.phase = 'bottom';
      if (currentFormGood && feedback.type === '') {
        feedback = { message: 'Good depth!', type: 'good' };
      }
    } else if (this.phase === 'descending' && elbowAngle > t.upElbowAngle - 5) {
      this.phase = 'up';
      feedback = { message: 'Go lower! Chest to floor', type: 'warn' };
      this._recordIssue('Insufficient depth');
    } else if (this.phase === 'bottom' && elbowAngle > t.bottomElbowAngle + 20) {
      this.phase = 'ascending';
    } else if (this.phase === 'ascending' && elbowAngle >= t.upElbowAngle - 5) {
      this.phase = 'up';
      this.reps++;
      this.totalFormChecks++;
      if (currentFormGood) {
        this.goodFormChecks++;
        feedback = { message: 'Solid rep!', type: 'good' };
      }
    }

    return { feedback };
  }

  _processPlank(landmarks) {
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lAnkle = getLandmark(landmarks, 'LEFT_ANKLE');
    const rAnkle = getLandmark(landmarks, 'RIGHT_ANKLE');

    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const midAnkle = { x: (lAnkle.x + rAnkle.x) / 2, y: (lAnkle.y + rAnkle.y) / 2 };

    // Body alignment angle
    const bodyAngle = calculateAngle(midShoulder, midHip, midAnkle);

    let feedback = { message: '', type: '' };
    const t = this.config.thresholds;

    // Start timing
    if (!this.plankStartTime) {
      this.plankStartTime = Date.now();
    }
    this.plankHoldTime = (Date.now() - this.plankStartTime) / 1000;

    // Form checks
    this.totalFormChecks++;
    if (bodyAngle < t.hipDropAngle) {
      feedback = { message: 'Hips dropping! Raise them up', type: 'bad' };
      this._recordIssue('Hip drop');
    } else if (bodyAngle > t.hipPikeAngle) {
      feedback = { message: 'Hips too high! Lower them', type: 'warn' };
      this._recordIssue('Hip pike');
    } else {
      this.goodFormChecks++;
      // Periodic positive feedback
      const now = Date.now();
      if (now - this.lastPlankFeedbackTime > t.holdInterval * 1000) {
        const holdSecs = Math.floor(this.plankHoldTime);
        feedback = { message: `Great form! ${holdSecs}s`, type: 'good' };
        this.lastPlankFeedbackTime = now;
      }
    }

    // For plank, "reps" = seconds held with good form
    this.reps = Math.floor(this.plankHoldTime);

    return { feedback };
  }

  _processLunge(landmarks) {
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const lAnkle = getLandmark(landmarks, 'LEFT_ANKLE');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');
    const rAnkle = getLandmark(landmarks, 'RIGHT_ANKLE');
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');

    // Front leg knee angle (use the leg with smaller knee angle = deeper bend)
    const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const frontKneeAngle = Math.min(leftKneeAngle, rightKneeAngle);

    // Torso upright check
    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    // Track ROM
    this._trackROM(frontKneeAngle);

    // Form: torso lean
    const torsoLean = Math.abs(midShoulder.x - midHip.x);
    if (frontKneeAngle < 130 && torsoLean > t.torsoLeanLimit) {
      feedback = { message: 'Keep torso upright!', type: 'warn' };
      this._recordIssue('Torso lean');
      currentFormGood = false;
    }

    // Form: front knee past toes (knee x beyond ankle x)
    const frontKnee = leftKneeAngle < rightKneeAngle ? lKnee : rKnee;
    const frontAnkle = leftKneeAngle < rightKneeAngle ? lAnkle : rAnkle;
    if (frontKneeAngle < 120 && Math.abs(frontKnee.x - frontAnkle.x) > 0.06) {
      if (feedback.type !== 'bad') {
        feedback = { message: 'Knee over toes! Step wider', type: 'bad' };
        this._recordIssue('Knee past toes');
        currentFormGood = false;
      }
    }

    // State machine
    if (this.phase === 'standing' && frontKneeAngle < t.standingKneeAngle - 10) {
      this.phase = 'descending';
    } else if (this.phase === 'descending' && frontKneeAngle <= t.bottomKneeAngle) {
      this.phase = 'bottom';
      if (currentFormGood && feedback.type === '') {
        feedback = { message: 'Good depth!', type: 'good' };
      }
    } else if (this.phase === 'descending' && frontKneeAngle > t.standingKneeAngle - 5) {
      this.phase = 'standing';
      feedback = { message: 'Go deeper!', type: 'warn' };
      this._recordIssue('Insufficient depth');
    } else if (this.phase === 'bottom' && frontKneeAngle > t.bottomKneeAngle + 15) {
      this.phase = 'ascending';
    } else if (this.phase === 'ascending' && frontKneeAngle >= t.standingKneeAngle - 5) {
      this.phase = 'standing';
      this.reps++;
      this.totalFormChecks++;
      if (currentFormGood) {
        this.goodFormChecks++;
        feedback = { message: 'Great lunge!', type: 'good' };
      }
    }

    return { feedback };
  }

  _processShoulderPress(landmarks) {
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const lElbow = getLandmark(landmarks, 'LEFT_ELBOW');
    const lWrist = getLandmark(landmarks, 'LEFT_WRIST');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    const rElbow = getLandmark(landmarks, 'RIGHT_ELBOW');
    const rWrist = getLandmark(landmarks, 'RIGHT_WRIST');

    const leftElbowAngle = calculateAngle(lShoulder, lElbow, lWrist);
    const rightElbowAngle = calculateAngle(rShoulder, rElbow, rWrist);
    const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    // Track ROM
    this._trackROM(avgElbowAngle);

    // Form: asymmetry check (one arm higher than the other)
    const asymmetry = Math.abs(leftElbowAngle - rightElbowAngle);
    if (asymmetry > t.asymmetryLimit) {
      feedback = { message: 'Arms uneven! Press evenly', type: 'warn' };
      this._recordIssue('Arm asymmetry');
      currentFormGood = false;
    }

    // Form: wrists behind shoulders (bad overhead position)
    if (avgElbowAngle > 140 && lWrist.y > lShoulder.y) {
      if (feedback.type !== 'bad') {
        feedback = { message: 'Press overhead! Wrists above shoulders', type: 'warn' };
        this._recordIssue('Incomplete lockout');
        currentFormGood = false;
      }
    }

    // State machine
    if (this.phase === 'down' && avgElbowAngle > t.downElbowAngle + 15) {
      this.phase = 'pressing';
    } else if (this.phase === 'pressing' && avgElbowAngle >= t.topElbowAngle) {
      this.phase = 'top';
      if (currentFormGood && feedback.type === '') {
        feedback = { message: 'Full lockout!', type: 'good' };
      }
    } else if (this.phase === 'top' && avgElbowAngle < t.topElbowAngle - 15) {
      this.phase = 'lowering';
    } else if (this.phase === 'lowering' && avgElbowAngle <= t.downElbowAngle + 5) {
      this.phase = 'down';
      this.reps++;
      this.totalFormChecks++;
      if (currentFormGood) {
        this.goodFormChecks++;
        feedback = { message: 'Solid press!', type: 'good' };
      }
    }

    return { feedback };
  }

  _processDeadlift(landmarks) {
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');

    // Hip hinge angle (shoulder-hip-knee)
    const leftHipAngle = calculateAngle(lShoulder, lHip, lKnee);
    const rightHipAngle = calculateAngle(rShoulder, rHip, rKnee);
    const hipAngle = (leftHipAngle + rightHipAngle) / 2;

    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    // Track ROM
    this._trackROM(hipAngle);

    // Form: rounded back (shoulders too far forward relative to hips)
    const shoulderForward = midShoulder.x - midHip.x;
    if (hipAngle < 140 && Math.abs(shoulderForward) > t.roundBackThreshold) {
      feedback = { message: 'Keep back straight! Neutral spine', type: 'bad' };
      this._recordIssue('Rounded back');
      currentFormGood = false;
    }

    // State machine
    if (this.phase === 'bottom' && hipAngle > t.bottomHipAngle + 20) {
      this.phase = 'lifting';
    } else if (this.phase === 'lifting' && hipAngle >= t.topHipAngle) {
      this.phase = 'top';
      this.reps++;
      this.totalFormChecks++;
      if (currentFormGood) {
        this.goodFormChecks++;
        feedback = { message: 'Strong lift!', type: 'good' };
      }
    } else if (this.phase === 'top' && hipAngle < t.topHipAngle - 15) {
      this.phase = 'lowering';
    } else if (this.phase === 'lowering' && hipAngle <= t.bottomHipAngle + 5) {
      this.phase = 'bottom';
      if (currentFormGood && feedback.type === '') {
        feedback = { message: 'Good hinge!', type: 'good' };
      }
    } else if (this.phase === 'top' && hipAngle >= t.topHipAngle && this.reps === 0) {
      // First frame — user is standing, needs to hinge down first
      this.phase = 'top';
    }

    return { feedback };
  }

  _processWallSit(landmarks) {
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');
    const lAnkle = getLandmark(landmarks, 'LEFT_ANKLE');
    const rAnkle = getLandmark(landmarks, 'RIGHT_ANKLE');
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');

    const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

    const backAngle = calculateAngle(lShoulder, lHip, rShoulder);

    let feedback = { message: '', type: '' };
    const t = this.config.thresholds;

    if (!this.plankStartTime) {
      this.plankStartTime = Date.now();
    }
    this.plankHoldTime = (Date.now() - this.plankStartTime) / 1000;

    this.totalFormChecks++;
    if (Math.abs(kneeAngle - t.targetKneeAngle) > t.kneeAngleTolerance || Math.abs(backAngle - 180) > t.backAngleTolerance) {
      feedback = { message: 'Keep knees at 90°, back on wall', type: 'warn' };
      this._recordIssue('Wall sit form');
    } else {
      this.goodFormChecks++;
      const now = Date.now();
      if (now - this.lastPlankFeedbackTime > t.holdInterval * 1000) {
        feedback = { message: `Solid hold! ${Math.floor(this.plankHoldTime)}s`, type: 'good' };
        this.lastPlankFeedbackTime = now;
      }
    }

    this.reps = Math.floor(this.plankHoldTime);
    return { feedback };
  }

  _processGluteBridge(landmarks) {
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');

    const leftHipAngle = calculateAngle(lShoulder, lHip, lKnee);
    const rightHipAngle = calculateAngle(rShoulder, rHip, rKnee);
    const hipAngle = (leftHipAngle + rightHipAngle) / 2;

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    this._trackROM(hipAngle);

    const asymmetry = Math.abs(leftHipAngle - rightHipAngle);
    if (asymmetry > t.asymmetryLimit && hipAngle < 140) {
      feedback = { message: 'Bridge evenly! Both sides up', type: 'warn' };
      this._recordIssue('Hip asymmetry');
      currentFormGood = false;
    }

    if (this.phase === 'down' && hipAngle > t.downHipAngle + 10) {
      this.phase = 'lifting';
    } else if (this.phase === 'lifting' && hipAngle >= t.topHipAngle) {
      this.phase = 'top';
      if (currentFormGood) feedback = { message: 'Full extension!', type: 'good' };
    } else if (this.phase === 'top' && hipAngle < t.topHipAngle - 15) {
      this.phase = 'lowering';
    } else if (this.phase === 'lowering' && hipAngle <= t.downHipAngle + 5) {
      this.phase = 'down';
      this.reps++;
      this.totalFormChecks++;
      if (currentFormGood) {
        this.goodFormChecks++;
        feedback = { message: 'Great bridge!', type: 'good' };
      }
    }

    return { feedback };
  }

  _processMountainClimbers(landmarks) {
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');

    const leftHipAngle = calculateAngle(lShoulder, lHip, lKnee);
    const rightHipAngle = calculateAngle(rShoulder, rHip, rKnee);
    const activeLegAngle = Math.min(leftHipAngle, rightHipAngle);

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    this._trackROM(activeLegAngle);

    const kneeDist = Math.abs(lKnee.x - rKnee.x);
    const hipDist = Math.abs(lHip.x - rHip.x);
    if (activeLegAngle < 120 && kneeDist < hipDist * 0.5) {
      feedback = { message: 'Knees in line! Don\'t cave', type: 'warn' };
      this._recordIssue('Knee alignment');
      currentFormGood = false;
    }

    if (this.phase === 'extended' && activeLegAngle < t.drivingHipAngle) {
      this.phase = 'driving';
    } else if (this.phase === 'driving' && activeLegAngle <= t.hipFlexionMin) {
      this.phase = 'tucked';
      if (currentFormGood) this.reps++;
    } else if (this.phase === 'tucked' && activeLegAngle > t.drivingHipAngle + 10) {
      this.phase = 'returning';
    } else if (this.phase === 'returning' && activeLegAngle >= t.extendedHipAngle) {
      this.phase = 'extended';
      this.totalFormChecks++;
      if (currentFormGood) this.goodFormChecks++;
    }

    return { feedback };
  }

  _processBurpees(landmarks) {
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    const lAnkle = getLandmark(landmarks, 'LEFT_ANKLE');
    const rAnkle = getLandmark(landmarks, 'RIGHT_ANKLE');

    const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const midAnkle = { x: (lAnkle.x + rAnkle.x) / 2, y: (lAnkle.y + rAnkle.y) / 2 };
    const bodyAngle = calculateAngle(midShoulder, midHip, midAnkle);

    let feedback = { message: '', type: '' };
    const currentFormGood = true;
    const t = this.config.thresholds;

    if (this.phase === 'standing' && kneeAngle < t.standingKneeAngle - 15) {
      this.phase = 'descending';
    } else if (this.phase === 'descending' && kneeAngle <= t.bottomKneeAngle) {
      this.phase = 'plank';
      feedback = { message: 'Good squat! Now plank', type: 'good' };
    } else if (this.phase === 'plank' && Math.abs(bodyAngle - 180) < 20) {
      if (currentFormGood) feedback = { message: 'Strong plank form!', type: 'good' };
    } else if (this.phase === 'plank' && kneeAngle > t.standingKneeAngle - 10) {
      this.phase = 'ascending';
    } else if (this.phase === 'ascending' && kneeAngle >= t.standingKneeAngle - 5) {
      this.phase = 'standing';
      this.reps++;
      this.totalFormChecks++;
      if (currentFormGood) {
        this.goodFormChecks++;
        feedback = { message: 'Burpee complete!', type: 'good' };
      }
    }

    return { feedback };
  }

  _processJumpingJacks(landmarks) {
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    // eslint-disable-next-line no-unused-vars -- required for landmark visibility check
    const _rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    const lWrist = getLandmark(landmarks, 'LEFT_WRIST');
    const rWrist = getLandmark(landmarks, 'RIGHT_WRIST');
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');

    const armAngle = calculateAngle(lWrist, lShoulder, rWrist);
    const legDistance = Math.abs(lHip.x - rHip.x);

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    this._trackROM(armAngle);

    if (legDistance < t.openLegDistance * 0.3 && armAngle < t.closedArmAngle + 20) {
      this.goodFormChecks++;
      currentFormGood = true;
    } else if (legDistance > t.openLegDistance * 0.8 && armAngle > t.openArmAngle - 20) {
      this.goodFormChecks++;
      currentFormGood = true;
    }
    this.totalFormChecks++;

    if (this.phase === 'closed' && armAngle > t.openArmAngle - 20 && legDistance > t.openLegDistance * 0.6) {
      this.phase = 'opening';
    } else if (this.phase === 'opening' && armAngle >= t.openArmAngle && legDistance >= t.openLegDistance) {
      this.phase = 'open';
      if (currentFormGood) feedback = { message: 'Full spread!', type: 'good' };
    } else if (this.phase === 'open' && (armAngle < t.closedArmAngle + 30 || legDistance < t.closedLegDistance * 2)) {
      this.phase = 'closing';
    } else if (this.phase === 'closing' && armAngle <= t.closedArmAngle && legDistance <= t.closedLegDistance) {
      this.phase = 'closed';
      this.reps++;
      if (currentFormGood) feedback = { message: 'Perfect jack!', type: 'good' };
    }

    return { feedback };
  }

  _processHighKnees(landmarks) {
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');
    const lAnkle = getLandmark(landmarks, 'LEFT_ANKLE');
    const rAnkle = getLandmark(landmarks, 'RIGHT_ANKLE');

    const leftHipAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rightHipAngle = calculateAngle(rHip, rKnee, rAnkle);
    const activeHipAngle = Math.min(leftHipAngle, rightHipAngle);

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    this._trackROM(activeHipAngle);

    const kneeHeight = Math.min(lKnee.y, rKnee.y) - Math.min(lHip.y, rHip.y);
    if (activeHipAngle < t.peakHipAngle && kneeHeight < t.hipFlexionThreshold) {
      feedback = { message: 'Lift knees higher!', type: 'warn' };
      this._recordIssue('Low knee drive');
      currentFormGood = false;
    }

    if (this.phase === 'standing' && activeHipAngle < t.drivingHipAngle) {
      this.phase = 'driving';
    } else if (this.phase === 'driving' && activeHipAngle <= t.peakHipAngle) {
      this.phase = 'peak';
      if (currentFormGood) this.reps++;
    } else if (this.phase === 'peak' && activeHipAngle > t.drivingHipAngle + 10) {
      this.phase = 'returning';
    } else if (this.phase === 'returning' && activeHipAngle >= t.standingHipAngle) {
      this.phase = 'standing';
      this.totalFormChecks++;
      if (currentFormGood) this.goodFormChecks++;
    }

    return { feedback };
  }

  _processSquatJump(landmarks) {
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');
    const lAnkle = getLandmark(landmarks, 'LEFT_ANKLE');
    const rAnkle = getLandmark(landmarks, 'RIGHT_ANKLE');
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');

    const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    const kneeDist = Math.abs(lKnee.x - rKnee.x);
    const hipDist = Math.abs(lHip.x - rHip.x);
    if (kneeAngle < t.standingKneeAngle && kneeDist < hipDist * 0.6) {
      this._recordIssue('Knee valgus');
      currentFormGood = false;
    }

    if (this.phase === 'standing' && kneeAngle < t.standingKneeAngle - 10) {
      this.phase = 'descending';
    } else if (this.phase === 'descending' && kneeAngle <= t.bottomKneeAngle) {
      this.phase = 'bottom';
      if (currentFormGood) feedback = { message: 'Good depth!', type: 'good' };
    } else if (this.phase === 'bottom' && midShoulder.y < midHip.y - t.jumpDetectionThreshold) {
      this.phase = 'jumping';
      if (currentFormGood) feedback = { message: 'Explosive!', type: 'good' };
    } else if (this.phase === 'jumping' && kneeAngle >= t.standingKneeAngle - 5) {
      this.phase = 'standing';
      this.reps++;
      this.totalFormChecks++;
      if (currentFormGood) {
        this.goodFormChecks++;
        feedback = { message: 'Perfect jump!', type: 'good' };
      }
    }

    return { feedback };
  }

  _processSuperman(landmarks) {
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lAnkle = getLandmark(landmarks, 'LEFT_ANKLE');
    const rAnkle = getLandmark(landmarks, 'RIGHT_ANKLE');

    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const midAnkle = { x: (lAnkle.x + rAnkle.x) / 2, y: (lAnkle.y + rAnkle.y) / 2 };

    const bodyAngle = calculateAngle(midShoulder, midHip, midAnkle);

    let feedback = { message: '', type: '' };
    const t = this.config.thresholds;

    if (!this.plankStartTime) {
      this.plankStartTime = Date.now();
    }
    this.plankHoldTime = (Date.now() - this.plankStartTime) / 1000;

    this.totalFormChecks++;
    if (Math.abs(bodyAngle - 180) > t.extensionTolerance) {
      feedback = { message: 'Extend fully! Arms and legs straight', type: 'warn' };
      this._recordIssue('Incomplete extension');
    } else {
      this.goodFormChecks++;
      const now = Date.now();
      if (now - this.lastPlankFeedbackTime > t.holdInterval * 1000) {
        feedback = { message: `Great form! ${Math.floor(this.plankHoldTime)}s`, type: 'good' };
        this.lastPlankFeedbackTime = now;
      }
    }

    this.reps = Math.floor(this.plankHoldTime);
    return { feedback };
  }

  _processCalfRaises(landmarks) {
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');
    const lAnkle = getLandmark(landmarks, 'LEFT_ANKLE');
    const rAnkle = getLandmark(landmarks, 'RIGHT_ANKLE');
    // eslint-disable-next-line no-unused-vars -- required for landmark visibility check
    const _lHip = getLandmark(landmarks, 'LEFT_HIP');
    // eslint-disable-next-line no-unused-vars
    const _rHip = getLandmark(landmarks, 'RIGHT_HIP');

    const leftAnkleAngle = calculateAngle(lKnee, lAnkle, { x: lAnkle.x, y: lAnkle.y - 0.1 });
    const rightAnkleAngle = calculateAngle(rKnee, rAnkle, { x: rAnkle.x, y: rAnkle.y - 0.1 });
    const ankleAngle = (leftAnkleAngle + rightAnkleAngle) / 2;

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    this._trackROM(ankleAngle);

    const asymmetry = Math.abs(leftAnkleAngle - rightAnkleAngle);
    if (asymmetry > t.asymmetryLimit && ankleAngle > 100) {
      feedback = { message: 'Raise evenly! Both heels up', type: 'warn' };
      this._recordIssue('Heel asymmetry');
      currentFormGood = false;
    }

    if (this.phase === 'flat' && ankleAngle > t.flatAnkleAngle + 15) {
      this.phase = 'rising';
    } else if (this.phase === 'rising' && ankleAngle >= t.peakAnkleAngle) {
      this.phase = 'peak';
      if (currentFormGood) feedback = { message: 'Full raise!', type: 'good' };
    } else if (this.phase === 'peak' && ankleAngle < t.peakAnkleAngle - 15) {
      this.phase = 'lowering';
    } else if (this.phase === 'lowering' && ankleAngle <= t.flatAnkleAngle + 5) {
      this.phase = 'flat';
      this.reps++;
      this.totalFormChecks++;
      if (currentFormGood) {
        this.goodFormChecks++;
        feedback = { message: 'Solid raise!', type: 'good' };
      }
    }

    return { feedback };
  }

  _processTricepDip(landmarks) {
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    const lElbow = getLandmark(landmarks, 'LEFT_ELBOW');
    const rElbow = getLandmark(landmarks, 'RIGHT_ELBOW');
    const lWrist = getLandmark(landmarks, 'LEFT_WRIST');
    const rWrist = getLandmark(landmarks, 'RIGHT_WRIST');
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');

    const leftElbowAngle = calculateAngle(lShoulder, lElbow, lWrist);
    const rightElbowAngle = calculateAngle(rShoulder, rElbow, rWrist);
    const elbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };

    let feedback = { message: '', type: '' };
    let currentFormGood = true;
    const t = this.config.thresholds;

    this._trackROM(elbowAngle);

    const shoulderDip = Math.abs(midShoulder.y - midHip.y);
    if (elbowAngle < 120 && shoulderDip > t.shoulderDipLimit) {
      feedback = { message: 'Keep shoulders stable! Less dip', type: 'warn' };
      this._recordIssue('Shoulder dip');
      currentFormGood = false;
    }

    if (this.phase === 'up' && elbowAngle < t.upElbowAngle - 15) {
      this.phase = 'descending';
    } else if (this.phase === 'descending' && elbowAngle <= t.bottomElbowAngle) {
      this.phase = 'bottom';
      if (currentFormGood) feedback = { message: 'Good depth!', type: 'good' };
    } else if (this.phase === 'bottom' && elbowAngle > t.bottomElbowAngle + 20) {
      this.phase = 'ascending';
    } else if (this.phase === 'ascending' && elbowAngle >= t.upElbowAngle - 5) {
      this.phase = 'up';
      this.reps++;
      this.totalFormChecks++;
      if (currentFormGood) {
        this.goodFormChecks++;
        feedback = { message: 'Great dip!', type: 'good' };
      }
    }

    return { feedback };
  }

  _processSidePlank(landmarks) {
    const lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    const rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    const lHip = getLandmark(landmarks, 'LEFT_HIP');
    const rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lAnkle = getLandmark(landmarks, 'LEFT_ANKLE');
    const rAnkle = getLandmark(landmarks, 'RIGHT_ANKLE');

    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const midAnkle = { x: (lAnkle.x + rAnkle.x) / 2, y: (lAnkle.y + rAnkle.y) / 2 };

    const bodyAngle = calculateAngle(midShoulder, midHip, midAnkle);

    let feedback = { message: '', type: '' };
    const t = this.config.thresholds;

    if (!this.plankStartTime) {
      this.plankStartTime = Date.now();
    }
    this.plankHoldTime = (Date.now() - this.plankStartTime) / 1000;

    this.totalFormChecks++;
    if (Math.abs(bodyAngle - 180) > t.alignmentTolerance) {
      feedback = { message: 'Stay straight! Hips up', type: 'warn' };
      this._recordIssue('Side plank sag');
    } else {
      this.goodFormChecks++;
      const now = Date.now();
      if (now - this.lastPlankFeedbackTime > t.holdInterval * 1000) {
        feedback = { message: `Perfect form! ${Math.floor(this.plankHoldTime)}s`, type: 'good' };
        this.lastPlankFeedbackTime = now;
      }
    }

    this.reps = Math.floor(this.plankHoldTime);
    return { feedback };
  }

  _processBicycleCrunch(landmarks) {
    // eslint-disable-next-line no-unused-vars -- required for visibility check
    const _lShoulder = getLandmark(landmarks, 'LEFT_SHOULDER');
    // eslint-disable-next-line no-unused-vars
    const _rShoulder = getLandmark(landmarks, 'RIGHT_SHOULDER');
    // eslint-disable-next-line no-unused-vars
    const _lHip = getLandmark(landmarks, 'LEFT_HIP');
    // eslint-disable-next-line no-unused-vars
    const _rHip = getLandmark(landmarks, 'RIGHT_HIP');
    const lKnee = getLandmark(landmarks, 'LEFT_KNEE');
    const rKnee = getLandmark(landmarks, 'RIGHT_KNEE');
    const lElbow = getLandmark(landmarks, 'LEFT_ELBOW');
    const rElbow = getLandmark(landmarks, 'RIGHT_ELBOW');

    // Distance from right elbow to left knee (and vice versa for twisting)
    const rightElbowToLeftKnee = Math.sqrt(Math.pow(rElbow.x - lKnee.x, 2) + Math.pow(rElbow.y - lKnee.y, 2));
    const leftElbowToRightKnee = Math.sqrt(Math.pow(lElbow.x - rKnee.x, 2) + Math.pow(lElbow.y - rKnee.y, 2));
    const crunchDistance = Math.min(rightElbowToLeftKnee, leftElbowToRightKnee);

    let feedback = { message: '', type: '' };
    const currentFormGood = true;
    const t = this.config.thresholds;

    this._trackROM(crunchDistance);

    if (this.phase === 'center' && crunchDistance < t.centerDistance - 0.05) {
      this.phase = 'twisting';
    } else if (this.phase === 'twisting' && crunchDistance <= t.peakDistance) {
      this.phase = 'peak';
      if (currentFormGood) this.reps++;
    } else if (this.phase === 'peak' && crunchDistance > t.peakDistance + 0.08) {
      this.phase = 'returning';
    } else if (this.phase === 'returning' && crunchDistance >= t.centerDistance) {
      this.phase = 'center';
      this.totalFormChecks++;
      if (currentFormGood) this.goodFormChecks++;
      feedback = { message: 'Good crunch!', type: 'good' };
    }

    return { feedback };
  }

  // ROM TRACKING (Rehab Feature)

  _trackROM(angle) {
    this.romHistory.push({ angle: Math.round(angle * 10) / 10, timestamp: Date.now() });
    if (angle > this.peakROM) this.peakROM = angle;
    if (angle < this.minROM) this.minROM = angle;
  }

  getROMSummary() {
    if (this.romHistory.length === 0) return null;
    const angles = this.romHistory.map(r => r.angle);
    return {
      peak: Math.round(this.peakROM),
      min: Math.round(this.minROM),
      range: Math.round(this.peakROM - this.minROM),
      avg: Math.round(angles.reduce((a, b) => a + b, 0) / angles.length),
      samples: this.romHistory.length
    };
  }

  // MILESTONE DETECTION

  _checkMilestones() {
    if (this.type === 'plank') return null; // Plank uses time-based milestones

    const reps = this.reps;
    if (reps === this._prevReps) return null; // No new rep
    this._prevReps = reps;

    let milestone = null;

    // Round number milestones
    if (reps === 5 && this._lastMilestoneRep < 5) {
      milestone = { type: 'count', message: '5 reps! Keep going!' };
    } else if (reps === 10 && this._lastMilestoneRep < 10) {
      milestone = { type: 'count', message: '10 reps! Solid set!' };
    } else if (reps === 15 && this._lastMilestoneRep < 15) {
      milestone = { type: 'count', message: '15 reps! Beast mode!' };
    } else if (reps === 20 && this._lastMilestoneRep < 20) {
      milestone = { type: 'count', message: '20 reps! Incredible!' };
    } else if (reps === 25 && this._lastMilestoneRep < 25) {
      milestone = { type: 'count', message: '25 reps! Are you even tired?' };
    } else if (reps > 25 && reps % 10 === 0 && this._lastMilestoneRep < reps) {
      milestone = { type: 'count', message: `${reps} reps! Unstoppable!` };
    }

    // Perfect form streak
    if (this.goodFormChecks === this.totalFormChecks && this.totalFormChecks >= 5 && reps === 5) {
      milestone = { type: 'form', message: 'Perfect form! 5 for 5!' };
    }

    if (milestone) {
      milestone.rep = reps;
      this.milestones.push(milestone);
      this._lastMilestoneRep = reps;
    }

    return milestone;
  }

  _recordIssue(issueName) {
    this.formIssues[issueName] = (this.formIssues[issueName] || 0) + 1;
  }

  getFormScore() {
    if (this.totalFormChecks === 0) return 100;
    return Math.round((this.goodFormChecks / this.totalFormChecks) * 100);
  }

  getSummary() {
    return {
      exercise: this.config.name,
      exerciseType: this.type,
      reps: this.reps,
      formScore: this.getFormScore(),
      formIssues: { ...this.formIssues },
      plankHoldTime: this.type === 'plank' ? Math.floor(this.plankHoldTime) : null,
      rom: this.getROMSummary(),
      milestones: [...this.milestones]
    };
  }
}

// Export for testing (Node.js) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateAngle, getLandmark, landmarksVisible, ExerciseTracker, EXERCISES, LANDMARKS };
}
