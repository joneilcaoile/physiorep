// Main application — audio coaching, countdown, pause, routines, settings, progress tracking

// State
let currentTracker = null;
let lastExercise = 'squat';
let workoutStartTime = null;
let timerInterval = null;
let camera = null;
let pose = null;
let isWorkoutActive = false;
let isPaused = false;
let feedbackTimeout = null;
let lastRepCount = 0;

// FPS tracking
let fpsFrameCount = 0;
let fpsLastTime = performance.now();
let currentFPS = 0;

// Routine state
let routineQueue = [];
let routineActive = false;
let restInterval = null;

// Settings (defaults)
let appSettings = {
  voice: true,
  repCount: true,
  milestones: true,
  camera: 'environment',
  skeleton: true,
  fps: false,
  countdown: 3,
  restTime: 60,
  onboarded: false,
  notifications: false,
  reminderTime: '09:00',
  detailLevel: 'standard' // 'simple' | 'standard' | 'nerd'
};

// SECURITY: HTML Sanitizer
function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

function safeHTML(templateParts, ...values) {
  return templateParts.reduce((result, part, i) => {
    const val = i < values.length ? sanitizeHTML(String(values[i])) : '';
    return result + part + val;
  }, '');
}

// INITIALIZATION

window.addEventListener('load', async () => {
  loadSettings();

  try {
    await physioRepDB.init();
  } catch (err) {
    console.error('DB init failed:', err);
    showError('Storage unavailable. Workouts won\'t be saved. Try a regular browser window.');
  }

  // Show onboarding or home
  if (!appSettings.onboarded) {
    showScreen('onboarding');
  } else {
    showScreen('home');
  }

  document.getElementById('loadingOverlay').classList.add('hidden');
  setTimeout(loadHomeRoutines, 100);
  setTimeout(() => { checkAchievements(); renderBadgesOnHome(); }, 200);
  setTimeout(renderSmartSuggestion, 300);
  setTimeout(renderHomeChallenges, 400);
  scheduleReminder();
});

// SCREEN MANAGEMENT

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');

  if (screenId === 'home') { renderBadgesOnHome(); renderSmartSuggestion(); renderHomeChallenges(); renderActiveProgramBanner(); }
  if (screenId === 'challenges') { renderChallenges(); renderLeaderboard(); }
  if (screenId === 'history') renderHistory();
  if (screenId === 'settings') loadSettingsUI();
  if (screenId === 'ptDashboard') renderPTDashboard();
  if (screenId === 'routineBuilder') { routineBuilderQueue = []; renderRoutineBuilderQueue(); loadSavedRoutines(); }
  if (screenId === 'programs') renderPrograms();
  if (screenId === 'hiitScreen') renderHIITLibrary();
  if (screenId === 'analyticsScreen') renderAnalytics();
  if (screenId === 'recoveryScreen') renderMobilityRoutines();
  if (screenId !== 'workout' && camera) stopCamera();
}

// ONBOARDING

let onboardStep = 0;

function advanceOnboarding() {
  onboardStep++;
  if (onboardStep >= 5) {
    appSettings.onboarded = true;
    saveSettings();
    showScreen('home');
    return;
  }

  document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.onboard-dots .dot').forEach(d => d.classList.remove('active'));

  const step = document.querySelector(`.onboard-step[data-step="${onboardStep}"]`);
  const dot = document.querySelector(`.dot[data-dot="${onboardStep}"]`);
  if (step) step.classList.add('active');
  if (dot) dot.classList.add('active');

  // Change button text on last step
  if (onboardStep === 4) {
    document.querySelector('#onboarding .btn-primary').textContent = 'Get Started';
  }
}

// CAMERA

async function initCamera() {
  const video = document.getElementById('videoEl');
  const facingMode = appSettings.camera || 'environment';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    try {
      video.srcObject = stream;

      // Add timeout on video.play() (10 second timeout)
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        await Promise.race([
          playPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('play() timeout')), 10000))
        ]);
      }

      return video;
    } catch (playErr) {
      // Stream obtained but play failed; clean up stream
      stream.getTracks().forEach(track => track.stop());
      throw playErr;
    }
  } catch (_err) {
    // Fall back to other camera
    try {
      const fallback = facingMode === 'environment' ? 'user' : 'environment';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: fallback, width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      try {
        video.srcObject = stream;

        // Add timeout on video.play() (10 second timeout)
        const playPromise = video.play();
        if (playPromise && typeof playPromise.then === 'function') {
          await Promise.race([
            playPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('play() timeout')), 10000))
          ]);
        }

        return video;
      } catch (playErr) {
        // Stream obtained but play failed; clean up stream
        stream.getTracks().forEach(track => track.stop());
        throw playErr;
      }
    } catch (_err2) {
      showError('Camera access denied. PhysioRep needs your camera to track form. Check browser permissions.');
      showScreen('home');
      return null;
    }
  }
}

function stopCamera() {
  const video = document.getElementById('videoEl');
  if (video && video.srcObject) {
    // Stop ALL tracks on the stream (bulletproof)
    const tracks = video.srcObject.getTracks();
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].stop();
    }
    video.srcObject = null;
  }
}

// MEDIAPIPE POSE

async function initPose() {
  if (pose) return pose;

  pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  pose.onResults(onPoseResults);
  return pose;
}

function onPoseResults(results) {
  if (!isWorkoutActive || isPaused) return;

  // Validate landmarks before processing (security fix)
  if (!results.poseLandmarks || !Array.isArray(results.poseLandmarks) || results.poseLandmarks.length !== 33) return;
  for (const lm of results.poseLandmarks) {
    if (typeof lm.x !== 'number' || typeof lm.y !== 'number' || isNaN(lm.x) || isNaN(lm.y)) return;
  }


  // FPS tracking
  fpsFrameCount++;
  const now = performance.now();
  if (now - fpsLastTime >= 1000) {
    currentFPS = fpsFrameCount;
    fpsFrameCount = 0;
    fpsLastTime = now;
    if (appSettings.fps) {
      document.getElementById('fpsDisplay').textContent = `${currentFPS} FPS`;
    }
  }

  const canvas = document.getElementById('canvasEl');
  const ctx = canvas.getContext('2d');
  const video = document.getElementById('videoEl');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    // Draw skeleton (if enabled)
    if (appSettings.skeleton) {
      drawSkeleton(ctx, results.poseLandmarks, canvas.width, canvas.height);
    }

    document.getElementById('cameraGuide').classList.add('hidden');
    showFirstUseTip(); // Shows once ever, explains the green skeleton

    // Process through exercise engine
    const feedback = currentTracker.processFrame(results.poseLandmarks);

    // Render Form Correction HUD overlay
    if (typeof formHUD !== 'undefined') {
      try {
        formHUD.render(ctx, results.poseLandmarks, canvas.width, canvas.height, feedback, lastExercise);
      } catch (_e) { /* ignore HUD errors */ }
    }

    // Track tempo for phase changes
    if (typeof tempoTracker !== 'undefined' && currentTracker.phase) {
      try {
        tempoTracker.onPhaseChange(currentTracker.phase, performance.now());
      } catch (e) { /* ignore tempo errors */ }
    }

    // Update rep count
    updateRepCount(feedback.reps);

    // Handle rep audio
    if (feedback.reps > lastRepCount) {
      audioEngine.announceRep(feedback.reps);
      lastRepCount = feedback.reps;
    }

    // Handle form feedback — Voice Coach takes over audio cues for richer coaching
    if (feedback.feedback.message) {
      showFeedback(feedback.feedback.message, feedback.feedback.type);
      // Voice Coach handles form audio if available, otherwise fall back to basic audio
      if (typeof voiceCoach !== 'undefined' && voiceCoach.enabled) {
        try {
          voiceCoach.onRep({
            exerciseType: lastExercise,
            reps: feedback.reps,
            formScore: feedback.formScore,
            feedback: feedback.feedback,
            issues: currentTracker.formIssues
          }, audioEngine);
        } catch (e) { console.warn('VoiceCoach error:', e); }
      } else if (feedback.feedback.type === 'bad' || feedback.feedback.type === 'warn') {
        audioEngine.announceFormFeedback(feedback.feedback.message, feedback.feedback.type);
      }
    }

    // Handle milestones
    if (feedback.milestone) {
      showFeedback(feedback.milestone.message, 'milestone');
      audioEngine.announceMilestone(feedback.milestone.message);
      audioEngine.playSuccessChime();
    }

    // Voice Coach plank updates
    if (lastExercise === 'plank' && typeof voiceCoach !== 'undefined' && voiceCoach.enabled) {
      try {
        voiceCoach.onPlankUpdate({
          holdTime: feedback.plankHoldTime || 0,
          formScore: feedback.formScore,
          feedback: feedback.feedback
        }, audioEngine);
      } catch (e) { console.warn('VoiceCoach plank error:', e); }
    }

    // Low FPS warning
    if (currentFPS > 0 && currentFPS < 10 && fpsFrameCount === 0) {
      showFeedback('Low frame rate — try better lighting', 'warn');
    }

    // === Vitals processing (experimental) ===
    if (typeof vitalsMonitor !== 'undefined' && vitalsMonitor.enabled) {
      vitalsMonitor.processFrame(canvas, video, results.poseLandmarks);
      updateVitalsHUD();
    }
  } else {
    document.getElementById('cameraGuide').classList.remove('hidden');
  }
}

// SKELETON DRAWING

const POSE_CONNECTIONS = [
  [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28]
];

