# PhysioRep — Complete Project Documentation

## Overview

PhysioRep is a Progressive Web App (PWA) that uses camera-based pose estimation (MediaPipe Pose) to track exercise form, count reps, and provide voice coaching. It targets home fitness users, physical therapy patients, and gym-goers who want live form feedback.

**Tech stack:** Vanilla JS (no framework), MediaPipe Pose (CDN), IndexedDB, Web Speech API, Web Audio API, Service Worker (offline PWA).

---

## Architecture

```
index.html              — Single-page app shell, all screens, CSS
src/
  exercise-engine.js    — Core: rep counting, form scoring, state machines (6 exercises)
  exercise-library.js   — Extended catalog: 18 exercises with science, multi-angle support
  audio.js              — Web Speech API + tone generation for voice feedback
  voice-coach.js        — Smart coaching layer on top of audio (form cues, pacing, PRs)
  db.js                 — IndexedDB wrapper (workouts, PT programs, pain, routines, metrics)
  achievements.js       — Badge/achievement system
  pt-mode.js            — Physical therapy compliance tracking + pain tracker
  vitals.js             — Camera-based heart rate (rPPG) + breathing rate
  challenges.js         — Social challenges and leaderboard system
  programs.js           — Structured multi-week workout programs
  analytics.js          — Fitness score, trends, body radar, flexibility scores
  recovery.js           — Guided stretching/mobility routines with science
  hiit.js               — HIIT session engine (Tabata, EMOM, AMRAP, circuits)
  video-analyzer.js     — Upload video → frame-by-frame form analysis
  app.js                — Main application: screen management, integration glue
sw.js                   — Service worker (cache-first PWA)
manifest.json           — PWA manifest
tests/                  — Jest test suites (82 tests)
```

---

## Module Reference

### 1. exercise-engine.js (Core)

**Purpose:** Real-time rep counting and form evaluation using MediaPipe Pose landmarks.

**Supported exercises (full state machine):**
- Squat, Push-Up, Plank, Lunge, Shoulder Press, Deadlift

**Key classes:**
- `ExerciseTracker(exerciseType)` — Instantiated per workout session
  - `.processFrame(landmarks)` → `{ reps, feedback: { message, type }, formScore, plankHoldTime }`
  - `.getSummary()` → Full workout summary with ROM, milestones, form issues
  - `.getFormScore()` → 0-100 percentage

**Form evaluation approach:**
- Joint angle calculation via `calculateAngle(a, b, c)` — 3-point angle in degrees
- State machine per exercise: e.g., squat goes `standing → descending → bottom → ascending → standing` (= 1 rep)
- Form checks run per-frame and flag issues with counts (e.g., `{ 'Knee valgus': 3 }`)
- ROM tracking: records all joint angles over time, computes peak/min/range

**Exports:** `calculateAngle`, `getLandmark`, `landmarksVisible`, `ExerciseTracker`, `EXERCISES`, `LANDMARKS`

---

### 2. exercise-library.js

**Purpose:** Comprehensive exercise catalog with science, multi-angle camera support, and modifications.

**18 exercises cataloged:** squat, pushup, plank, lunge, shoulderpress, deadlift, wall_sit, glute_bridge, mountain_climbers, burpees, jumping_jacks, high_knees, squat_jump, superman, calf_raises, tricep_dip, side_plank, bicycle_crunch

**Each entry contains:**
- `muscles: { primary, secondary }` — Specific muscle names
- `cameraAngles` — Which angles work (`'side'`, `'front'`, `'45deg'`)
- `bestAngle` — Recommended camera position
- `angleNotes` — What each angle is good for
- `science: { summary, muscles, biomechanics, benefits, commonMistakes }` — Cited research
- `modifications: { easier, harder }` — Progression/regression options

**Angle profiles:** `ANGLE_PROFILES` describes what each camera angle captures.

**RecommendationEngine:**
- `RecommendationEngine.generate(workoutHistory, personalBests, bodyRadar)` → `{ todaysWorkout, weakAreas, tips }`
- Suggests exercises based on neglected muscle groups and recent activity
- Form improvement tips when scores are low
- Volume recommendations based on weekly frequency

