# PhysioRep

Workout form tracker that uses your phone camera to watch your body position and tell you when your form breaks down. Runs entirely in the browser — no app store, no account, no backend.

Built with MediaPipe Pose for body tracking, vanilla JS, and a service worker for offline use.

## What it does

- Tracks 18 exercises (squats, push-ups, lunges, deadlifts, planks, shoulder press, wall sits, glute bridges, mountain climbers, burpees, jumping jacks, high knees, squat jumps, superman, calf raises, tricep dips, side plank, bicycle crunches)
- Counts reps automatically based on joint angles and body position
- Gives live form feedback — tells you if your knees are caving, back is rounding, depth is too shallow, etc.
- Voice coaching that adapts to how you're doing
- HIIT mode with timed intervals
- PT mode for physical therapy — assign exercises, track pain levels, generate compliance reports
- Video upload analysis — record yourself and get a frame-by-frame breakdown
- XP system, achievements, streaks
- Works offline after first load

## Try it

Open on your phone, prop it up so the camera can see your full body, and start a workout.

## Run locally

```
npx serve . -l 3000
```

Then open `localhost:3000`.

## Tests

```
npm install
npm test
```

## Tech

- MediaPipe Pose (CDN) for body tracking
- IndexedDB for workout storage
- Web Speech API for voice coaching
- Canvas API for the skeleton overlay and form HUD
- Service worker for offline PWA

No frameworks, no build step, no backend. Everything runs client-side.

## License

MIT