function drawSkeleton(ctx, landmarks, width, height) {
  ctx.strokeStyle = '#00e676';
  ctx.lineWidth = 3;

  POSE_CONNECTIONS.forEach(([i, j]) => {
    const a = landmarks[i];
    const b = landmarks[j];
    if (a && b && (a.visibility || 0) > 0.3 && (b.visibility || 0) > 0.3) {
      ctx.beginPath();
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
      ctx.stroke();
    }
  });

  const keyJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  keyJoints.forEach(i => {
    const lm = landmarks[i];
    if (lm && (lm.visibility || 0) > 0.3) {
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#00e676';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

// COUNTDOWN

async function runCountdown() {
  const seconds = parseInt(appSettings.countdown) || 3;
  if (seconds === 0) return;

  const overlay = document.getElementById('countdownOverlay');
  const numEl = document.getElementById('countdownNumber');
  const labelEl = document.getElementById('countdownLabel');

  overlay.classList.add('active');
  labelEl.textContent = 'Get in position...';

  // Init audio on user gesture (countdown is triggered by click)
  audioEngine.init();

  for (let i = seconds; i >= 1; i--) {
    numEl.textContent = i;
    numEl.style.animation = 'none';
    void numEl.offsetHeight; // Reflow
    numEl.style.animation = 'countPulse 1s ease-in-out';

    if (audioEngine.enabled && audioEngine.audioCtx) {
      const osc = audioEngine.audioCtx.createOscillator();
      const gain = audioEngine.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioEngine.audioCtx.destination);
      osc.frequency.value = 440;
      gain.gain.value = 0.2;
      gain.gain.exponentialRampToValueAtTime(0.001, audioEngine.audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioEngine.audioCtx.currentTime + 0.15);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  numEl.textContent = 'GO!';
  numEl.style.color = '#00e676';
  audioEngine.speak('Go!', 'high');

  await new Promise(r => setTimeout(r, 600));

  numEl.style.color = '';
  overlay.classList.remove('active');
}

// WORKOUT FLOW

async function startWorkout(exerciseType) {
  lastExercise = exerciseType;
  currentTracker = new ExerciseTracker(exerciseType);
  lastRepCount = 0;
  isPaused = false;

  // Reset vitals for new session
  if (typeof vitalsMonitor !== 'undefined') vitalsMonitor.reset();

  // Reset form HUD for new session
  if (typeof formHUD !== 'undefined') {
    try { formHUD.reset(); } catch (_e) { /* ignore */ }
  }

  // Update HUD
  const names = {
    squat: 'Squats', pushup: 'Push-Ups', plank: 'Plank',
    lunge: 'Lunges', shoulderpress: 'Shoulder Press', deadlift: 'Deadlift'
  };
  document.getElementById('exerciseName').textContent = names[exerciseType] || exerciseType;
  document.getElementById('repCount').textContent = '0';
  document.getElementById('repLabel').textContent = exerciseType === 'plank' ? 'sec' : 'reps';
  document.getElementById('timerDisplay').textContent = '00:00';
  document.getElementById('fpsDisplay').textContent = '';
  document.getElementById('cameraGuide').classList.remove('hidden');
  document.getElementById('pauseBtn').textContent = '⏸';
  document.getElementById('audioBtn').textContent = audioEngine.enabled ? '🔊' : '🔇';

  showScreen('workout');

  const video = await initCamera();
  if (!video) return;

  // PT Mode: Pre-workout pain prompt
  if (activePTProgram) {
    await new Promise((resolve) => {
      showPainModal('pre-workout', async () => {
        // Run countdown AFTER camera is live so user can see themselves
        await runCountdown();
        isWorkoutActive = true;
        resolve();
      });
    });
  } else {
    // Run countdown AFTER camera is live so user can see themselves
    await runCountdown();
    isWorkoutActive = true;
  }

  await initPose();

  if (typeof Camera !== 'undefined') {
    camera = new Camera(video, {
      onFrame: async () => {
        if (pose && isWorkoutActive && !isPaused) {
          await pose.send({ image: video });
        }
      },
      width: 1280,
      height: 720
    });
    camera.start();
  } else {
    runFrameLoop(video);
  }

  workoutStartTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
}

function runFrameLoop(video) {
  if (!isWorkoutActive) return;
  if (isPaused) {
    requestAnimationFrame(() => runFrameLoop(video));
    return;
  }
  if (pose && video.readyState >= 2) {
    pose.send({ image: video }).then(() => {
      requestAnimationFrame(() => runFrameLoop(video));
    });
  } else {
    requestAnimationFrame(() => runFrameLoop(video));
  }
}

function togglePause() {
  isPaused = !isPaused;
  const btn = document.getElementById('pauseBtn');
  btn.textContent = isPaused ? '▶' : '⏸';

  if (isPaused) {
    showFeedback('Paused', 'warn');
    audioEngine.speak('Paused', 'high');
  } else {
    showFeedback('', '');
    audioEngine.speak('Resume', 'high');
  }
}

function toggleAudio() {
  const enabled = audioEngine.toggle();
  document.getElementById('audioBtn').textContent = enabled ? '🔊' : '🔇';
}

async function stopWorkout() {
  isWorkoutActive = false;
  isPaused = false;

  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (camera) { camera.stop(); camera = null; }
  stopCamera();

  const summary = currentTracker.getSummary();
  const duration = Math.floor((Date.now() - workoutStartTime) / 1000);

  // Play completion chime
  audioEngine.playSuccessChime();
  audioEngine.speak('Workout complete!', 'high');

  // Collect vitals summary
  let vitalsSummary = null;
  if (typeof vitalsMonitor !== 'undefined') {
    vitalsSummary = vitalsMonitor.getSummary();
  }

  // Save to database
  try {
    await physioRepDB.saveWorkout({
      exercise: summary.exercise,
      exerciseType: summary.exerciseType,
      reps: summary.reps,
      duration,
      formScore: summary.formScore,
      formIssues: summary.formIssues,
      plankHoldTime: summary.plankHoldTime,
      rom: summary.rom,
      milestones: summary.milestones,
      vitals: vitalsSummary
    });
  } catch (err) {
    console.error('Failed to save workout:', err);
  }

  // Complete program day if active
  if (typeof programEngine !== 'undefined' && programEngine.getActiveProgram()) {
    try {
      programEngine.completeDay();
    } catch (e) {
      console.warn('Program day completion failed:', e);
    }
  }

  // Check for personal bests via Voice Coach
  let prResult = null;
  if (typeof voiceCoach !== 'undefined') {
    try {
      prResult = voiceCoach.onWorkoutEnd(summary, audioEngine);
      voiceCoach.reset();
    } catch (e) { console.warn('VoiceCoach end error:', e); }
  }

  // Check for new achievements
  await checkAchievements();

  // Award XP
  let xpResult = null;
  if (typeof xpEngine !== 'undefined') {
    try {
      xpResult = xpEngine.awardXP({
        exerciseType: summary.exerciseType,
        reps: summary.reps,
        duration,
        formScore: summary.formScore,
        isProgramWorkout: typeof programEngine !== 'undefined' && programEngine.getActiveProgram()
      });
    } catch (e) { console.warn('XP award failed:', e); }
  }

  // Get tempo summary
  let tempoSummary = null;
  if (typeof tempoTracker !== 'undefined') {
    try {
      tempoSummary = tempoTracker.getSummary();
      tempoTracker.reset();
    } catch (e) { /* ignore */ }
  }

  // Record session for adaptive engine
  if (typeof adaptiveEngine !== 'undefined') {
    try {
      adaptiveEngine.recordSession({
        exerciseType: summary.exerciseType,
        reps: summary.reps,
        duration,
        formScore: summary.formScore,
        difficulty: adaptiveEngine.currentDifficulty || 'normal'
      });
    } catch (_e) { /* ignore */ }
  }

  // Log vitals to health sync
  if (typeof healthSync !== 'undefined' && vitalsSummary) {
    try {
      healthSync.logInAppVitals(vitalsSummary);
    } catch (_e) { /* ignore */ }
  }

  // Update challenge progress
  if (typeof challengeEngine !== 'undefined') {
    challengeEngine.updateProgress({
      exerciseType: summary.exerciseType,
      reps: summary.reps,
      formScore: summary.formScore,
      duration,
      plankHoldTime: summary.plankHoldTime,
      date: new Date().toISOString()
    });
  }

  // If in a routine, go to rest or next exercise
  if (routineActive && routineQueue.length > 0) {
    showRestTimer(routineQueue[0]);
    return;
  }
  routineActive = false;

  showSummary(summary, duration, vitalsSummary, xpResult, tempoSummary);
}

// ROUTINE SYSTEM

function startRoutine() {
  audioEngine.init();
  routineQueue = ['squat', 'pushup', 'lunge', 'plank'];
  routineActive = true;
  const first = routineQueue.shift();
  startWorkout(first);
}

function showRestTimer(nextExercise) {
  const names = {
    squat: 'Squats', pushup: 'Push-Ups', plank: 'Plank',
    lunge: 'Lunges', shoulderpress: 'Shoulder Press', deadlift: 'Deadlift'
  };

  const overlay = document.getElementById('restOverlay');
  const timeEl = document.getElementById('restTime');
  const nextEl = document.getElementById('restNextExercise');

  nextEl.textContent = names[nextExercise] || nextExercise;
  // Smart rest recommendation if available
  let remaining;
  if (typeof smartRestTimer !== 'undefined' && currentTracker) {
    try {
      const recommendation = smartRestTimer.recommend({
        exerciseType: lastExercise,
        reps: currentTracker.reps,
        formScore: currentTracker.getFormScore(),
        setNumber: smartRestTimer.currentSet
      });
      remaining = recommendation.seconds;
    } catch (e) {
      remaining = parseInt(appSettings.restTime) || 60;
    }
  } else {
    remaining = parseInt(appSettings.restTime) || 60;
  }
  timeEl.textContent = remaining;

  overlay.classList.add('active');

  audioEngine.speak(`Rest. ${names[nextExercise]} is next.`, 'normal');

  restInterval = setInterval(() => {
    remaining--;
    timeEl.textContent = remaining;

    if (remaining === 5) audioEngine.speak('5 seconds', 'normal');

    if (remaining <= 0) {
      clearInterval(restInterval);
      overlay.classList.remove('active');
      const next = routineQueue.shift();
      if (next) {
        startWorkout(next);
      } else {
        routineActive = false;
        showScreen('home');
      }
    }
  }, 1000);
}

function skipRest() {
  if (restInterval) clearInterval(restInterval);
  document.getElementById('restOverlay').classList.remove('active');
  const next = routineQueue.shift();
  if (next) {
    startWorkout(next);
  } else {
    routineActive = false;
    showScreen('home');
  }
}

// UI UPDATES

function updateRepCount(reps) {
  document.getElementById('repCount').textContent = reps;
}

function updateTimer() {
  if (!workoutStartTime || isPaused) return;
  const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${mins}:${secs}`;
}

function showFeedback(message, type) {
  const el = document.getElementById('formFeedback');
  el.textContent = message;
  el.className = 'form-feedback ' + type;

  if (feedbackTimeout) clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(() => {
    el.className = 'form-feedback';
  }, type === 'milestone' ? 3000 : 2000);
}

function showError(message) {
  const toast = document.getElementById('errorToast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 5000);
}

// SUMMARY

function showSummary(summary, duration, vitalsSummary, xpResult, tempoSummary) {
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  document.getElementById('sumExercise').textContent = summary.exercise;
  document.getElementById('sumDuration').textContent = durationStr;

  // Subtitle with date
  const now = new Date();
  document.getElementById('sumSubtitle').textContent =
    now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) +
    ' at ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Reps
  const repsEl = document.getElementById('sumReps');
  if (summary.exerciseType === 'plank') {
    repsEl.textContent = `${summary.plankHoldTime || summary.reps}s hold`;
  } else {
    repsEl.textContent = summary.reps;
  }

  // Form score with color
  const scoreEl = document.getElementById('sumScore');
  const level = appSettings.detailLevel || 'standard';
  if (level === 'simple') {
    // Simple mode: no percentage, just a word
    if (summary.formScore >= 90) scoreEl.textContent = 'Great!';
    else if (summary.formScore >= 70) scoreEl.textContent = 'Good';
    else if (summary.formScore >= 50) scoreEl.textContent = 'Fair';
    else scoreEl.textContent = 'Needs work';
  } else {
    scoreEl.textContent = `${summary.formScore}%`;
  }
  scoreEl.className = 'stat-value';
  if (summary.formScore >= 80) scoreEl.classList.add('good');
  else if (summary.formScore >= 50) scoreEl.classList.add('ok');
  else scoreEl.classList.add('bad');

  // Form verdict — plain English explanation everyone can understand
  const verdictEl = document.getElementById('formVerdict');
  if (verdictEl) {
    verdictEl.className = '';
    if (summary.formScore >= 90) {
      verdictEl.textContent = 'Excellent form! You nailed the technique. Keep it up.';
      verdictEl.classList.add('verdict-great');
    } else if (summary.formScore >= 70) {
      verdictEl.textContent = 'Good work! A few small things to tighten up, but solid overall.';
      verdictEl.classList.add('verdict-good');
    } else if (summary.formScore >= 50) {
      verdictEl.textContent = 'Getting there. Focus on the tips below — fixing one thing at a time makes a big difference.';
      verdictEl.classList.add('verdict-ok');
    } else {
      verdictEl.textContent = 'Your body position needs attention. Try slowing down and focus on the movement, not the reps.';
      verdictEl.classList.add('verdict-poor');
    }
  }

  // Form issues — with plain English translations
  const ISSUE_TRANSLATIONS = {
    'Knee valgus (knees caving)': { simple: 'Knees are falling inward', fix: 'Push your knees outward over your toes' },
    'Excessive forward lean': { simple: 'Leaning too far forward', fix: 'Keep your chest up and look ahead' },
    'Insufficient depth': { simple: 'Not going low enough', fix: 'Try to go a bit deeper on each rep' },
    'Hip sag': { simple: 'Hips are dropping down', fix: 'Squeeze your core to keep your body straight' },
    'Hip pike': { simple: 'Hips are too high up', fix: 'Lower your hips until your body is a straight line' },
    'Elbow flare': { simple: 'Elbows sticking out too wide', fix: 'Tuck elbows closer to your sides, at a 45° angle' },
    'Knee past toes': { simple: 'Knee going too far forward', fix: 'Take a wider stance or step further forward' },
    'Torso lean': { simple: 'Upper body is tilting', fix: 'Brace your core and look straight ahead' },
    'Arm asymmetry': { simple: 'One arm is moving differently', fix: 'Focus on pushing both arms evenly' },
    'Rounded back': { simple: 'Back is rounding over', fix: 'Keep your chest proud and squeeze your shoulder blades' },
    'Hip drop': { simple: 'Hips are tilting to one side', fix: 'Engage your core and squeeze your glutes' },
    'Incomplete lockout': { simple: 'Not extending fully at the top', fix: 'Push through the full range — pause at the top' }
  };

  const issuesContainer = document.getElementById('formIssues');
  const issuesList = document.getElementById('issuesList');
  const issues = Object.entries(summary.formIssues);

  if (issues.length === 0) {
    issuesContainer.style.display = 'none';
  } else {
    issuesContainer.style.display = 'block';
    const sortedIssues = issues.sort((a, b) => b[1] - a[1]);

    if (level === 'simple') {
      // Simple: just the plain-English fix, no technical names
      issuesList.innerHTML = sortedIssues.slice(0, 3).map(([name]) => {
        const t = ISSUE_TRANSLATIONS[name];
        return safeHTML`<div style="padding:8px 0; border-bottom:1px solid var(--surface2); font-size:14px;">
          <strong>${t ? t.simple : name}</strong>
          ${t ? `<p style="color:var(--text-dim); font-size:13px; margin-top:2px;">${t.fix}</p>` : ''}
        </div>`;
      }).join('');
    } else {
      // Standard + Nerd: technical name + translation
      issuesList.innerHTML = sortedIssues.map(([name, count]) => {
        const t = ISSUE_TRANSLATIONS[name];
        return safeHTML`<div style="padding:8px 0; border-bottom:1px solid var(--surface2);">
          <span class="issue-tag">${name} (${count}x)</span>
          ${t ? `<p style="color:var(--text-dim); font-size:12px; margin-top:4px;">→ ${t.simple}. ${t.fix}</p>` : ''}
        </div>`;
      }).join('');
    }
  }

  // ROM card — hide in simple mode (users don't know what ROM is)
  const romCard = document.getElementById('romCard');
  if (summary.rom && summary.rom.samples > 10 && level !== 'simple') {
    romCard.style.display = 'block';
    document.getElementById('romMin').textContent = `${summary.rom.min}°`;
    document.getElementById('romMax').textContent = `${summary.rom.peak}°`;
    document.getElementById('romRange').textContent = `${summary.rom.range}°`;
    document.getElementById('romBarFill').style.width = `${(summary.rom.range / 180) * 100}%`;
  } else {
    romCard.style.display = 'none';
  }

  // Improvement tips
  generateTips(summary);

  // PT Mode integration in summary
  const ptSummaryArea = document.getElementById('ptSummaryArea');
  if (ptSummaryArea) {
    if (activePTProgram) {
      let ptHTML = '';
      if (summary.formScore < 60) {
        const mods = getModifications(summary.exerciseType, 'too-hard');
        if (mods.length > 0) {
          ptHTML += '<div class="summary-card" style="border:1px solid #7c4dff; margin-top:0;"><h4 style="color:#b388ff; font-size:14px; margin-bottom:8px;">Suggested Modifications</h4>';
          mods.slice(0, 2).forEach(m => {
            ptHTML += `<div style="padding:8px 0; border-bottom:1px solid var(--surface2);"><strong style="font-size:13px;">${m.name}</strong><p style="font-size:12px; color:var(--text-dim); margin-top:2px;">${m.desc}</p></div>`;
          });
          ptHTML += '</div>';
        }
      }
      ptHTML += '<button class="btn-secondary" style="border-color:#7c4dff; color:#b388ff; margin-bottom:8px;" onclick="showScreen(\'ptDashboard\')">View PT Dashboard</button>';
      ptSummaryArea.innerHTML = ptHTML;
    } else {
      ptSummaryArea.innerHTML = '';
    }
  }

  // Vitals summary card
  const vitalsCard = document.getElementById('vitalsCard');
  if (vitalsCard) {
    if (vitalsSummary && (vitalsSummary.heartRate.count > 0 || vitalsSummary.breathingRate.count > 0)) {
      let html = '<div class="summary-card" style="border:1px solid #ff5252; margin-top:0;">';
      html += '<h4 style="color:#ff8a80; font-size:14px; margin-bottom:8px;">Vitals <span style="font-size:11px; color:var(--text-dim); font-weight:400;">(experimental)</span></h4>';
      if (vitalsSummary.heartRate.count > 3) {
        html += `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">
          <span style="color:var(--text-dim);">Avg Heart Rate</span>
          <span style="color:#ff5252; font-weight:600;">${vitalsSummary.heartRate.avg} BPM</span>
        </div>`;
        html += `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">
          <span style="color:var(--text-dim);">Peak Heart Rate</span>
          <span style="color:#ff5252; font-weight:600;">${vitalsSummary.heartRate.max} BPM</span>
        </div>`;
      }
      if (vitalsSummary.breathingRate.count > 3) {
        html += `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">
          <span style="color:var(--text-dim);">Avg Breathing Rate</span>
          <span style="color:#69f0ae; font-weight:600;">${vitalsSummary.breathingRate.avg} br/min</span>
        </div>`;
      }
      html += '</div>';
      vitalsCard.innerHTML = html;
    } else {
      vitalsCard.innerHTML = '';
    }
  }

  // === Details for Nerds section ===
  const nerdSection = document.getElementById('nerdSection');
  if (nerdSection) {
    if (level === 'nerd') {
      nerdSection.style.display = 'block';
      // Auto-expand for nerds
      const nerdContentEl = document.getElementById('nerdContent');
      nerdContentEl.style.display = 'block';
      document.getElementById('nerdArrow').textContent = '▲';

      let nerdHTML = '';

      // Raw exercise data
      nerdHTML += '<div style="margin-bottom:12px; font-weight:700; color:var(--text); font-family:var(--font);">Exercise Engine Data</div>';
      nerdHTML += `<div class="nerd-row"><span class="nerd-label">exercise_type</span><span class="nerd-value">${summary.exerciseType}</span></div>`;
      nerdHTML += `<div class="nerd-row"><span class="nerd-label">total_reps</span><span class="nerd-value">${summary.reps}</span></div>`;
      nerdHTML += `<div class="nerd-row"><span class="nerd-label">form_score</span><span class="nerd-value">${summary.formScore}%</span></div>`;
      nerdHTML += `<div class="nerd-row"><span class="nerd-label">duration_sec</span><span class="nerd-value">${duration}</span></div>`;
      nerdHTML += `<div class="nerd-row"><span class="nerd-label">fps_avg</span><span class="nerd-value">${currentFPS || '—'}</span></div>`;

      if (summary.exerciseType === 'plank') {
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">plank_hold_sec</span><span class="nerd-value">${summary.plankHoldTime || '—'}</span></div>`;
      }

      // ROM data
      if (summary.rom && summary.rom.samples > 0) {
        nerdHTML += '<div style="margin:12px 0 8px; font-weight:700; color:var(--text); font-family:var(--font);">Range of Motion</div>';
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">rom_min</span><span class="nerd-value">${summary.rom.min}°</span></div>`;
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">rom_peak</span><span class="nerd-value">${summary.rom.peak}°</span></div>`;
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">rom_range</span><span class="nerd-value">${summary.rom.range}°</span></div>`;
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">rom_samples</span><span class="nerd-value">${summary.rom.samples}</span></div>`;
      }

      // Form issues raw
      if (issues.length > 0) {
        nerdHTML += '<div style="margin:12px 0 8px; font-weight:700; color:var(--text); font-family:var(--font);">Form Issues (raw)</div>';
        issues.forEach(([name, count]) => {
          nerdHTML += `<div class="nerd-row"><span class="nerd-label">${name}</span><span class="nerd-value">${count}x</span></div>`;
        });
      }

      // Milestones
      if (summary.milestones && summary.milestones.length > 0) {
        nerdHTML += '<div style="margin:12px 0 8px; font-weight:700; color:var(--text); font-family:var(--font);">Milestones Hit</div>';
        summary.milestones.forEach(m => {
          nerdHTML += `<div class="nerd-row"><span class="nerd-label">${m.message}</span><span class="nerd-value">@rep ${m.rep}</span></div>`;
        });
      }

      // Vitals raw data
      if (vitalsSummary) {
        nerdHTML += '<div style="margin:12px 0 8px; font-weight:700; color:var(--text); font-family:var(--font);">Vitals (rPPG experimental)</div>';
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">hr_avg</span><span class="nerd-value">${vitalsSummary.heartRate.avg || '—'} BPM</span></div>`;
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">hr_min</span><span class="nerd-value">${vitalsSummary.heartRate.min || '—'}</span></div>`;
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">hr_max</span><span class="nerd-value">${vitalsSummary.heartRate.max || '—'}</span></div>`;
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">hr_samples</span><span class="nerd-value">${vitalsSummary.heartRate.count}</span></div>`;
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">br_avg</span><span class="nerd-value">${vitalsSummary.breathingRate.avg || '—'} br/min</span></div>`;
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">br_samples</span><span class="nerd-value">${vitalsSummary.breathingRate.count}</span></div>`;

        if (typeof vitalsMonitor !== 'undefined') {
          const diag = vitalsMonitor.getDiagnostics();
          nerdHTML += `<div class="nerd-row"><span class="nerd-label">vitals_process_time</span><span class="nerd-value">${diag.lastProcessTime}</span></div>`;
          nerdHTML += `<div class="nerd-row"><span class="nerd-label">green_buffer_size</span><span class="nerd-value">${diag.greenChannelBufferSize}</span></div>`;
        }
      }

      nerdContentEl.innerHTML = nerdHTML;
    } else if (level === 'standard') {
      // Standard: show toggle but collapsed
      nerdSection.style.display = 'block';
      document.getElementById('nerdContent').style.display = 'none';
      document.getElementById('nerdArrow').textContent = '▼';
      // Populate anyway so it's ready if they click
      const nerdContentEl = document.getElementById('nerdContent');
      let nerdHTML = `<div class="nerd-row"><span class="nerd-label">form_score</span><span class="nerd-value">${summary.formScore}%</span></div>`;
      nerdHTML += `<div class="nerd-row"><span class="nerd-label">total_reps</span><span class="nerd-value">${summary.reps}</span></div>`;
      nerdHTML += `<div class="nerd-row"><span class="nerd-label">duration</span><span class="nerd-value">${duration}s</span></div>`;
      if (summary.rom && summary.rom.samples > 0) {
        nerdHTML += `<div class="nerd-row"><span class="nerd-label">rom_range</span><span class="nerd-value">${summary.rom.range}°</span></div>`;
      }
      nerdContentEl.innerHTML = nerdHTML;
    } else {
      // Simple: hide entirely
      nerdSection.style.display = 'none';
    }
  }

  // Gate vitals card visibility — hide in simple mode
  if (level === 'simple') {
    const vc = document.getElementById('vitalsCard');
    if (vc) vc.innerHTML = '';
  }

  // XP results display
  const xpArea = document.getElementById('xpArea');
  if (xpArea && xpResult) {
    let xpHTML = '<div class="summary-card" style="border:1px solid var(--accent); margin-top:0;">';
    xpHTML += '<h4 style="color:var(--accent); font-size:14px; margin-bottom:8px;">Experience Earned</h4>';
    xpHTML += `<div style="font-size:32px; font-weight:800; color:var(--accent);">+${xpResult.xpEarned} XP</div>`;
    if (xpResult.multipliers && xpResult.multipliers.length > 0) {
      xpHTML += '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">';
      xpResult.multipliers.forEach(m => {
        xpHTML += `<span style="background:var(--surface2); border-radius:20px; padding:4px 10px; font-size:11px;">${m.icon} ${m.label} ×${m.value}</span>`;
      });
      xpHTML += '</div>';
    }
    xpHTML += `<div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--text-dim);">`;
    xpHTML += `<span>Level ${xpResult.newLevel}</span>`;
    xpHTML += `<span>${xpResult.xpToNext} XP to next level</span>`;
    xpHTML += '</div>';
    xpHTML += `<div style="background:var(--surface2); border-radius:10px; height:8px; margin-top:6px; overflow:hidden;">`;
    const progress = typeof xpEngine !== 'undefined' ? xpEngine.getProgress().percent : 0;
    xpHTML += `<div style="background:var(--accent); height:100%; width:${progress}%; border-radius:10px; transition:width 0.5s;"></div>`;
    xpHTML += '</div>';
    if (xpResult.levelUp) {
      xpHTML += `<div style="text-align:center; margin-top:12px; padding:8px; background:linear-gradient(135deg, #1a2a1a, var(--surface)); border-radius:var(--radius);">`;
      xpHTML += `<div style="font-size:20px;">🎉</div>`;
      xpHTML += `<div style="font-size:16px; font-weight:700; color:var(--accent);">LEVEL UP!</div>`;
      xpHTML += `<div style="font-size:13px; color:var(--text-dim);">You are now Level ${xpResult.newLevel} — ${xpResult.newTitle}</div>`;
      xpHTML += '</div>';
    }
    xpHTML += '</div>';
    xpArea.innerHTML = xpHTML;
  } else if (xpArea) {
    xpArea.innerHTML = '';
  }

  // Tempo results display
  const tempoArea = document.getElementById('tempoArea');
  if (tempoArea && tempoSummary && tempoSummary.reps > 0) {
    let tHTML = '<div class="summary-card" style="border:1px solid #ffd166; margin-top:0;">';
    tHTML += '<h4 style="color:#ffd166; font-size:14px; margin-bottom:8px;">Rep Tempo Analysis</h4>';
    tHTML += `<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center;">`;
    tHTML += `<div><div style="font-size:20px; font-weight:700;">${tempoSummary.avgTUT}s</div><div style="font-size:11px; color:var(--text-dim);">Avg TUT</div></div>`;
    tHTML += `<div><div style="font-size:20px; font-weight:700;">${tempoSummary.avgTempo}</div><div style="font-size:11px; color:var(--text-dim);">Avg Tempo</div></div>`;
    tHTML += `<div><div style="font-size:20px; font-weight:700;">${tempoSummary.consistency}%</div><div style="font-size:11px; color:var(--text-dim);">Consistency</div></div>`;
    tHTML += '</div>';
    tHTML += `<div style="margin-top:10px; font-size:13px; color:var(--text-dim);">Total time under tension: ${tempoSummary.totalTUT}s</div>`;
    tHTML += '</div>';
    tempoArea.innerHTML = tHTML;
  } else if (tempoArea) {
    tempoArea.innerHTML = '';
  }

  showScreen('summary');
}

function generateTips(summary) {
  const tipsCard = document.getElementById('tipsCard');
  const tipsList = document.getElementById('tipsList');
  const tips = [];

  const issues = Object.entries(summary.formIssues).sort((a, b) => b[1] - a[1]);

  if (issues.length === 0) {
    tips.push('Perfect session! Keep pushing for consistency across workouts.');
  } else {
    // Generate specific tips based on detected issues
    const tipMap = {
      'Knee valgus (knees caving)': 'Strengthen glutes with banded squats. Focus on pushing knees out over pinky toes.',
      'Excessive forward lean': 'Work on ankle mobility and thoracic extension. Hold a plate in front for counterbalance.',
      'Insufficient depth': 'Try box squats to build confidence at depth. Pause at the bottom for 2 seconds.',
      'Hip sag': 'Core weakness detected. Add dead bugs and hollow holds to your warmup.',
      'Hip pike': 'Engage your core and squeeze glutes. Think about pulling your belly button to spine.',
      'Elbow flare': 'Tuck elbows at 45° to your body. Think "arrow, not T" with your arm position.',
      'Knee past toes': 'Take a wider stance. Step further forward on each lunge.',
      'Torso lean': 'Brace your core before each rep. Look straight ahead, not down.',
      'Arm asymmetry': 'Try unilateral presses to correct the imbalance. Start each set with your weaker arm.',
      'Rounded back': 'Engage lats by "bending the bar." Practice hip hinges with a dowel on your back.',
      'Hip drop': 'Strengthen core with planks and side planks. Squeeze glutes throughout the hold.',
      'Incomplete lockout': 'Focus on pressing through full range. Pause at the top for 1 second.'
    };

    issues.slice(0, 3).forEach(([issue]) => {
      if (tipMap[issue]) tips.push(tipMap[issue]);
    });
  }

  if (summary.formScore < 60) {
    tips.push('Consider reducing weight or reps and focusing on form quality first.');
  }

  tipsList.innerHTML = tips.map(t => safeHTML`<div class="tip-item">${t}</div>`).join('');
  tipsCard.style.display = tips.length > 0 ? 'block' : 'none';
}

// SOCIAL SHARING

async function shareWorkoutSummary() {
  const exercise = document.getElementById('sumExercise').textContent;
  const reps = document.getElementById('sumReps').textContent;
  const duration = document.getElementById('sumDuration').textContent;
  const score = document.getElementById('sumScore').textContent;

  // Use share card generator if available
  if (typeof shareCardGenerator !== 'undefined') {
    try {
      const xpProgress = typeof xpEngine !== 'undefined' ? xpEngine.getProgress() : null;
      const cardData = {
        exercise,
        reps: parseInt(reps) || 0,
        duration: parseInt(duration) || 0,
        formScore: parseInt(score) || null,
        xpEarned: xpProgress ? xpProgress.recentHistory[0]?.xp : null,
        level: xpProgress ? xpProgress.level : null,
        title: xpProgress ? xpProgress.title : null,
        xpPercent: xpProgress ? xpProgress.percent : null
      };
      await shareCardGenerator.share(cardData, 'square');
      return;
    } catch (e) {
      console.warn('Share card failed, falling back to text:', e);
    }
  }

  // Fallback to text share
  const shareText = `💪 PhysioRep Workout Complete!\n\n${exercise}\n🔁 ${reps} reps · ⏱ ${duration}\n🎯 Form Score: ${score}\n\n#PhysioRep #FormCheck #HomeWorkout`;

  if (navigator.share) {
    navigator.share({
      title: 'PhysioRep Workout',
      text: shareText,
    }).catch(() => {
      copyToClipboard(shareText);
    });
  } else {
    copyToClipboard(shareText);
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showError('Copied to clipboard! Paste anywhere to share.');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showError('Copied to clipboard!');
  } catch (_err) {
    showError('Share not available on this device.');
  }
  document.body.removeChild(textarea);
}

// HISTORY & PROGRESS

let historyFilter = 'all';

function filterHistory(filter) {
  historyFilter = filter;
  document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  renderHistory();
}

async function renderHistory() {
  const container = document.getElementById('historyContent');

  try {
    const allWorkouts = await physioRepDB.getWorkouts(100);

    if (allWorkouts.length === 0) {
      document.getElementById('streakBanner').innerHTML = '';
      document.getElementById('recordsRow').innerHTML = '';
      document.getElementById('chartContainer').innerHTML = '';
      container.innerHTML = '<div class="history-empty"><p>No workouts yet.</p><p>Complete your first exercise to see it here.</p></div>';
      return;
    }

    // Streak calculation
    renderStreak(allWorkouts);

    // Achievements
    renderBadgesOnHistory();

    // Personal records
    renderRecords(allWorkouts);

    // Progress chart
    renderChart(allWorkouts);

    // Filter workouts
    const workouts = historyFilter === 'all'
      ? allWorkouts
      : allWorkouts.filter(w => w.exerciseType === historyFilter);

    if (workouts.length === 0) {
      container.innerHTML = '<div class="history-empty"><p>No workouts for this exercise yet.</p></div>';
      return;
    }

    const html = '<div class="history-list">' + workouts.map(w => {
      const date = new Date(w.date);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const mins = Math.floor((w.duration || 0) / 60);
      const secs = (w.duration || 0) % 60;
      const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

      let repsDisplay = w.reps;
      if (w.exerciseType === 'plank') repsDisplay = `${w.plankHoldTime || w.reps}s`;

      let scoreClass = 'good';
      if (w.formScore < 50) scoreClass = 'bad';
      else if (w.formScore < 80) scoreClass = 'ok';

      return `
        <div class="history-item">
          <div class="hi-left">
            <h3>${w.exercise}</h3>
            <p>${dateStr} at ${timeStr} · ${durStr}</p>
          </div>
          <div class="hi-right">
            <div class="hi-reps">${repsDisplay}</div>
            <div class="hi-score ${scoreClass}">${w.formScore}% form</div>
          </div>
        </div>`;
    }).join('') + '</div>';

    container.innerHTML = html;
  } catch (err) {
    console.error('Failed to load history:', err);
    container.innerHTML = '<div class="history-empty"><p>Error loading history.</p></div>';
  }
}

function renderStreak(workouts) {
  const banner = document.getElementById('streakBanner');
  const days = new Set();
  workouts.forEach(w => {
    const d = new Date(w.date).toISOString().split('T')[0];
    days.add(d);
  });

  // Count consecutive days from today
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (days.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  if (streak > 0) {
    banner.innerHTML = safeHTML`
      <div class="streak-banner">
        <div class="streak-count">${streak}</div>
        <div class="streak-label">${streak === 1 ? 'day' : 'day'} streak</div>
      </div>`;
  } else {
    banner.innerHTML = '';
  }
}

function renderRecords(workouts) {
  const row = document.getElementById('recordsRow');
  const repWorkouts = workouts.filter(w => w.exerciseType !== 'plank');
  const plankWorkouts = workouts.filter(w => w.exerciseType === 'plank');

  const bestReps = repWorkouts.length > 0 ? Math.max(...repWorkouts.map(w => w.reps || 0)) : 0;
  const bestScore = workouts.length > 0 ? Math.max(...workouts.map(w => w.formScore || 0)) : 0;
  const bestPlank = plankWorkouts.length > 0 ? Math.max(...plankWorkouts.map(w => w.plankHoldTime || w.reps || 0)) : 0;

  row.innerHTML = safeHTML`
    <div class="records-row">
      <div class="record-card">
        <div class="record-value">${bestReps}</div>
        <div class="record-label">Best Reps</div>
      </div>
      <div class="record-card">
        <div class="record-value">${bestScore}%</div>
        <div class="record-label">Best Form</div>
      </div>
      <div class="record-card">
        <div class="record-value">${bestPlank}s</div>
        <div class="record-label">Best Plank</div>
      </div>
    </div>`;
}

function renderChart(workouts) {
  const container = document.getElementById('chartContainer');
  const last14 = workouts.slice(0, 14).reverse();

  if (last14.length < 2) {
    container.innerHTML = '';
    return;
  }

  const maxScore = 100;
  const bars = last14.map(w => {
    const height = Math.max(4, (w.formScore / maxScore) * 80);
    const date = new Date(w.date);
    const label = `${date.getMonth() + 1}/${date.getDate()} - ${w.formScore}%`;
    let color = '#00e676';
    if (w.formScore < 50) color = '#ff5252';
    else if (w.formScore < 80) color = '#ffab40';

    return `<div class="chart-bar" style="height:${height}px; background:${color};" data-label="${label}"></div>`;
  }).join('');

  container.innerHTML = safeHTML`
    <div class="chart-container">
      <h3>Form Score — Last ${last14.length} Sessions</h3>
      <div class="mini-chart">${bars}</div>
    </div>`;
}

// SETTINGS

function loadSettings() {
  try {
    const stored = localStorage.getItem('physiorep_settings');
    if (stored) {
      const settings = JSON.parse(stored);
      if (settings && typeof settings === 'object') {
        appSettings = { ...appSettings, ...settings };
      } else {
        console.warn('Invalid settings data: expected object');
      }
    }
  } catch (_e) {
    console.warn('Failed to load settings:', _e);
    // localStorage unavailable (private browsing) — use defaults
  }

  // Apply to audio engine
  audioEngine.enabled = appSettings.voice;
  audioEngine.voiceRepCount = appSettings.repCount;
  audioEngine.voiceMilestones = appSettings.milestones;
}

function saveSettings() {
  try {
    localStorage.setItem('physiorep_settings', JSON.stringify(appSettings));
  } catch (_e) {
    // localStorage unavailable
  }
}

function saveSetting(key, value) {
  appSettings[key] = value;
  saveSettings();
}

function loadSettingsUI() {
  document.getElementById('toggleVoice').className = `toggle ${appSettings.voice ? 'on' : ''}`;
  document.getElementById('toggleRepCount').className = `toggle ${appSettings.repCount ? 'on' : ''}`;
  document.getElementById('toggleMilestones').className = `toggle ${appSettings.milestones ? 'on' : ''}`;
  document.getElementById('toggleSkeleton').className = `toggle ${appSettings.skeleton ? 'on' : ''}`;
  document.getElementById('toggleFPS').className = `toggle ${appSettings.fps ? 'on' : ''}`;
  document.getElementById('cameraSelect').value = appSettings.camera || 'environment';
  document.getElementById('countdownSelect').value = String(appSettings.countdown);
  document.getElementById('restSelect').value = String(appSettings.restTime);

  const detailSelect = document.getElementById('detailLevelSelect');
  if (detailSelect) detailSelect.value = appSettings.detailLevel || 'standard';
}

function toggleSetting(key) {
  appSettings[key] = !appSettings[key];
  saveSettings();
  loadSettingsUI();

  // Apply immediately to audio
  audioEngine.enabled = appSettings.voice;
  audioEngine.voiceRepCount = appSettings.repCount;
  audioEngine.voiceMilestones = appSettings.milestones;
}

async function exportData() {
  try {
    const workouts = await physioRepDB.getWorkouts(0);
    const blob = new Blob([JSON.stringify(workouts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `physiorep-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showError('Failed to export data.');
  }
}

async function clearAllData() {
  if (!confirm('Delete all workout history? This cannot be undone.')) return;
  try {
    await physioRepDB.clearAll();
    showError('All data cleared.'); // Using error toast as generic notification
  } catch (err) {
    showError('Failed to clear data.');
  }
}

// CUSTOM ROUTINE BUILDER

let routineBuilderQueue = [];

function addToRoutineBuilder(exerciseType, label) {
  routineBuilderQueue.push({ exerciseType, label });
  renderRoutineBuilderQueue();
}

function removeFromRoutineBuilder(index) {
  routineBuilderQueue.splice(index, 1);
  renderRoutineBuilderQueue();
}

function renderRoutineBuilderQueue() {
  const list = document.getElementById('rbQueueList');
  if (routineBuilderQueue.length === 0) {
    list.innerHTML = '<div style="color:var(--text-dim); font-size:13px; text-align:center; padding:12px;">Add exercises below</div>';
    return;
  }
  list.innerHTML = routineBuilderQueue.map((item, i) => safeHTML`
    <div class="rb-queue-item">
      <div><span class="rb-order">${i + 1}</span>${item.label}</div>
      <button class="rb-add-btn remove" onclick="removeFromRoutineBuilder(${i})">×</button>
    </div>
  `).join('');
}

async function saveCustomRoutine() {
  const name = document.getElementById('routineName').value.trim();
  if (!name) { showError('Give your routine a name.'); return; }
  if (routineBuilderQueue.length < 2) { showError('Add at least 2 exercises.'); return; }

  const routine = {
    name,
    exercises: routineBuilderQueue.map(q => q.exerciseType),
    labels: routineBuilderQueue.map(q => q.label),
    createdAt: new Date().toISOString()
  };

  try {
    await physioRepDB.saveRoutine(routine);
    routineBuilderQueue = [];
    document.getElementById('routineName').value = '';
    renderRoutineBuilderQueue();
    await loadSavedRoutines();
    await loadHomeRoutines();
    audioEngine.speak('Routine saved!', 'normal');
  } catch (err) {
    console.error('Failed to save routine:', err);
    showError('Failed to save routine.');
  }
}

async function loadSavedRoutines() {
  try {
    const routines = await physioRepDB.getRoutines();
    const container = document.getElementById('savedRoutines');
    if (!container) return;
    if (routines.length === 0) { container.innerHTML = ''; return; }

    container.innerHTML = '<h4 style="font-size:13px; color:var(--text-dim); text-transform:uppercase; margin-bottom:8px;">Saved Routines</h4>' +
      routines.map(r => `
        <div class="saved-routine-card">
          <div>
            <div class="sr-name">${r.name}</div>
            <div class="sr-desc">${r.exercises.length} exercises · ${r.exercises.join(' → ')}</div>
          </div>
          <div class="sr-actions">
            <button class="sr-play" onclick="startCustomRoutine(${r.id})" title="Start">▶</button>
            <button class="sr-delete" onclick="deleteCustomRoutine(${r.id})" title="Delete">✕</button>
          </div>
        </div>`).join('');
  } catch (_err) { /* silent */ }
}

async function loadHomeRoutines() {
  try {
    const routines = await physioRepDB.getRoutines();
    const container = document.getElementById('homeCustomRoutines');
    if (!container) return;
    if (routines.length === 0) { container.innerHTML = ''; return; }

    container.innerHTML = routines.map(r => safeHTML`
      <div class="routine-card" style="border-color:var(--accent-dim); margin-top:8px;" onclick="startCustomRoutine(${r.id})">
        <h3>${r.name}</h3>
        <p>${(r.labels || r.exercises).join(' → ')}</p>
      </div>`).join('');
  } catch (_err) { /* silent */ }
}

async function startCustomRoutine(id) {
  try {
    const routines = await physioRepDB.getRoutines();
    const routine = routines.find(r => r.id === id);
    if (!routine || routine.exercises.length === 0) return;

    audioEngine.init();
    routineQueue = routine.exercises.slice(1);
    routineActive = true;
    startWorkout(routine.exercises[0]);
  } catch (_err) {
    showError('Failed to start routine.');
  }
}

async function deleteCustomRoutine(id) {
  if (!confirm('Delete this routine?')) return;
  try {
    await physioRepDB.deleteRoutine(id);
    await loadSavedRoutines();
    await loadHomeRoutines();
  } catch (_err) {
    showError('Failed to delete routine.');
  }
}

// PT MODE

let activePTProgram = null;
let painTracker = new PainTracker();
let selectedPainLevel = null;
let painModalContext = 'daily';
let painModalCallback = null;

/**
 * Entry point for PT mode — show dashboard if program exists, setup if not
 */
async function showPTEntry() {
  try {
    const programData = await physioRepDB.getActivePTProgram();
    if (programData) {
      activePTProgram = new PTProgram(programData);
      await loadPainTracker();
      await renderPTDashboard();
      showScreen('ptDashboard');
    } else {
      showScreen('ptSetup');
    }
  } catch (_err) {
    showScreen('ptSetup');
  }
}

function togglePTExercise(el) {
  el.classList.toggle('selected');
}

async function savePTProgram() {
  const therapist = document.getElementById('ptTherapist').value.trim();
  const patient = document.getElementById('ptPatient').value.trim();
  const diagnosis = document.getElementById('ptDiagnosis').value.trim();
  const daysPerWeek = parseInt(document.getElementById('ptDaysPerWeek').value);
  const reminderTime = document.getElementById('ptReminderTime').value;

  const selectedExercises = [];
  document.querySelectorAll('#ptExPicker .pt-ex-chip.selected').forEach(chip => {
    selectedExercises.push({ exerciseType: chip.dataset.ex, sets: 3, reps: 12, frequency: daysPerWeek });
  });

  if (selectedExercises.length === 0) {
    showError('Select at least one exercise.');
    return;
  }

  const program = new PTProgram({
    therapistName: therapist,
    patientName: patient,
    diagnosis: diagnosis,
    exercises: selectedExercises,
    schedule: { daysPerWeek, reminderTime }
  });

  try {
    await physioRepDB.savePTProgram({
      id: program.id,
      therapistName: program.therapistName,
      patientName: program.patientName,
      diagnosis: program.diagnosis,
      startDate: program.startDate,
      exercises: program.exercises,
      schedule: program.schedule,
      active: true
    });
    activePTProgram = program;
    await renderPTDashboard();
    showScreen('ptDashboard');
    audioEngine.speak('PT program saved. Let\'s track your recovery.', 'normal');
  } catch (err) {
    console.error('Failed to save PT program:', err);
    showError('Failed to save program.');
  }
}

async function loadPainTracker() {
  try {
    const entries = await physioRepDB.getPainEntries(0);
    painTracker = PainTracker.fromJSON({ entries: entries.map(e => ({
      timestamp: e.timestamp,
      date: e.date,
      level: e.level,
      location: e.location,
      context: e.context,
      notes: e.notes
    }))});
  } catch (_err) {
    painTracker = new PainTracker();
  }
}

// PAIN MODAL

function showPainModal(context, callback) {
  painModalContext = context || 'daily';
  painModalCallback = callback || null;
  selectedPainLevel = null;

  const contextLabels = {
    'pre-workout': 'Before your workout',
    'post-workout': 'After your workout',
    'daily': 'Rate your current pain level'
  };

  document.getElementById('painContext').textContent = contextLabels[painModalContext] || 'Rate your pain';
  document.getElementById('painLocation').value = '';
  document.getElementById('painNotes').value = '';

  // Build pain scale buttons
  const scale = document.getElementById('painScale');
  scale.innerHTML = '';
  for (let i = 0; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.className = 'pain-btn' + (i <= 3 ? ' low' : i <= 6 ? ' mid' : ' high');
    btn.textContent = i;
    btn.onclick = () => selectPainLevel(i);
    scale.appendChild(btn);
  }

  document.getElementById('painModal').classList.add('active');
}

function selectPainLevel(level) {
  selectedPainLevel = level;
  document.querySelectorAll('.pain-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.textContent) === level);
  });
}

async function submitPain() {
  if (selectedPainLevel === null) {
    showError('Tap a number to select your pain level.');
    return;
  }

  const location = document.getElementById('painLocation').value;
  const notes = document.getElementById('painNotes').value;

  // Record in PainTracker
  painTracker.record(selectedPainLevel, location, painModalContext, notes);

  // Save to DB
  try {
    await physioRepDB.savePainEntry({
      level: selectedPainLevel,
      location,
      context: painModalContext,
      notes
    });
  } catch (err) {
    console.error('Failed to save pain entry:', err);
  }

  closePainModal();

  if (painModalCallback) {
    painModalCallback();
    painModalCallback = null;
  }
}

function closePainModal() {
  document.getElementById('painModal').classList.remove('active');
  if (painModalCallback) {
    painModalCallback();
    painModalCallback = null;
  }
}

// COMPLIANCE DASHBOARD

async function renderPTDashboard() {
  if (!activePTProgram) return;

  try {
    const workouts = await physioRepDB.getWorkouts(0);
    const compliance = activePTProgram.getCompliance(workouts);

    // Ring
    const percent = compliance.overall;
    const circumference = 2 * Math.PI * 60; // r=60
    const offset = circumference - (percent / 100) * circumference;
    const circle = document.getElementById('compRingCircle');
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = percent >= 80 ? '#00e676' : percent >= 50 ? '#ffab40' : '#ff5252';
    document.getElementById('compPercent').textContent = `${percent}%`;

    // Stats
    document.getElementById('compStreak').textContent = compliance.streak;
    document.getElementById('compCompleted').textContent = compliance.totalCompleted;
    document.getElementById('compMissed').textContent = compliance.missedDays;

    // Per-exercise compliance
    const listEl = document.getElementById('exCompList');
    const names = {
      squat: 'Squats', pushup: 'Push-Ups', plank: 'Plank',
      lunge: 'Lunges', shoulderpress: 'Shoulder Press', deadlift: 'Deadlift'
    };
    let listHTML = '';
    Object.entries(compliance.byExercise).forEach(([_key, ex]) => {
      listHTML += `
        <div class="ex-comp-item">
          <div>
            <div style="font-size:14px; font-weight:600;">${names[ex.name] || ex.name}</div>
            <div style="font-size:11px; color:var(--text-dim);">${ex.completed}/${ex.expected} sessions · ${ex.avgFormScore}% avg form</div>
            <div class="ex-comp-bar" style="width:100%;"><div class="ex-comp-bar-fill" style="width:${ex.percentage}%;"></div></div>
          </div>
          <div style="font-size:18px; font-weight:800; color:${ex.percentage >= 80 ? '#00e676' : ex.percentage >= 50 ? '#ffab40' : '#ff5252'};">
            ${ex.percentage}%
          </div>
        </div>`;
    });
    listEl.innerHTML = listHTML;

    // Pain trend
    await loadPainTracker();
    const painTrend = painTracker.getTrend(30);
    const trendEl = document.getElementById('painTrendValue');
    const detailEl = document.getElementById('painTrendDetail');

    if (painTrend.trend === 'none') {
      trendEl.textContent = 'No data yet';
      trendEl.className = 'pain-trend-value';
      detailEl.textContent = 'Log your first pain entry to start tracking.';
    } else {
      const trendLabels = { improving: '↓ Improving', worsening: '↑ Worsening', stable: '→ Stable' };
      trendEl.textContent = `${trendLabels[painTrend.trend]} · Avg ${painTrend.average}/10`;
      trendEl.className = 'pain-trend-value ' + painTrend.trend;

      const delta = painTracker.getWorkoutPainDelta();
      detailEl.textContent = delta ? delta.interpretation : `Range: ${painTrend.min}-${painTrend.max}/10`;
    }

    // ROM progression chart
    const romChartEl = document.getElementById('romProgressChart');
    if (romChartEl && workouts.length >= 2) {
      const prescribedTypes = activePTProgram.exercises.map(e => e.exerciseType);
      let romHTML = '';

      prescribedTypes.forEach(type => {
        const exWorkouts = workouts
          .filter(w => w.exerciseType === type && w.rom && w.rom.range)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(-10);

        if (exWorkouts.length >= 2) {
          const bars = exWorkouts.map(w => {
            const height = Math.max(4, (w.rom.range / 180) * 60);
            const color = w.rom.range > exWorkouts[0].rom.range ? '#00e676' : '#ffab40';
            return `<div style="flex:1; height:${height}px; background:${color}; border-radius:2px 2px 0 0; min-width:8px;" title="${w.rom.range}°"></div>`;
          }).join('');

          const improvement = exWorkouts[exWorkouts.length - 1].rom.range - exWorkouts[0].rom.range;
          const improvColor = improvement > 0 ? '#00e676' : improvement < 0 ? '#ff5252' : 'var(--text-dim)';
          const improvText = improvement > 0 ? `+${improvement}°` : `${improvement}°`;

          const names = { squat: 'Squats', pushup: 'Push-Ups', plank: 'Plank', lunge: 'Lunges', shoulderpress: 'Shoulder Press', deadlift: 'Deadlift' };

          romHTML += `
            <div style="margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:13px; font-weight:600;">${names[type] || type}</span>
                <span style="font-size:12px; font-weight:700; color:${improvColor};">${improvText}</span>
              </div>
              <div style="display:flex; align-items:flex-end; gap:3px; height:60px;">${bars}</div>
            </div>`;
        }
      });

      if (romHTML) {
        romChartEl.innerHTML = safeHTML`<h4 style="font-size:14px; color:var(--text-dim); margin-bottom:12px;">ROM Progression</h4>${romHTML}`;
        romChartEl.style.display = 'block';
      } else {
        romChartEl.style.display = 'none';
      }
    } else if (romChartEl) {
      romChartEl.style.display = 'none';
    }

  } catch (err) {
    console.error('Failed to render PT dashboard:', err);
  }
}

// REPORT GENERATION

async function generatePTReport() {
  if (!activePTProgram) return;

  showScreen('ptReport');

  try {
    const workouts = await physioRepDB.getWorkouts(0);
    await loadPainTracker();
    const report = ComplianceReport.generate(activePTProgram, workouts, painTracker);

    // Render preview
    const preview = document.getElementById('reportPreview');
    const compColor = report.compliance.overall >= 80 ? '#00c853' :
                      report.compliance.overall >= 50 ? '#ff8f00' : '#d32f2f';

    preview.innerHTML = safeHTML`
      <h3 style="color:#00c853;">PhysioRep Compliance Report</h3>
      <div class="rp-meta">
        Patient: ${report.program.patient || 'Not specified'}<br>
        Therapist: ${report.program.therapist || 'Not specified'}<br>
        Diagnosis: ${report.program.diagnosis || 'Not specified'}<br>
        Generated: ${new Date(report.generatedAt).toLocaleDateString()}
      </div>
      <div class="rp-score" style="color:${compColor}">${report.compliance.overall}%</div>
      <p>${report.compliance.totalCompleted} of ${report.compliance.totalExpected} sessions · ${report.compliance.streak}-day streak</p>
      <hr style="border:none; border-top:1px solid #eee; margin:12px 0;">
      <p><strong>Pain:</strong> ${report.pain.trend === 'none' ? 'No data' : report.pain.trend + ' (avg ' + report.pain.currentAverage + '/10)'}</p>
      <hr style="border:none; border-top:1px solid #eee; margin:12px 0;">
      <p style="background:#f8f8f8; padding:10px; border-radius:6px;">${report.summary || 'Insufficient data for summary.'}</p>
    `;

    // Store report for sharing
    window._lastPTReport = report;
  } catch (err) {
    console.error('Failed to generate report:', err);
    document.getElementById('reportPreview').innerHTML = '<p style="color:#999;">Failed to generate report. Complete some workouts first.</p>';
  }
}

function sharePTReport() {
  if (!window._lastPTReport) return;

  const html = ComplianceReport.toHTML(window._lastPTReport);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
}

function downloadPTReport() {
  if (!window._lastPTReport) return;

  const html = ComplianceReport.toHTML(window._lastPTReport);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `physiorep-report-${new Date().toISOString().split('T')[0]}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// MODIFICATIONS

function showModifications() {
  if (!activePTProgram || activePTProgram.exercises.length === 0) {
    showError('No exercises in your PT program.');
    return;
  }

  const modal = document.getElementById('modModal');
  const list = document.getElementById('modList');
  let html = '';

  activePTProgram.exercises.forEach(ex => {
    const names = {
      squat: 'Squats', pushup: 'Push-Ups', plank: 'Plank',
      lunge: 'Lunges', shoulderpress: 'Shoulder Press', deadlift: 'Deadlift'
    };
    const easier = getModifications(ex.exerciseType, 'too-hard');
    const harder = getModifications(ex.exerciseType, 'too-easy');
    const pain = getModifications(ex.exerciseType, 'pain');

    html += `<div style="margin-bottom:16px;">
      <h4 style="font-size:15px; color:#b388ff; margin-bottom:8px;">${names[ex.exerciseType] || ex.exerciseType}</h4>`;

    if (easier.length > 0) {
      html += `<div style="font-size:11px; color:var(--text-dim); margin-bottom:4px;">EASIER</div>`;
      easier.forEach(m => { html += `<div class="mod-item"><h4>${m.name}</h4><p>${m.desc}</p></div>`; });
    }
    if (harder.length > 0) {
      html += `<div style="font-size:11px; color:var(--text-dim); margin-bottom:4px; margin-top:8px;">HARDER</div>`;
      harder.forEach(m => { html += `<div class="mod-item"><h4>${m.name}</h4><p>${m.desc}</p></div>`; });
    }
    if (pain.length > 0) {
      html += `<div style="font-size:11px; color:var(--text-dim); margin-bottom:4px; margin-top:8px;">PAIN ALTERNATIVES</div>`;
      pain.forEach(m => { html += `<div class="mod-item"><h4>${m.name}</h4><p>${m.desc}</p></div>`; });
    }

    html += `</div>`;
  });

  list.innerHTML = html;
  modal.classList.add('active');
}

function closeModModal() {
  document.getElementById('modModal').classList.remove('active');
}

// PT MODE WORKOUT INTEGRATION

// Override stopWorkout to prompt for post-workout pain when PT mode is active
const _originalStopWorkout = stopWorkout;

stopWorkout = async function() {
  isWorkoutActive = false;
  isPaused = false;

  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (camera) { camera.stop(); camera = null; }
  stopCamera();

  const summary = currentTracker.getSummary();
  const duration = Math.floor((Date.now() - workoutStartTime) / 1000);

  audioEngine.playSuccessChime();
  audioEngine.speak('Workout complete!', 'high');

  // Collect vitals summary
  let vitalsSummary = null;
  if (typeof vitalsMonitor !== 'undefined') {
    vitalsSummary = vitalsMonitor.getSummary();
  }

  // Save to database
  try {
    await physioRepDB.saveWorkout({
      exercise: summary.exercise,
      exerciseType: summary.exerciseType,
      reps: summary.reps,
      duration,
      formScore: summary.formScore,
      formIssues: summary.formIssues,
      plankHoldTime: summary.plankHoldTime,
      rom: summary.rom,
      milestones: summary.milestones,
      vitals: vitalsSummary
    });
  } catch (err) {
    console.error('Failed to save workout:', err);
  }

  // Update challenge progress
  if (typeof challengeEngine !== 'undefined') {
    challengeEngine.updateProgress({
      exerciseType: summary.exerciseType,
      reps: summary.reps,
      formScore: summary.formScore,
      duration,
      plankHoldTime: summary.plankHoldTime,
      date: new Date().toISOString()
    });
  }

  // Routine handling
  if (routineActive && routineQueue.length > 0) {
    showRestTimer(routineQueue[0]);
    return;
  }
  routineActive = false;

  // If PT mode is active, prompt for post-workout pain
  if (activePTProgram) {
    showPainModal('post-workout', () => {
      showSummary(summary, duration, vitalsSummary);
    });
  } else {
    showSummary(summary, duration, vitalsSummary);
  }
};

// ACHIEVEMENTS UI

async function checkAchievements() {
  try {
    const workouts = await physioRepDB.getWorkouts(0);
    const stats = computeAchievementStats(workouts);
    const newBadges = achievementEngine.evaluate(stats);

    // Announce new badges
    newBadges.forEach(badge => {
      showFeedback(`${badge.icon} ${badge.name} unlocked!`, 'milestone');
      audioEngine.announceMilestone(`Badge unlocked: ${badge.name}`);
    });

    return newBadges;
  } catch (_err) {
    return [];
  }
}

function renderBadgesOnHome() {
  const container = document.getElementById('homeBadges');
  if (!container) return;

  const all = achievementEngine.getAll();
  const unlocked = all.filter(b => b.unlocked);
  const progress = achievementEngine.getProgress();

  if (unlocked.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = safeHTML`
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
      <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px; font-weight:600;">Badges</span>
      <span style="font-size:11px; color:var(--text-dim);">${progress.unlocked}/${progress.total}</span>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      ${all.map(b => safeHTML`
        <div style="width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center;
          font-size:20px; background:${b.unlocked ? 'var(--surface)' : 'var(--surface2)'}; opacity:${b.unlocked ? '1' : '0.3'};
          border:1px solid ${b.unlocked ? 'var(--accent)' : 'var(--surface2)'};"
          title="${b.name}: ${b.desc}">${b.icon}</div>
      `).join('')}
    </div>`;
}

function renderBadgesOnHistory() {
  const container = document.getElementById('historyBadges');
  if (!container) return;

  const all = achievementEngine.getAll();
  const progress = achievementEngine.getProgress();

  container.innerHTML = safeHTML`
    <div style="background:var(--surface); border-radius:var(--radius); padding:16px; margin-bottom:16px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h3 style="font-size:16px; font-weight:700;">Achievements</h3>
        <span style="font-size:12px; color:var(--accent); font-weight:700;">${progress.unlocked}/${progress.total}</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">
        ${all.map(b => safeHTML`
          <div style="text-align:center; padding:8px 4px; border-radius:8px; background:${b.unlocked ? '#1a2a1a' : 'var(--surface2)'}; opacity:${b.unlocked ? '1' : '0.4'};">
            <div style="font-size:24px;">${b.icon}</div>
            <div style="font-size:9px; color:${b.unlocked ? 'var(--accent)' : 'var(--text-dim)'}; margin-top:4px; line-height:1.2;">${b.name}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

// SMART WORKOUT SUGGESTIONS

async function getSmartSuggestion() {
  try {
    const workouts = await physioRepDB.getWorkouts(50);
    const allExercises = ['squat', 'pushup', 'plank', 'lunge', 'shoulderpress', 'deadlift'];
    const names = {
      squat: 'Squats', pushup: 'Push-Ups', plank: 'Plank',
      lunge: 'Lunges', shoulderpress: 'Shoulder Press', deadlift: 'Deadlift'
    };

    if (workouts.length === 0) {
      return { exercise: 'squat', reason: 'Start with squats — the king of exercises' };
    }

    // Count sessions per exercise in last 14 days
    const twoWeeksAgo = Date.now() - 14 * 86400000;
    const recentCounts = {};
    allExercises.forEach(e => { recentCounts[e] = 0; });
    workouts.forEach(w => {
      if (new Date(w.date).getTime() > twoWeeksAgo) {
        recentCounts[w.exerciseType] = (recentCounts[w.exerciseType] || 0) + 1;
      }
    });

    // Find least-trained exercise
    const sorted = allExercises.sort((a, b) => recentCounts[a] - recentCounts[b]);
    const leastTrained = sorted[0];

    // Find exercise with worst form score
    const formScores = {};
    allExercises.forEach(e => {
      const exWorkouts = workouts.filter(w => w.exerciseType === e && w.formScore);
      if (exWorkouts.length > 0) {
        formScores[e] = Math.round(exWorkouts.slice(0, 5).reduce((s, w) => s + w.formScore, 0) / Math.min(5, exWorkouts.length));
      }
    });

    const worstForm = Object.entries(formScores).sort((a, b) => a[1] - b[1])[0];

    // Decision: untrained > low form > least recent
    if (recentCounts[leastTrained] === 0) {
      return { exercise: leastTrained, reason: `You haven't done ${names[leastTrained]} in 2 weeks` };
    }

    if (worstForm && worstForm[1] < 70) {
      return { exercise: worstForm[0], reason: `Your ${names[worstForm[0]]} form needs work (${worstForm[1]}%)` };
    }

    return { exercise: leastTrained, reason: `${names[leastTrained]} is your least trained this week` };
  } catch (_err) {
    return { exercise: 'squat', reason: 'Classic choice — great full-body exercise' };
  }
}

async function renderSmartSuggestion() {
  const container = document.getElementById('smartSuggestion');
  if (!container) return;

  const suggestion = await getSmartSuggestion();
  const icons = { squat: '🦵', pushup: '💪', plank: '🧘', lunge: '🦿', shoulderpress: '🏋️', deadlift: '🔥' };
  const names = { squat: 'Squats', pushup: 'Push-Ups', plank: 'Plank', lunge: 'Lunges', shoulderpress: 'Shoulder Press', deadlift: 'Deadlift' };

  container.innerHTML = safeHTML`
    <div style="background:linear-gradient(135deg, #1a2a1a 0%, var(--surface) 100%); border:1px solid var(--accent); border-radius:var(--radius); padding:14px; cursor:pointer; transition:all 0.2s;"
         onclick="startWorkout('${suggestion.exercise}')">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="font-size:28px;">${icons[suggestion.exercise] || '🏋️'}</div>
        <div>
          <div style="font-size:10px; color:var(--accent); text-transform:uppercase; letter-spacing:1px; font-weight:600;">Suggested for You</div>
          <div style="font-size:16px; font-weight:700; margin-top:2px;">${names[suggestion.exercise]}</div>
          <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">${suggestion.reason}</div>
        </div>
      </div>
    </div>`;
}

// WARM-UP & COOL-DOWN

const WARMUP_SEQUENCE = [
  { name: 'Arm Circles', duration: 30, icon: '🔄', desc: 'Circle arms forward, then backward' },
  { name: 'Leg Swings', duration: 30, icon: '🦵', desc: 'Swing each leg forward and back' },
  { name: 'Hip Circles', duration: 30, icon: '🔁', desc: 'Circle hips clockwise, then counter' },
  { name: 'Torso Twists', duration: 30, icon: '🌀', desc: 'Rotate torso side to side' },
  { name: 'High Knees', duration: 30, icon: '⬆️', desc: 'Drive knees up, pump arms' },
  { name: 'Jumping Jacks', duration: 30, icon: '⭐', desc: 'Full range, land softly' },
];

const COOLDOWN_SEQUENCE = [
  { name: 'Quad Stretch', duration: 30, icon: '🦵', desc: 'Hold each side, stay balanced' },
  { name: 'Hamstring Stretch', duration: 30, icon: '🧘', desc: 'Reach for toes, keep legs straight' },
  { name: 'Chest Opener', duration: 30, icon: '💪', desc: 'Clasp hands behind back, lift' },
  { name: 'Shoulder Stretch', duration: 30, icon: '🤸', desc: 'Cross arm across body, hold' },
  { name: 'Cat-Cow', duration: 30, icon: '🐱', desc: 'Alternate arch and round spine' },
  { name: 'Deep Breathing', duration: 60, icon: '🌬️', desc: '4 sec in, 4 hold, 4 out' },
];

let guidedSequence = [];
let guidedIndex = 0;
let guidedTimer = null;
let guidedTimeLeft = 0;

function startWarmup() {
  audioEngine.init();
  // Use recovery.js if available, with auto-suggested routine based on last exercise
  if (typeof RecoverySession !== 'undefined' && typeof getWarmupRecommendation !== 'undefined') {
    const recommendation = getWarmupRecommendation(lastExercise);
    const routineKey = recommendation ? recommendation.key : 'pre_squat';
    startMobilitySession(routineKey);
    return;
  }
  // Fallback to hardcoded
  guidedSequence = WARMUP_SEQUENCE;
  guidedIndex = 0;
  showGuidedOverlay();
  runGuidedStep();
}

function startCooldown() {
  audioEngine.init();
  // Use recovery.js if available
  if (typeof RecoverySession !== 'undefined' && typeof MOBILITY_ROUTINES !== 'undefined') {
    startMobilitySession('post_workout');
    return;
  }
  // Fallback to hardcoded
  guidedSequence = COOLDOWN_SEQUENCE;
  guidedIndex = 0;
  showGuidedOverlay();
  runGuidedStep();
}

function showGuidedOverlay() {
  document.getElementById('guidedOverlay').classList.add('active');
}

function runGuidedStep() {
  if (guidedIndex >= guidedSequence.length) {
    endGuidedSequence();
    return;
  }

  const step = guidedSequence[guidedIndex];
  guidedTimeLeft = step.duration;

  document.getElementById('guidedIcon').textContent = step.icon;
  document.getElementById('guidedName').textContent = step.name;
  document.getElementById('guidedDesc').textContent = step.desc;
  document.getElementById('guidedTime').textContent = guidedTimeLeft;
  document.getElementById('guidedProgress').textContent = `${guidedIndex + 1} / ${guidedSequence.length}`;

  audioEngine.speak(step.name, 'normal');

  guidedTimer = setInterval(() => {
    guidedTimeLeft--;
    document.getElementById('guidedTime').textContent = guidedTimeLeft;

    if (guidedTimeLeft === 3) audioEngine.speak('3', 'normal');

    if (guidedTimeLeft <= 0) {
      clearInterval(guidedTimer);
      guidedIndex++;
      audioEngine.playSuccessChime();
      runGuidedStep();
    }
  }, 1000);
}

function skipGuidedStep() {
  if (guidedTimer) clearInterval(guidedTimer);
  guidedIndex++;
  runGuidedStep();
}

function endGuidedSequence() {
  if (guidedTimer) clearInterval(guidedTimer);
  document.getElementById('guidedOverlay').classList.remove('active');
  audioEngine.speak('Done! Great job.', 'high');
  audioEngine.playSuccessChime();
}

// BODY METRICS TRACKER

async function showMetricsScreen() {
  showScreen('bodyMetrics');
  await renderMetricsChart();
}

async function saveBodyMetric() {
  const weight = parseFloat(document.getElementById('metricWeight').value);
  if (isNaN(weight) || weight <= 0) {
    showError('Enter a valid weight.');
    return;
  }

  const notes = document.getElementById('metricNotes').value.trim();

  try {
    await physioRepDB.saveMetric({ weight, notes });
    document.getElementById('metricWeight').value = '';
    document.getElementById('metricNotes').value = '';
    showError('Weight logged!');
    await renderMetricsChart();
  } catch (err) {
    console.error('Failed to save metric:', err);
    showError('Failed to save.');
  }
}

async function renderMetricsChart() {
  const container = document.getElementById('metricsChartArea');
  if (!container) return;

  try {
    const metrics = await physioRepDB.getMetrics(30);

    if (metrics.length === 0) {
      container.innerHTML = '<div style="text-align:center; color:var(--text-dim); padding:40px 0;">Log your first weight to see your chart.</div>';
      return;
    }

    const sorted = [...metrics].reverse(); // oldest first for chart
    const weights = sorted.map(m => m.weight);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const range = maxW - minW || 1;

    const current = metrics[0].weight;
    const change = metrics.length >= 2 ? (current - metrics[metrics.length - 1].weight).toFixed(1) : 0;
    const changeColor = change > 0 ? '#ffab40' : change < 0 ? '#00e676' : 'var(--text-dim)';
    const changeText = change > 0 ? `+${change}` : `${change}`;

    const bars = sorted.map(m => {
      const pct = ((m.weight - minW) / range) * 60 + 20;
      const date = new Date(m.date);
      const label = `${date.getMonth()+1}/${date.getDate()} — ${m.weight} lbs`;
      return `<div class="chart-bar" style="height:${pct}px; background:var(--accent);" data-label="${label}"></div>`;
    }).join('');

    container.innerHTML = safeHTML`
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
        <div>
          <div style="font-size:28px; font-weight:900; color:var(--accent);">${current}</div>
          <div style="font-size:11px; color:var(--text-dim);">lbs current</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px; font-weight:700; color:${changeColor};">${changeText} lbs</div>
          <div style="font-size:11px; color:var(--text-dim);">since first entry</div>
        </div>
      </div>
      <div class="mini-chart" style="height:80px;">${bars}</div>
      <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-dim); margin-top:4px;">
        <span>${new Date(sorted[0].date).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</span>
        <span>${new Date(sorted[sorted.length-1].date).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</span>
      </div>
      <div style="margin-top:16px;">
        <h4 style="font-size:13px; color:var(--text-dim); margin-bottom:8px;">Recent Entries</h4>
        ${metrics.slice(0, 5).map(m => {
          const d = new Date(m.date);
          return safeHTML`<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--surface2); font-size:13px;">
            <span>${d.toLocaleDateString('en-US', {month:'short', day:'numeric'})} ${d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})}</span>
            <span style="font-weight:700;">${m.weight} lbs</span>
          </div>`;
        }).join('')}
      </div>`;
  } catch (err) {
    console.error('Failed to render metrics:', err);
    container.innerHTML = '<div style="color:var(--text-dim); text-align:center;">Error loading data.</div>';
  }
}

// WORKOUT REMINDERS

async function requestNotifications() {
  if (!('Notification' in window)) {
    showError('Notifications not supported on this browser.');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    showError('Notifications enabled!');
    appSettings.notifications = true;
    saveSettings();
    loadSettingsUI();
    scheduleReminder();
  } else {
    showError('Notification permission denied.');
  }
}

function scheduleReminder() {
  if (!appSettings.notifications) return;

  // Check every minute if it's reminder time
  if (window._reminderInterval) clearInterval(window._reminderInterval);

  window._reminderInterval = setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const reminderHour = parseInt((appSettings.reminderTime || '09:00').split(':')[0]);
    const reminderMin = parseInt((appSettings.reminderTime || '09:00').split(':')[1]);

    if (hours === reminderHour && minutes === reminderMin) {
      if (Notification.permission === 'granted') {
        const messages = [
          'Time to move! Your body will thank you.',
          'Quick workout? Even 5 minutes counts.',
          'Your streak depends on you today!',
          'Form check time — PhysioRep is ready when you are.',
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        new Notification('PhysioRep', { body: msg, icon: '/icons/icon-192.png' });
      }
    }
  }, 60000);
}

// VITALS HUD

let _lastHRUpdate = 0;

function updateVitalsHUD() {
  const now = performance.now();
  // Throttle HUD updates to 2x/sec (avoid DOM thrashing)
  if (now - _lastHRUpdate < 500) return;
  _lastHRUpdate = now;

  const hrEl = document.getElementById('hrDisplay');
  const brEl = document.getElementById('brDisplay');
  if (!hrEl || !brEl) return;

  const v = vitalsMonitor.getVitals();

  // Heart rate: only show when confidence > 0.2 and value is physiological
  if (v.heartRate > 40 && v.heartRate < 200 && v.hrConfidence > 0.2) {
    hrEl.textContent = `${v.heartRate} BPM`;
    hrEl.classList.toggle('low-confidence', v.hrConfidence < 0.5);
  } else {
    hrEl.textContent = '-- BPM';
    hrEl.classList.add('low-confidence');
  }

  // Breathing rate: only show during low-motion exercises (plank, rest)
  // During dynamic exercises, shoulder motion != breathing
  const isLowMotion = lastExercise === 'plank';
  if (isLowMotion && v.breathingRate > 8 && v.breathingRate < 40 && v.brConfidence > 0.3) {
    brEl.textContent = `${v.breathingRate} br/min`;
    brEl.style.display = '';
  } else {
    brEl.textContent = '';
    brEl.style.display = 'none';
  }
}

// CHALLENGES UI

function showChallenges() {
  showScreen('challenges');
  renderChallenges();
  renderLeaderboard();

  const codeEl = document.getElementById('myFriendCode');
  if (codeEl && typeof challengeEngine !== 'undefined') {
    codeEl.textContent = challengeEngine.getMyCode();
  }
}

function renderChallenges() {
  if (typeof challengeEngine === 'undefined') return;

  const container = document.getElementById('activeChallengesList');
  if (!container) return;

  const challenges = challengeEngine.getActiveChallenges();

  if (challenges.length === 0) {
    container.innerHTML = '<p style="color:var(--text-dim); text-align:center; padding:24px;">No active challenges. Check back tomorrow!</p>';
    return;
  }

  container.innerHTML = challenges.map(c => {
    const pct = c.percentComplete;
    const timeLeft = c.timeRemaining;
    const timeStr = timeLeft > 24 ? `${Math.ceil(timeLeft / 24)}d left` : `${timeLeft}h left`;

    return safeHTML`<div class="challenge-card${c.completed ? ' completed' : ''}">
      <div class="challenge-header">
        <span class="challenge-icon">${c.icon}</span>
        <div class="challenge-info">
          <span class="challenge-name">${c.name}</span>
          <span class="challenge-type">${c.type}</span>
        </div>
        ${c.completed ? '<span class="challenge-badge">✓</span>' : `<span class="challenge-badge">${pct}%</span>`}
      </div>
      <div class="challenge-progress-bar">
        <div class="challenge-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="challenge-stats">
        <span>${c.progress}/${c.target}</span>
        <span>${c.completed ? 'Completed!' : timeStr}</span>
      </div>
    </div>`;
  }).join('');

  // Completed history
  const historyEl = document.getElementById('challengeHistory');
  if (historyEl) {
    const completed = challengeEngine.getCompletedChallenges(5);
    if (completed.length > 0) {
      historyEl.innerHTML = '<h3 style="margin-bottom:8px;">Recent</h3>' +
        completed.map(c => `<div class="challenge-completed-item">
          <span>${c.icon || '🏆'} ${c.name || c.templateId}</span>
          <span style="color:var(--text-dim);">${c.completedAt ? new Date(c.completedAt).toLocaleDateString() : ''}</span>
        </div>`).join('');
    } else {
      historyEl.innerHTML = '';
    }
  }
}

function renderLeaderboard() {
  if (typeof challengeEngine === 'undefined') return;

  const container = document.getElementById('leaderboardList');
  if (!container) return;

  const board = challengeEngine.getLeaderboard();
  const medals = ['🥇', '🥈', '🥉'];

  container.innerHTML = board.map((entry, i) => {
    const medal = i < 3 ? medals[i] : `${entry.rank}`;
    return safeHTML`<div class="leaderboard-row${entry.isSelf ? ' leaderboard-me' : ''}">
      <span class="leaderboard-rank">${medal}</span>
      <span class="leaderboard-name">${entry.name}</span>
      <span class="leaderboard-pts">${entry.weeklyPoints} pts</span>
    </div>`;
  }).join('');
}

function addFriend() {
  if (typeof challengeEngine === 'undefined') return;

  const codeInput = document.getElementById('friendCodeInput');
  const nameInput = document.getElementById('friendNameInput');
  if (!codeInput || !nameInput) return;

  const code = codeInput.value.trim();
  const name = nameInput.value.trim();

  if (!code || !name) return;

  const success = challengeEngine.addFriend(code, name);
  if (success) {
    codeInput.value = '';
    nameInput.value = '';
    renderLeaderboard();
  }
}

function shareChallengeResult(challengeId) {
  if (typeof challengeEngine === 'undefined') return;
  const data = challengeEngine.shareChallenge(challengeId);
  if (data) challengeEngine.share(data);
}

function shareWeeklyStats() {
  if (typeof challengeEngine === 'undefined') return;
  const data = challengeEngine.shareWeeklyStats();
  if (data) challengeEngine.share(data);
}

function renderHomeChallenges() {
  if (typeof challengeEngine === 'undefined') return;

  const container = document.getElementById('homeChallenges');
  if (!container) return;

  const challenges = challengeEngine.getActiveChallenges().filter(c => !c.completed);

  if (challenges.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<h3 style="font-size:14px; margin-bottom:8px; color:var(--text-dim);">Active Challenges</h3>' +
    challenges.slice(0, 3).map(c => {
      const pct = c.percentComplete;
      return `<div class="home-challenge-card" onclick="showChallenges()">
        <span>${c.icon}</span>
        <span style="flex-shrink:0; width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.name}</span>
        <div class="mini-progress-bar"><div class="mini-progress-fill" style="width:${pct}%"></div></div>
        <span style="color:var(--primary); font-weight:600; font-size:12px;">${pct}%</span>
      </div>`;
    }).join('');
}

// HELP MODAL & DETAIL LEVEL

function showHelp(topic) {
  const helpContent = {
    'formScore': {
      title: 'Form Score',
      body: 'Your form score is a percentage showing how well you did the exercise. 90-100% is great form, 75-89% is good, 50-74% is okay, below 50% means focus on form next time.'
    },
    'formIssues': {
      title: 'What to Work On',
      body: 'These are the specific form problems we detected during your workout. Focus on fixing one at a time to improve your score.'
    },
    'rom': {
      title: 'Range of Motion',
      body: 'This measures how far you moved during the exercise. A bigger range (closer to 180°) usually means you\'re doing the full movement properly.'
    }
  };

  const content = helpContent[topic] || { title: 'Help', body: 'No help available for this topic.' };

  document.getElementById('helpTitle').textContent = content.title;
  document.getElementById('helpBody').textContent = content.body;
  document.getElementById('helpModal').style.display = 'flex';
}

function closeHelp() {
  document.getElementById('helpModal').style.display = 'none';
}

function setDetailLevel(level) {
  appSettings.detailLevel = level;
  saveSettings();

  // Highlight selected button
  document.querySelectorAll('.level-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.getAttribute('onclick')?.includes(level));
  });

  // Auto-advance onboarding after brief feedback delay
  setTimeout(() => advanceOnboarding(), 400);
}

function toggleNerdSection() {
  const content = document.getElementById('nerdContent');
  const arrow = document.getElementById('nerdArrow');
  const isHidden = content.style.display === 'none';

  content.style.display = isHidden ? 'block' : 'none';
  arrow.textContent = isHidden ? '▲' : '▼';
}

// FIRST-USE TIP (explains green skeleton during workout)

function showFirstUseTip() {
  if (localStorage.getItem('physiorep_seen_tip')) return;
  const tip = document.getElementById('firstUseTip');
  if (tip) tip.style.display = 'block';
}

function dismissFirstUseTip() {
  const tip = document.getElementById('firstUseTip');
  if (tip) tip.style.display = 'none';
  localStorage.setItem('physiorep_seen_tip', '1');
}

// PROGRAMS UI

function renderActiveProgramBanner() {
  const banner = document.getElementById('activeProgramBanner');
  if (!banner || typeof programEngine === 'undefined') return;

  const prog = programEngine.getProgress();
  if (!prog) { banner.style.display = 'none'; return; }

  banner.style.display = 'block';
  document.getElementById('progBannerName').textContent = prog.programName;
  document.getElementById('progBannerProgress').textContent = prog.percentComplete + '%';
  document.getElementById('progBannerBar').style.width = prog.percentComplete + '%';
}

function renderPrograms() {
  if (typeof programEngine === 'undefined') return;
  renderActiveProgramDetail();
  renderProgramLibrary('all');
}

function renderActiveProgramDetail() {
  const section = document.getElementById('activeProgramSection');
  const card = document.getElementById('activeProgramCard');
  if (!section || !card) return;

  const prog = programEngine.getProgress();
  if (!prog) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  const todaysWorkout = programEngine.getTodaysWorkout();
  const exerciseNames = { squat:'Squats', pushup:'Push-Ups', plank:'Plank', lunge:'Lunges', shoulderpress:'Shoulder Press', deadlift:'Deadlift' };

  let todayHTML = '';
  if (todaysWorkout && !programEngine.isComplete()) {
    todayHTML = `<div style="margin-top:12px; padding:12px; background:var(--surface2); border-radius:8px;">
      <div style="font-size:11px; color:var(--accent); font-weight:600; text-transform:uppercase;">Today's Workout (Week ${prog.currentWeek + 1}, Day ${prog.currentDay + 1})</div>
      <div style="margin-top:6px; font-size:13px;">${todaysWorkout.exercises.map(e => {
    const name = exerciseNames[e.type] || e.type;
    return e.holdSec ? `${name} (${e.holdSec}s hold)` : `${name} × ${e.reps}`;
  }).join(' → ')}</div>
      <button class="btn-primary" style="margin-top:10px; padding:10px;" onclick="startProgramWorkout()">Start Today's Workout</button>
    </div>`;
  } else if (programEngine.isComplete()) {
    todayHTML = '<div style="margin-top:12px; color:var(--accent); font-weight:700; text-align:center;">🎉 Program Complete!</div>';
  }

  card.innerHTML = safeHTML`
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:18px; font-weight:700;">${prog.programName}</div>
      <div style="font-size:24px; font-weight:900; color:#7c3aed;">${prog.percentComplete}%</div>
    </div>
    <div style="height:6px; background:var(--surface2); border-radius:3px; margin-top:8px;">
      <div style="height:100%; background:#7c3aed; border-radius:3px; width:${prog.percentComplete}%;"></div>
    </div>
    <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:12px; color:var(--text-dim);">
      <span>Week ${prog.currentWeek + 1} / ${prog.totalWeeks}</span>
      <span>${prog.completedDays} / ${prog.totalDays} days done</span>
    </div>
    ${todayHTML}
    <button style="margin-top:10px; padding:8px 16px; border-radius:8px; border:1px solid var(--danger); background:none; color:var(--danger); font-size:12px; cursor:pointer;" onclick="if(confirm('Quit this program?')){programEngine.quitProgram();renderPrograms();renderActiveProgramBanner();}">Quit Program</button>
  `;
}

function renderProgramLibrary(filter) {
  const container = document.getElementById('programLibrary');
  if (!container || typeof programEngine === 'undefined') return;

  const programs = programEngine.getLibrary(filter);
  container.innerHTML = programs.map(p => safeHTML`
    <div class="program-card" onclick="startProgram('${p.id}')">
      <div class="prog-header">
        <span class="prog-icon">${p.icon}</span>
        ${p.premium ? '<span class="prog-badge" style="background:var(--warn);color:#000;">PREMIUM</span>' : '<span class="prog-badge" style="background:var(--accent);color:#000;">FREE</span>'}
      </div>
      <div class="prog-title">${p.name}</div>
      <div class="prog-desc">${p.description}</div>
      <div class="prog-meta">
        <span>📅 ${p.durationWeeks} weeks</span>
        <span>🔄 ${p.daysPerWeek}x/week</span>
        <span>📊 ${p.difficulty}</span>
      </div>
    </div>
  `).join('');
}

function filterPrograms(filter, btn) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderProgramLibrary(filter);
}

function startProgram(programId) {
  if (typeof programEngine === 'undefined') return;
  if (programEngine.getActiveProgram()) {
    if (!confirm('Starting a new program will replace your current one. Continue?')) return;
  }
  programEngine.startProgram(programId);
  renderPrograms();
  renderActiveProgramBanner();
}

function startProgramWorkout() {
  if (typeof programEngine === 'undefined') return;
  const todaysWorkout = programEngine.getTodaysWorkout();
  if (!todaysWorkout) return;

  // Build routine queue from program day
  audioEngine.init();
  routineQueue = todaysWorkout.exercises.slice(1).map(e => e.type);
  routineActive = true;
  const first = todaysWorkout.exercises[0];
  startWorkout(first.type);
}

// HIIT UI

let activeHIITSession = null;
let hiitTimerInterval = null;

function renderHIITLibrary() {
  const container = document.getElementById('hiitLibrary');
  if (!container || typeof HIIT_PROGRAMS === 'undefined') return;

  container.innerHTML = HIIT_PROGRAMS.map(p => safeHTML`
    <div class="hiit-card" onclick="startHIITSession('${p.id}')">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <span style="font-size:28px;">${p.icon}</span>
        <span class="hiit-badge">${p.difficulty.toUpperCase()}</span>
      </div>
      <div style="font-size:16px; font-weight:700; margin-top:8px;">${p.name}</div>
      <div style="font-size:12px; color:var(--text-dim); margin-top:4px; line-height:1.4;">${p.description}</div>
      <div style="display:flex; gap:12px; margin-top:8px; font-size:11px; color:var(--text-dim);">
        <span>⏱ ${p.duration}</span>
        <span>🔥 ~${p.calories} cal</span>
        <span>📋 ${p.type.toUpperCase()}</span>
      </div>
      <details style="margin-top:8px;">
        <summary style="font-size:11px; color:var(--accent); cursor:pointer;">Science</summary>
        <p style="font-size:11px; color:var(--text-dim); line-height:1.4; margin-top:4px;">${p.science}</p>
      </details>
    </div>
  `).join('');
}

function startHIITSession(programId) {
  if (typeof HIITSession === 'undefined') return;

  activeHIITSession = new HIITSession(programId);
  const exerciseNames = { squat:'Squats', pushup:'Push-Ups', plank:'Plank', lunge:'Lunges', shoulderpress:'Shoulder Press', deadlift:'Deadlift', mountain_climbers:'Mountain Climbers', burpees:'Burpees', jumping_jacks:'Jumping Jacks', high_knees:'High Knees', squat_jump:'Squat Jumps' };

  activeHIITSession.onPhaseChange = (phase, exercise, round) => {
    const phaseLabel = document.getElementById('hiitPhaseLabel');
    const exerciseEl = document.getElementById('hiitExercise');
    const roundEl = document.getElementById('hiitRound');
    const timerEl = document.getElementById('hiitTimer');

    if (phase === 'work') {
      phaseLabel.textContent = 'WORK';
      phaseLabel.style.color = 'var(--accent)';
      timerEl.style.color = 'var(--accent)';
      const name = typeof exercise === 'string' ? (exerciseNames[exercise] || exercise) : (exerciseNames[exercise.type] || exercise.type);
      exerciseEl.textContent = name;
    } else if (phase === 'rest') {
      phaseLabel.textContent = 'REST';
      phaseLabel.style.color = 'var(--warn)';
      timerEl.style.color = 'var(--warn)';
      exerciseEl.textContent = 'Breathe...';
    } else if (phase === 'roundRest') {
      phaseLabel.textContent = 'ROUND REST';
      phaseLabel.style.color = 'var(--warn)';
      timerEl.style.color = 'var(--warn)';
      exerciseEl.textContent = 'Next round coming up...';
    }
    roundEl.textContent = `Round ${round + 1} / ${activeHIITSession.program.rounds || activeHIITSession.program.totalRounds || '∞'}`;
  };

  activeHIITSession.onTick = (timeLeft) => {
    document.getElementById('hiitTimer').textContent = timeLeft;
    // Audio cue for last 3 seconds of work
    if (activeHIITSession.phase === 'work' && timeLeft <= 3 && timeLeft > 0) {
      audioEngine.speak(String(timeLeft), 'high');
    }
  };

  activeHIITSession.onComplete = async (stats) => {
    if (hiitTimerInterval) { clearInterval(hiitTimerInterval); hiitTimerInterval = null; }

    // Save to database
    try {
      const program = activeHIITSession.program;
      await physioRepDB.saveWorkout({
        exercise: program.name,
        exerciseType: 'hiit_' + program.id,
        reps: stats.roundsCompleted,
        duration: Math.round(activeHIITSession.totalTimer),
        formScore: null,
        formIssues: {},
        plankHoldTime: null,
        rom: null,
        milestones: [],
        hiitStats: {
          programId: program.id,
          programName: program.name,
          type: program.type,
          totalWorkTime: stats.totalWorkTime,
          totalRestTime: stats.totalRestTime,
          exercisesCompleted: stats.exercisesCompleted,
          estimatedCalories: stats.estimatedCalories
        }
      });
    } catch (err) {
      console.error('Failed to save HIIT workout:', err);
    }

    // Show completion UI
    const el = document.getElementById('hiitTimer');
    if (el) el.textContent = 'DONE!';
    const phaseLabel = document.getElementById('hiitPhaseLabel');
    if (phaseLabel) { phaseLabel.textContent = 'COMPLETE'; phaseLabel.style.color = 'var(--accent)'; }
    audioEngine.playSuccessChime();
    audioEngine.speak(`HIIT complete! ${stats.roundsCompleted} rounds, approximately ${stats.estimatedCalories} calories burned.`, 'high');
  };

  showScreen('hiitActive');
  audioEngine.init();
  activeHIITSession.start();

  hiitTimerInterval = setInterval(() => {
    activeHIITSession.tick(1);
  }, 1000);
}

function toggleHIITPause() {
  if (!activeHIITSession) return;
  const paused = activeHIITSession.togglePause();
  document.getElementById('hiitPauseBtn').textContent = paused ? '▶' : '⏸';
}

async function stopHIIT() {
  if (!activeHIITSession) return;
  if (hiitTimerInterval) { clearInterval(hiitTimerInterval); hiitTimerInterval = null; }

  // Save HIIT workout to database
  try {
    const stats = activeHIITSession.stats;
    const program = activeHIITSession.program;
    await physioRepDB.saveWorkout({
      exercise: program.name,
      exerciseType: 'hiit_' + program.id,
      reps: stats.roundsCompleted,
      duration: Math.round(activeHIITSession.totalTimer),
      formScore: null,
      formIssues: {},
      plankHoldTime: null,
      rom: null,
      milestones: [],
      hiitStats: {
        programId: program.id,
        programName: program.name,
        type: program.type,
        totalWorkTime: stats.totalWorkTime,
        totalRestTime: stats.totalRestTime,
        exercisesCompleted: stats.exercisesCompleted,
        estimatedCalories: stats.estimatedCalories
      }
    });
  } catch (err) {
    console.error('Failed to save HIIT workout:', err);
  }

  activeHIITSession = null;
  showScreen('home');
}

// ANALYTICS UI

async function renderAnalytics() {
  if (typeof analyticsEngine === 'undefined' || typeof physioRepDB === 'undefined') return;

  const workouts = await physioRepDB.getWorkouts();
  const data = analyticsEngine.compute(workouts);

  // Fitness Score
  const scoreEl = document.getElementById('fitnessScoreValue');
  const tierEl = document.getElementById('fitnessScoreTier');
  const breakdownEl = document.getElementById('fitnessScoreBreakdown');
  if (scoreEl) {
    scoreEl.textContent = data.fitnessScore.total;
    scoreEl.style.color = data.fitnessScore.tierColor;
  }
  if (tierEl) {
    tierEl.textContent = data.fitnessScore.tier;
    tierEl.style.color = data.fitnessScore.tierColor;
  }
  if (breakdownEl) {
    const b = data.fitnessScore.breakdown;
    breakdownEl.innerHTML = safeHTML`
      <div><div style="color:var(--text);">${b.consistency}</div><div style="color:var(--text-dim);">Consistency</div></div>
      <div><div style="color:var(--text);">${b.form}</div><div style="color:var(--text-dim);">Form</div></div>
      <div><div style="color:var(--text);">${b.volume}</div><div style="color:var(--text-dim);">Volume</div></div>
      <div><div style="color:var(--text);">${b.variety}</div><div style="color:var(--text-dim);">Variety</div></div>
    `;
  }

  // Heatmap
  const heatmapEl = document.getElementById('heatmapGrid');
  if (heatmapEl && data.frequencyMap.length > 0) {
    heatmapEl.innerHTML = data.frequencyMap.map(cell =>
      safeHTML`<div class="heatmap-cell l${cell.level}" title="${cell.date}: ${cell.count} workouts"></div>`
    ).join('');
  }

  // Body Radar
  const radarEl = document.getElementById('bodyRadarChart');
  if (radarEl) {
    const colors = { Legs: '#34d399', Chest: '#60a5fa', Core: '#f59e0b', Shoulders: '#c084fc', Back: '#f87171', Arms: '#fb923c' };
    radarEl.innerHTML = Object.entries(data.bodyRadar).map(([area, score]) =>
      safeHTML`<div class="radar-row">
        <span class="radar-label">${area}</span>
        <div class="radar-bar"><div class="radar-fill" style="width:${score}%; background:${colors[area] || 'var(--accent)'}"></div></div>
        <span class="radar-value" style="color:${colors[area] || 'var(--accent)'}">${score}</span>
      </div>`
    ).join('');
  }

  // Flexibility
  const flexEl = document.getElementById('flexScores');
  if (flexEl) {
    const flex = data.flexibilityScores;
    if (flex.overall !== null && flex.overall !== undefined) {
      const items = Object.entries(flex).filter(([k]) => k !== 'overall').map(([key, val]) =>
        safeHTML`<div class="radar-row">
          <span class="radar-label">${key.replace(/_/g, ' ')}</span>
          <div class="radar-bar"><div class="radar-fill" style="width:${val.score}%; background:var(--accent)"></div></div>
          <span class="radar-value">${val.label}</span>
        </div>`
      );
      flexEl.innerHTML = items.join('') + safeHTML`<div style="text-align:center; margin-top:8px; font-size:14px; font-weight:700; color:var(--accent);">Overall: ${flex.overall}/100</div>`;
    } else {
      flexEl.innerHTML = '<div style="font-size:12px; color:var(--text-dim);">Complete more workouts to unlock flexibility scores.</div>';
    }
  }

  // Volume
  const volEl = document.getElementById('volumeStats');
  if (volEl) {
    const v = data.volumeStats;
    const arrow = v.weekOverWeekChange >= 0 ? '↑' : '↓';
    const color = v.weekOverWeekChange >= 0 ? 'var(--accent)' : 'var(--danger)';
    volEl.innerHTML = safeHTML`
      <div style="font-size:36px; font-weight:900; color:var(--accent);">${v.thisWeekReps} <span style="font-size:14px; color:var(--text-dim);">reps</span></div>
      <div style="font-size:13px; color:${color}; margin-top:4px;">${arrow} ${Math.abs(v.weekOverWeekChange)}% vs last week (${v.lastWeekReps} reps)</div>
      <div style="font-size:12px; color:var(--text-dim); margin-top:8px;">All time: ${v.totalAllTime} reps across ${v.totalSessions} sessions</div>
    `;
  }

  // Recommendations
  const recEl = document.getElementById('recommendationsList');
  if (recEl && typeof RecommendationEngine !== 'undefined') {
    const pbs = typeof voiceCoach !== 'undefined' ? voiceCoach.getAllPersonalBests() : {};
    const recs = RecommendationEngine.generate(workouts, pbs, data.bodyRadar);
    let html = '';
    if (recs.todaysWorkout) {
      const exerciseNames = { squat:'Squats', pushup:'Push-Ups', plank:'Plank', lunge:'Lunges', shoulderpress:'Shoulder Press', deadlift:'Deadlift' };
      html += `<div style="background:var(--surface2); border-radius:8px; padding:10px; margin-bottom:8px;">
        <div style="font-size:11px; color:var(--accent); font-weight:600;">TODAY'S SUGGESTED WORKOUT</div>
        <div style="font-size:14px; font-weight:600; margin-top:4px;">${recs.todaysWorkout.exercises.map(e => exerciseNames[e] || e).join(' → ')}</div>
        <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">${recs.todaysWorkout.reason}</div>
      </div>`;
    }
    if (recs.weakAreas.length > 0) {
      html += `<div style="margin-bottom:8px; font-size:12px;"><strong>Weak areas:</strong> ${recs.weakAreas.map(w => `${w.area} (${w.score}/100)`).join(', ')}</div>`;
    }
    if (recs.tips.length > 0) {
      html += recs.tips.map(t => `<div style="font-size:12px; color:var(--text-dim); margin-bottom:4px;">💡 ${t}</div>`).join('');
    }
    recEl.innerHTML = html || '<div style="font-size:12px; color:var(--text-dim);">Complete a few workouts to unlock personalized recommendations.</div>';
  }
}

// VIDEO UPLOAD UI

let uploadedVideoFile = null;

function handleVideoUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  uploadedVideoFile = file;

  document.getElementById('videoAnalysisSetup').style.display = 'block';
  document.getElementById('videoFileName').textContent = file.name;
  document.getElementById('videoMeta').textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  document.getElementById('videoProgressArea').style.display = 'none';
  document.getElementById('videoResultsArea').style.display = 'none';
}

async function startVideoAnalysis() {
  if (!uploadedVideoFile || typeof videoAnalyzer === 'undefined') return;

  const exerciseType = document.getElementById('videoExerciseSelect').value;
  document.getElementById('startAnalysisBtn').disabled = true;
  document.getElementById('videoProgressArea').style.display = 'block';

  try {
    await videoAnalyzer.loadVideo(uploadedVideoFile);

    videoAnalyzer.onProgress = (pct) => {
      document.getElementById('videoProgressBar').style.width = pct + '%';
      document.getElementById('videoProgressPct').textContent = pct + '%';
    };

    // We need the pose detector. If it's not initialized, tell the user.
    if (typeof pose === 'undefined' || !pose) {
      // Initialize pose for video analysis
      await initPose();
    }

    await videoAnalyzer.analyze(exerciseType, pose);
    const report = videoAnalyzer.getReport();

    // Save video analysis results to database
    try {
      await physioRepDB.saveWorkout({
        exercise: report.exercise + ' (Video Analysis)',
        exerciseType: report.exercise,
        reps: report.reps,
        duration: Math.round(report.duration),
        formScore: report.formScore,
        formIssues: report.issuesFound.reduce((acc, i) => {
          acc[i.issue] = i.severity;
          return acc;
        }, {}),
        plankHoldTime: null,
        rom: null,
        milestones: [],
        source: 'video_analysis',
        videoName: uploadedVideoFile.name,
        framesAnalyzed: report.framesAnalyzed
      });
    } catch (err) {
      console.error('Failed to save video analysis:', err);
    }

    renderVideoResults(report);
  } catch (err) {
    alert('Analysis failed: ' + err.message);
  }

  document.getElementById('startAnalysisBtn').disabled = false;
}

function renderVideoResults(report) {
  if (!report) return;
  const container = document.getElementById('videoResultsArea');
  container.style.display = 'block';

  const formClass = report.formScore >= 80 ? 'good' : report.formScore >= 60 ? 'ok' : 'bad';

  // Build form score timeline bar
  const timelineBarHTML = report.timeline.length > 0 ? (() => {
    const timelineBars = [];
    let lastScore = 80;
    const segmentCount = Math.max(3, Math.min(10, Math.floor(report.duration / 5)));
    const segmentDuration = report.duration / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
      const startTime = i * segmentDuration;
      const endTime = (i + 1) * segmentDuration;
      const segmentEvents = report.timeline.filter(e => e.time >= startTime && e.time < endTime);
      const avgScore = segmentEvents.length > 0
        ? Math.round(segmentEvents.reduce((sum, e) => sum + (e.type === 'good' ? 85 : e.type === 'bad' ? 40 : 70), 0) / segmentEvents.length)
        : lastScore;

      let barColor = 'var(--accent)';
      if (avgScore < 60) barColor = '#ef4444';
      else if (avgScore < 75) barColor = 'var(--warn)';

      timelineBars.push(`<div style="flex:1; height:6px; background:${barColor}; border-radius:2px; margin:0 2px;"></div>`);
      lastScore = avgScore;
    }

    return `
      <div style="margin-top:16px;">
        <div style="font-size:12px; color:var(--text-dim); margin-bottom:8px; font-weight:600;">Form Quality Timeline</div>
        <div style="display:flex; gap:0; align-items:center;">
          ${timelineBars.join('')}
        </div>
        <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-dim); margin-top:4px;">
          <span>0s</span>
          <span>${Math.round(report.duration / 2)}s</span>
          <span>${report.duration}s</span>
        </div>
      </div>
    `;
  })() : '';

  // Key moments (best and worst)
  const keyMomentsHTML = report.highlights && report.highlights.length > 0 ? (() => {
    const bestHighlight = report.highlights.find(h => h.type === 'best');
    const issueHighlights = report.highlights.filter(h => h.type === 'issue').slice(0, 2);

    let content = '<div style="margin-top:16px;"><div style="font-size:12px; color:var(--text-dim); margin-bottom:8px; font-weight:600;">Key Moments</div>';

    if (bestHighlight) {
      content += `
        <div style="background:rgba(34,197,94,0.1); border-left:3px solid var(--accent); padding:10px 12px; margin-bottom:8px; border-radius:4px;">
          <div style="font-size:12px; font-weight:600; color:var(--accent);">✓ Best Form</div>
          <div style="font-size:11px; color:var(--text); margin-top:4px;">${bestHighlight.message}</div>
          <div style="font-size:10px; color:var(--text-dim); margin-top:4px;">@ ${bestHighlight.time.toFixed(1)}s</div>
        </div>
      `;
    }

    issueHighlights.forEach(h => {
      content += `
        <div style="background:rgba(239,68,68,0.1); border-left:3px solid var(--danger); padding:10px 12px; margin-bottom:8px; border-radius:4px;">
          <div style="font-size:12px; font-weight:600; color:var(--danger);">⚠ Form Issue</div>
          <div style="font-size:11px; color:var(--text); margin-top:4px;">${h.message}</div>
          <div style="font-size:10px; color:var(--text-dim); margin-top:4px;">@ ${h.time.toFixed(1)}s</div>
        </div>
      `;
    });

    content += '</div>';
    return content;
  })() : '';

  // Issue breakdown bar chart
  const issueBreakdownHTML = report.issuesFound && report.issuesFound.length > 0 ? (() => {
    const maxCount = Math.max(...report.issuesFound.map(i => i.count));
    return `
      <div style="margin-top:16px;">
        <div style="font-size:12px; color:var(--text-dim); margin-bottom:8px; font-weight:600;">Issue Frequency</div>
        ${report.issuesFound.slice(0, 4).map(i => {
          const percent = (i.count / maxCount) * 100;
          const colorMap = { frequent: '#ef4444', occasional: 'var(--warn)', rare: 'var(--accent)' };
          const color = colorMap[i.severity] || 'var(--surface2)';
          return `
            <div style="margin-bottom:10px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-size:11px; color:var(--text);">${i.issue}</span>
                <span style="font-size:10px; color:var(--text-dim);">${i.count} frames</span>
              </div>
              <div style="width:100%; height:6px; background:var(--surface2); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${percent}%; background:${color};"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  })() : '';

  // Recommendations
  const recsHTML = report.recommendations && report.recommendations.length > 0 ? `
    <div style="margin-top:16px;">
      <div style="font-size:12px; color:var(--text-dim); margin-bottom:8px; font-weight:600;">Recommendations</div>
      ${report.recommendations.slice(0, 4).map(r => `
        <div style="background:var(--surface2); padding:10px 12px; margin-bottom:8px; border-radius:6px; font-size:12px; line-height:1.4;">
          💡 ${r}
        </div>
      `).join('')}
    </div>
  ` : '';

  // Export/Share buttons
  const exportShareHTML = `
    <div style="margin-top:16px; display:flex; gap:10px;">
      <button style="flex:1; padding:10px 12px; background:var(--surface2); border:1px solid var(--surface3); border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; color:var(--text);" onclick="downloadVideoReport('${report.exercise}', '${report.formScore}')">
        📥 Download Report
      </button>
      <button style="flex:1; padding:10px 12px; background:var(--surface2); border:1px solid var(--surface3); border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; color:var(--text);" onclick="shareVideoReport()">
        📤 Share
      </button>
    </div>
  `;

  // Main results container
  container.innerHTML = safeHTML`
    <div style="background:var(--surface); border-radius:var(--radius); padding:16px; max-width:100%;">
      <div style="font-size:18px; font-weight:800; margin-bottom:12px;">Analysis Results</div>

      <!-- Key stats -->
      <div class="stat-row"><span class="stat-label">Exercise</span><span class="stat-value">${report.exercise}</span></div>
      <div class="stat-row"><span class="stat-label">Reps Detected</span><span class="stat-value">${report.reps}</span></div>
      <div class="stat-row"><span class="stat-label">Form Score</span><span class="stat-value ${formClass}">${report.formScore}%</span></div>
      <div class="stat-row"><span class="stat-label">Duration</span><span class="stat-value">${report.duration}s</span></div>

      ${timelineBarHTML}
      ${keyMomentsHTML}
      ${issueBreakdownHTML}
      ${recsHTML}
      ${exportShareHTML}
    </div>
  `;
}

function downloadVideoReport(exercise, score) {
  const timestamp = new Date().toLocaleString();
  const reportText = `PhysioRep Video Analysis Report\n\nExercise: ${exercise}\nForm Score: ${score}%\nAnalyzed: ${timestamp}\n\nView full details in the app.`;
  const blob = new Blob([reportText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PhysioRep_${exercise}_${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function shareVideoReport() {
  alert('Share functionality: copy link to clipboard or send via email. (Share feature coming soon)');
}

// MOBILITY / RECOVERY UI

function renderMobilityRoutines() {
  const container = document.getElementById('mobilityRoutines');
  if (!container || typeof MOBILITY_ROUTINES === 'undefined') return;

  container.innerHTML = Object.entries(MOBILITY_ROUTINES).map(([key, r]) => safeHTML`
    <div class="program-card" onclick="startMobilitySession('${key}')">
      <div style="font-size:16px; font-weight:700;">${r.name}</div>
      <div style="font-size:12px; color:var(--text-dim); margin-top:4px; line-height:1.4;">${r.description}</div>
      <div style="display:flex; gap:12px; margin-top:8px; font-size:11px; color:var(--text-dim);">
        <span>⏱ ${r.duration}</span>
        <span>🧘 ${r.stretches.length} stretches</span>
      </div>
    </div>
  `).join('');
}

let activeRecoverySession = null;
let recoveryInterval = null;

function startMobilitySession(routineKey) {
  if (typeof RecoverySession === 'undefined') return;

  activeRecoverySession = new RecoverySession(routineKey);
  showCurrentStretch();
}

function showCurrentStretch() {
  if (!activeRecoverySession) return;

  const stretch = activeRecoverySession.getCurrentStretch();
  if (!stretch) {
    // Session complete
    const summary = activeRecoverySession.getSummary();
    alert(`Mobility Complete!\n\n${summary.stretchesCompleted} stretches\n${summary.totalHoldTime}s total hold time`);
    activeRecoverySession = null;
    showScreen('home');
    return;
  }

  // Use the guided overlay for stretch display
  const overlay = document.getElementById('guidedOverlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  document.getElementById('guidedProgress').textContent = `${stretch.index + 1} / ${stretch.total}`;
  document.getElementById('guidedIcon').textContent = '🧘';
  document.getElementById('guidedName').textContent = stretch.name + (stretch.sideLabel ? ` (${stretch.sideLabel})` : '');
  document.getElementById('guidedDesc').innerHTML = safeHTML`
    ${stretch.description}<br>
    <span style="color:var(--accent); font-size:12px; cursor:pointer;" onclick="showExerciseScience('${stretch.id}')">📖 Why this stretch?</span>
  `;
  document.getElementById('guidedTime').textContent = stretch.holdSec;

  // Start hold countdown
  let remaining = stretch.holdSec;
  activeRecoverySession.startHold();

  if (recoveryInterval) clearInterval(recoveryInterval);
  recoveryInterval = setInterval(() => {
    remaining--;
    document.getElementById('guidedTime').textContent = Math.max(0, remaining);

    if (remaining <= 3 && remaining > 0) {
      audioEngine.speak(String(remaining), 'high');
    }

    if (remaining <= 0) {
      clearInterval(recoveryInterval);
      recoveryInterval = null;
      audioEngine.playSuccessChime();

      if (activeRecoverySession.advance()) {
        setTimeout(() => showCurrentStretch(), 500);
      } else {
        showCurrentStretch(); // Will trigger completion
      }
    }
  }, 1000);
}

// EXERCISE SCIENCE MODAL

function showExerciseScience(exerciseId) {
  const modal = document.getElementById('scienceModal');
  if (!modal) return;

  // Check exercise library first, then stretch library
  let science = null;
  let name = exerciseId;

  if (typeof EXERCISE_CATALOG !== 'undefined' && EXERCISE_CATALOG[exerciseId]) {
    science = EXERCISE_CATALOG[exerciseId].science;
    name = EXERCISE_CATALOG[exerciseId].name;
  } else if (typeof STRETCH_LIBRARY !== 'undefined' && STRETCH_LIBRARY[exerciseId]) {
    const stretch = STRETCH_LIBRARY[exerciseId];
    science = { summary: stretch.science };
    name = stretch.name;
  }

  if (!science) return;

  document.getElementById('scienceModalTitle').textContent = name;

  let html = '';
  if (science.summary) html += `<div class="science-section"><h4>Overview</h4><p>${science.summary}</p></div>`;
  if (science.muscles) html += `<div class="science-section"><h4>Muscles</h4><p>${science.muscles}</p></div>`;
  if (science.biomechanics) html += `<div class="science-section"><h4>Biomechanics</h4><p>${science.biomechanics}</p></div>`;
  if (science.benefits) html += `<div class="science-section"><h4>Benefits</h4><p>${science.benefits}</p></div>`;
  if (science.commonMistakes) html += `<div class="science-section"><h4>Common Mistakes</h4><p>${science.commonMistakes}</p></div>`;

  document.getElementById('scienceModalContent').innerHTML = html;
  modal.style.display = 'flex';
}

function closeScienceModal() {
  const modal = document.getElementById('scienceModal');
  if (modal) modal.style.display = 'none';
}

// PWA INSTALL

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBanner').classList.add('show');
});

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((_choiceResult) => {
    document.getElementById('installBanner').classList.remove('show');
    deferredPrompt = null;
  });
}

window.addEventListener('appinstalled', () => {
  document.getElementById('installBanner').classList.remove('show');
});

// SERVICE WORKER

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(_reg => console.log('SW registered'))
      .catch(_err => console.log('SW registration failed'));
  });
}