**Exports:** `EXERCISE_CATALOG`, `ANGLE_PROFILES`, `RecommendationEngine`, `getExerciseName`, `getExerciseScience`, `getExerciseModifications`

---

### 3. audio.js

**Purpose:** Voice feedback and sound effects using Web Speech API + Web Audio API.

**Key class: `AudioEngine`**
- `.speak(message, priority)` — TTS with throttling (2.5s min between same message)
- `.announceRep(count)` — Says the rep number
- `.announceFormFeedback(message, type)` — Form corrections (high priority for 'bad')
- `.announceMilestone(message)` — Rep milestones
- `.countdown()` — 3-2-1-Go beep sequence
- `.playSuccessChime()` — C-E-G arpeggio
- `.playWarningTone()` — Low warning buzz

**Singleton:** `audioEngine`

---

### 4. voice-coach.js

**Purpose:** Smart coaching layer that generates contextual, personality-rich voice cues.

**Key class: `VoiceCoach`**
- `.onRep(repData, audio)` — Process a rep: generates form cues, pacing feedback, milestones, or motivation
- `.onPlankUpdate(holdData, audio)` — Time milestones and form cues during plank
- `.onWorkoutEnd(summary, audio)` → Checks for personal bests, celebratory callout
- `.getPersonalBests(exerciseType)` — PR tracking per exercise, optionally per weight
- `.setWeight(lbs)` — Track what weight the user is using
- `.coachingLevel` — `'minimal'`, `'standard'`, `'chatty'`

**Coaching cue types (all throttled):**
1. Form corrections (5s throttle) — "Go deeper!", "Knees behind toes!"
2. Pacing (8s throttle) — "Slow and controlled!" or "Push through!"
3. Milestones (immediate) — "Ten reps!", "Twenty five! Beast mode!"
4. Motivation (15s throttle) — "Nice!", "Perfect!", "Textbook!"

**Personal best tracking:** Stored in localStorage (`physiorep_personal_bests`), keyed by exercise type optionally with weight (e.g., `squat_135lbs`).

**Singleton:** `voiceCoach`

---

### 5. db.js

**Purpose:** IndexedDB persistence layer. Version 4.

**Stores:**
- `workouts` — Indexed by `date` and `exerciseType`
- `ptPrograms` — PT prescriptions, indexed by `active`
- `painEntries` — Pain scale entries, indexed by `date` and `context`
- `customRoutines` — User-built routines
- `bodyMetrics` — Weight/measurement tracking

**Key class: `PhysioRepDB`**
- `.saveWorkout(data)` / `.getWorkouts(limit)` / `.getWorkoutsByExercise(type)`
- `.getExerciseStats(type)` → `{ totalSessions, totalReps, avgFormScore, bestFormScore }`
- `.savePTProgram()` / `.getActivePTProgram()`
- `.savePainEntry()` / `.getPainEntries()`
- `.saveRoutine()` / `.getRoutines()` / `.deleteRoutine()`
- `.saveMetric()` / `.getMetrics()`
- `.clearAll()`

**Singleton:** `physioRepDB`

---

### 6. programs.js

**Purpose:** Structured multi-week training programs with progressive overload.

**5 programs:**
1. **Beginner Strength** (free) — 4 weeks, 3 days/week
2. **4-Week Knee Rehab** (premium) — 4 weeks, 4 days/week, knee-focused
3. **Upper Body Builder** (premium) — 3 weeks, 3 days/week
4. **Post-Surgery Recovery** (premium) — 4 weeks, 3 days/week, ultra-gentle
5. **Full Body Shred** (premium) — 3 weeks, 4 days/week, advanced

**Key class: `ProgramEngine`**
- `.startProgram(id)` — Begin a program, save to localStorage
- `.getTodaysWorkout()` → `{ week, day, weekLabel, exercises }`
- `.completeDay(workoutIds)` — Advance to next day
- `.skipDay()` — Skip without completing
- `.isComplete()` — Check if all weeks done
- `.getProgress()` → `{ programName, currentWeek, percentComplete, ... }`
- `.getLibrary(filter)` — Browse available programs

**Storage:** localStorage key `physiorep_active_program`

**Singleton:** `programEngine`

---

### 7. analytics.js

**Purpose:** Transform workout history into visual insights and gamified scores.

**Key class: `AnalyticsEngine`**
- `.compute(workouts)` → Full analytics payload:

**Fitness Score (0-1000):**
- Consistency (40%): Active days in last 30 days
- Form quality (30%): Average form score
- Volume (20%): Weekly rep count
- Variety (10%): Unique exercise types used
- Tiers: Starter → Beginner → Intermediate → Advanced → Elite

**Other analytics:**
- `formTrends` — Per-exercise form score over time with 3-session moving average
- `frequencyMap` — 84-day (12-week) activity heatmap (GitHub-style)
- `personalRecords` — Max reps, best form, longest plank per exercise
- `bodyRadar` — Strength score per body area (Legs, Chest, Core, Shoulders, Back, Arms) 0-100
- `streakStats` — Current/longest streak, this week/month counts
- `volumeStats` — This week vs last week reps, all-time totals
- `flexibilityScores` — Squat depth, shoulder mobility, hamstring flexibility from ROM data
- `weekOverWeek` — 8-week trend of sessions, reps, avg form

**Singleton:** `analyticsEngine`

---

### 8. recovery.js

**Purpose:** Guided stretching and mobility routines with science-backed hold times.

**10 stretches:** quad, hamstring, hip flexor, calf, chest, shoulder cross-body, tricep, cat-cow, child's pose, spinal twist

**Each stretch has:** name, body area, hold time (25-45s), bilateral flag, description, science citation, coaching cues, detection function ID

**6 mobility routines:**
- Pre-Squat Warmup, Pre-Push-Up Warmup, Pre-Deadlift Warmup
- Post-Workout Cooldown, Morning Mobility, Full Flexibility Session

**Helper:** `getWarmupRecommendation(exerciseType)` — Auto-suggest warmup based on planned exercise

**Key class: `RecoverySession(routineKey)`**
- `.getCurrentStretch()` — Current stretch with side info
- `.startHold()` / `.updateHold(dt)` — Hold timer with completion tracking
- `.advance()` — Next stretch (handles bilateral sides)
- `.getSummary()` — Total hold time, stretches completed

---

### 9. hiit.js

**Purpose:** HIIT session management with interval timers.

**7 HIIT programs:**
1. Classic Tabata (20/10 × 8)
2. Tabata Lite (20/20 × 8)
3. EMOM 10 (60s rounds)
4. AMRAP 15 (as many rounds as possible)
5. Full Body Circuit (45/15 × 6 exercises × 3 rounds)
6. Cardio Blast (30/15 × 12)
7. Beginner Intervals (30/30 × 8)

Each has science citations for why the protocol works.

**Key class: `HIITSession(programId)`**
- `.start()` — Begin session
- `.tick(dt)` — Call every second; auto-transitions phases
- `.togglePause()` — Pause/resume
- `.amrapComplete()` — For AMRAP: mark exercise done, track rounds
- `.getCurrentInfo()` → `{ phase, exercise, round, timeLeft }`
- Callbacks: `onPhaseChange`, `onTick`, `onComplete`

**Helper:** `estimateCalories(exerciseType, durationSec, reps, bodyWeightKg)` — MET-based calorie estimation

---

### 10. video-analyzer.js

**Purpose:** Upload a recorded workout video for frame-by-frame form analysis.

**Key class: `VideoAnalyzer`**
- `.loadVideo(file)` → `{ duration, width, height, name, size }`
- `.analyze(exerciseType, poseDetector)` → Full analysis results
- `.getReport()` → Formatted report with issues, recommendations, timeline, highlights
- `.cancel()` — Stop mid-analysis
- `.dispose()` — Clean up resources

**Analysis process:**
1. Load video file → create `<video>` element
2. Step through frames at 100ms intervals
3. Draw each frame to offscreen canvas
4. Run MediaPipe Pose detection
5. Feed landmarks into ExerciseTracker
6. Build timeline of form events
7. Find highlights (best form, worst moments)
8. Generate recommendations

**Singleton:** `videoAnalyzer`

---

### 11. vitals.js

**Purpose:** Camera-based heart rate (rPPG) and breathing rate estimation.

**rPPG approach:**
- Extract green channel mean from cheek ROI (face area via nose + eye landmarks)
- Uses offscreen canvas reading from `<video>` element (NOT skeleton canvas)
- Butterworth IIR bandpass filter (0.75-3.0 Hz)
- Peak detection on filtered signal
- Confidence-gated display (only shows when > 0.2)

**Breathing rate:**
- Shoulder landmark Y-position oscillation tracking
- Only reliable during low-motion exercises (plank)

**Key class: `VitalsMonitor`**
- `.processFrame(canvas, video, landmarks)` — Feed each frame
- `.getSummary()` → `{ heartRate, breathingRate, confidence, ... }`
- `.getDiagnostics()` — Raw signal data for nerd mode

**Singleton:** `vitalsMonitor`

---

### 12. challenges.js

**Purpose:** Social challenges, friend codes, and leaderboard.

**11 challenge templates:** 4 daily (rotating by day-of-year), 4 weekly, 3 monthly

**Key class: `ChallengeEngine`**
- `.refreshChallenges()` — Generate new challenges
- `.updateProgress(workoutData)` — After each workout
- `.getActiveChallenges()` — Current challenges with progress
- `.getLeaderboard()` — Simulated leaderboard
- `.addFriend(code)` / `.removeFriend(code)` — Friend system
- `.shareChallenge()` / `.shareWeeklyStats()` — Web Share API

**Storage:** localStorage keys `physiorep_challenges`, `physiorep_friends`, `physiorep_mycode`

**Singleton:** `challengeEngine`

---

### 13. achievements.js

**Purpose:** Badge/achievement system that unlocks based on workout history.

**Key exports:** `achievementEngine`, `BADGES`, `computeAchievementStats`

---

### 14. pt-mode.js

**Purpose:** Physical therapy compliance tracking, pain logging, and shareable reports.

**Key classes:**
- `PTProgram` — Prescription tracker with per-exercise compliance percentages
- `PainTracker` — 0-10 pain scale with trend analysis and pre/post workout comparisons
- `ComplianceReport` — Generates shareable reports for PTs/insurance

---

## Data Flow

```
Camera → MediaPipe Pose → landmarks →
  ExerciseTracker.processFrame() → { reps, feedback, formScore } →
    VoiceCoach.onRep() → AudioEngine.speak() → speaker
    showFeedback() → UI overlay
    vitalsMonitor.processFrame() → heart rate display

stopWorkout() →
  ExerciseTracker.getSummary() → PhysioRepDB.saveWorkout() → IndexedDB
  VoiceCoach.onWorkoutEnd() → PR detection
  ChallengeEngine.updateProgress()
  checkAchievements()

Analytics →
  PhysioRepDB.getWorkouts() → AnalyticsEngine.compute() → dashboard render

Video Upload →
  File → <video> → frame stepping → MediaPipe Pose → ExerciseTracker → report
```

---

## UI Structure

**Screens (in index.html):**
1. `#onboarding` — 5-step first-use walkthrough
2. `#home` — Exercise grid, programs banner, HIIT/analytics/video cards, tab bar
3. `#workout` — Camera view with skeleton, HUD, form feedback, vitals badges
4. `#summary` — Post-workout results with progressive disclosure (Simple/Standard/Nerd)
5. `#history` — Workout history with filters, streak, records, charts
6. `#challenges` — Active challenges, leaderboard, friend codes
7. `#programs` — Program library with filters, active program tracker
8. `#hiitScreen` — HIIT program browser
9. `#hiitActive` — Live HIIT session with timer
10. `#analyticsScreen` — Fitness score, heatmap, body radar, flexibility, recommendations
11. `#videoUpload` — Video file upload and analysis results
12. `#recoveryScreen` — Mobility routine browser
13. `#bodyMetrics` — Weight/body tracking
14. `#settings` — App settings (skeleton, sound, FPS, detail level)
15. `#ptDashboard` — PT compliance dashboard
16. `#routineBuilder` — Custom routine builder

**Navigation:** 5-item tab bar (Home, History, Challenges, Body, Settings)

**Progressive disclosure:** 3 levels — Simple (plain English), Standard (data + scores), Nerd Mode (raw metrics, joint angles, signal data)

---

## Settings (appSettings in app.js)

```javascript
{
  skeleton: true,       // Show pose skeleton overlay
  sound: true,          // Voice + audio feedback
  fps: false,           // Show FPS counter
  countdown: true,      // 3-2-1-Go countdown
  detailLevel: 'standard'  // 'simple', 'standard', 'nerd'
}
```

Persisted in localStorage key `physiorep_settings`.

---

## Storage Keys (localStorage)

| Key | Module | Purpose |
|-----|--------|---------|
| `physiorep_settings` | app.js | App settings |
| `physiorep_onboarded` | app.js | Onboarding completion flag |
| `physiorep_seen_tip` | app.js | First-use tip shown flag |
| `physiorep_challenges` | challenges.js | Active challenge state |
| `physiorep_friends` | challenges.js | Friend codes |
| `physiorep_mycode` | challenges.js | User's own friend code |
| `physiorep_active_program` | programs.js | Active program + progress |
| `physiorep_personal_bests` | voice-coach.js | PR records per exercise |

---

## Testing

**Test framework:** Jest

**Test files:**
- `tests/exercise-engine.test.js` — Rep counting, form scoring, state machine transitions
- `tests/db.test.js` — IndexedDB operations (uses fake-indexeddb)
- `tests/pt-mode.test.js` — PT compliance, pain tracking, report generation

**Run tests:** `npx jest` (82 tests, all passing)

**Run linter:** `npx eslint src/` (0 errors, warnings only for HTML-invoked functions)

---

## Monetization Strategy

| Feature | Tier |
|---------|------|
| Individual exercises (6 core) | Free |
| Beginner Strength program | Free |
| All other programs (4) | Premium |
| HIIT workouts | Free (basic) / Premium (advanced) |
| Analytics dashboard | Free |
| Video upload analysis | Premium |
| PT compliance mode | Premium |
| Voice coach (all levels) | Free |
| Challenges & leaderboard | Free |

---

## Future Development Ideas

1. **Bluetooth HR monitor integration** — More accurate than rPPG
2. **Exercise state machines for extended exercises** — Currently only 6 have full rep counting
3. **Auto-generated programs** — Custom programs based on user goals and history
4. **Social features** — Real-time workout sharing, friend challenges with live data
5. **Wearable export** — Apple Health / Google Fit integration
6. **Video comparison** — Side-by-side before/after form analysis
7. **Multi-person mode** — Track 2+ people in frame simultaneously
8. **Cloud sync** — Cross-device workout history
9. **Trainer dashboard** — Web portal for PTs to monitor multiple patients

---

## How to Resume Development

To resume development:

1. **All source code** is in the `PhysioRep/` directory
2. **Install dependencies:** `npm install` (jest, eslint, fake-indexeddb for tests)
3. **Run tests:** `npx jest`
4. **Run linter:** `npx eslint src/`
5. **Serve locally:** Any static file server (`npx serve .` or `python -m http.server`)
6. **Key architecture decision:** Everything is vanilla JS with no build step. Scripts load via `<script>` tags in order. Globals are used intentionally for cross-module communication.
7. **MediaPipe loads from CDN** — requires internet on first load, then cached by service worker
8. **No backend** — All data is client-side (IndexedDB + localStorage). PWA works fully offline after first load.
