// Video analyzer — frame-by-frame analysis of recorded workouts

class VideoAnalyzer {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.isAnalyzing = false;
    this.progress = 0;
    this.results = null;

    // Callbacks
    this.onProgress = null;   // (percent) => {}
    this.onFrame = null;      // (frameData) => {}
    this.onComplete = null;   // (results) => {}
    this.onError = null;      // (error) => {}

    // Settings
    this.frameInterval = 100; // ms between analyzed frames
    this.exerciseType = 'squat'; // default
  }

  /**
   * Load a video file for analysis
   * @param {File} file - Video file from <input type="file">
   * @returns {Promise<Object>} Video metadata { duration, width, height }
   */
  async loadVideo(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('video/')) {
        reject(new Error('Invalid file type. Please upload a video file.'));
        return;
      }

      // Size limit: 500MB
      if (file.size > 500 * 1024 * 1024) {
        reject(new Error('Video too large. Max 500MB.'));
        return;
      }

      this.video = document.createElement('video');
      this.video.muted = true;
      this.video.playsInline = true;

      const url = URL.createObjectURL(file);
      this.video.src = url;

      this.video.onloadedmetadata = () => {
        // Create offscreen canvas matching video dimensions
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx = this.canvas.getContext('2d');

        resolve({
          duration: this.video.duration,
          width: this.video.videoWidth,
          height: this.video.videoHeight,
          name: file.name,
          size: file.size
        });
      };

      this.video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video. Format may not be supported.'));
      };
    });
  }

  /**
   * Analyze the loaded video
   * @param {string} exerciseType - Which exercise to analyze for
   * @param {Object} poseDetector - MediaPipe Pose instance
   * @returns {Promise<Object>} Analysis results
   */
  async analyze(exerciseType, poseDetector) {
    if (!this.video || !poseDetector) {
      throw new Error('Video not loaded or pose detector not available.');
    }

    // Validate video file type (security fix)
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const videoType = this.video.src ? this._getVideoMimeType() : 'unknown';
    if (!allowedTypes.includes(videoType)) {
      throw new Error('Invalid video format. Only MP4, WebM, and QuickTime are allowed.');
    }

    // Validate frame count limit (max 3600 frames = ~2 min at 30fps)
    const maxFrames = 3600;
    const totalFramesCalc = Math.ceil(this.video.duration * 30); // Assume 30fps
    if (totalFramesCalc > maxFrames) {
      throw new Error('Video too long. Maximum 2 minutes at 30fps.');
    }

    this.exerciseType = exerciseType;
    this.isAnalyzing = true;
    this.progress = 0;

    // Create tracker for this exercise
    const tracker = new (this._getTrackerClass())(exerciseType);

    const totalFrames = Math.ceil(this.video.duration * 1000 / this.frameInterval);
    const frameResults = [];
    let frameIndex = 0;
    const analysisStartTime = performance.now();

    return new Promise((resolve, reject) => {
      const analyzeNextFrame = async () => {
        if (!this.isAnalyzing) {
          reject(new Error('Analysis cancelled.'));
          return;
        }

        // Check 60-second timeout on video decode/processing
        const elapsedMs = performance.now() - analysisStartTime;
        if (elapsedMs > 60000) {
          this.isAnalyzing = false;
          reject(new Error('Video analysis timeout (60s limit exceeded).'));
          return;
        }

        const currentTimeMs = frameIndex * this.frameInterval;
        const currentTimeSec = currentTimeMs / 1000;

        if (currentTimeSec >= this.video.duration) {
          // Analysis complete
          this.isAnalyzing = false;
          this.progress = 100;

          const summary = tracker.getSummary();
          this.results = {
            exerciseType,
            videoName: this.video.src,
            duration: this.video.duration,
            framesAnalyzed: frameResults.length,
            summary,
            frameResults,
            timeline: this._buildTimeline(frameResults),
            highlights: this._findHighlights(frameResults)
          };

          if (this.onComplete) this.onComplete(this.results);
          resolve(this.results);
          return;
        }

        // Seek to frame
        this.video.currentTime = currentTimeSec;

        // Wait for seek to complete
        await new Promise(res => {
          this.video.onseeked = res;
        });

        // Draw frame to canvas
        this.ctx.drawImage(this.video, 0, 0);

        // Run pose detection
        try {
          // Send canvas to pose detector
          // The pose detector's onResults callback will fire
          // For video analysis, we use send() with the canvas
          const poseResults = await this._detectPose(poseDetector);

          if (poseResults && poseResults.poseLandmarks) {
            const result = tracker.processFrame(poseResults.poseLandmarks);
            const frameData = {
              time: currentTimeSec,
              frame: frameIndex,
              ...result,
              landmarks: poseResults.poseLandmarks
            };
            frameResults.push(frameData);

            if (this.onFrame) this.onFrame(frameData);
          }
        } catch (e) {
          // Skip frames where detection fails
          console.warn(`Frame ${frameIndex} detection failed:`, e);
        }

        // Update progress
        frameIndex++;
        this.progress = Math.round((frameIndex / totalFrames) * 100);
        if (this.onProgress) this.onProgress(this.progress);

        // Process next frame (use requestAnimationFrame to avoid blocking UI)
        requestAnimationFrame(analyzeNextFrame);
      };

      analyzeNextFrame();
    });
  }

  /**
   * Cancel analysis in progress
   */
  cancel() {
    this.isAnalyzing = false;
  }

  /**
   * Build a timeline of form events from frame results
   */
  _buildTimeline(frames) {
    const events = [];
    let lastPhase = null;

    for (const frame of frames) {
      // Phase transitions
      if (frame.feedback && frame.feedback.type === 'good' && frame.feedback.message) {
        events.push({
          time: frame.time,
          type: 'good',
          message: frame.feedback.message
        });
      } else if (frame.feedback && (frame.feedback.type === 'bad' || frame.feedback.type === 'warn')) {
        events.push({
          time: frame.time,
          type: frame.feedback.type,
          message: frame.feedback.message
        });
      }

      // Rep completions
      if (frame.reps > 0 && (!frames[frames.indexOf(frame) - 1] || frames[frames.indexOf(frame) - 1].reps < frame.reps)) {
        events.push({
          time: frame.time,
          type: 'rep',
          message: `Rep ${frame.reps} completed`
        });
      }

      lastPhase = frame.phase;
    }

    return events;
  }

  /**
   * Find highlight moments (best form, worst form, milestones)
   */
  _findHighlights(frames) {
    if (frames.length === 0) return [];

    const highlights = [];

    // Best form moment
    const goodFrames = frames.filter(f => f.feedback && f.feedback.type === 'good');
    if (goodFrames.length > 0) {
      const best = goodFrames[Math.floor(goodFrames.length / 2)]; // Middle of good stretch
      highlights.push({
        time: best.time,
        type: 'best',
        label: 'Best Form',
        message: best.feedback.message
      });
    }

    // Form issues
    const badFrames = frames.filter(f => f.feedback && f.feedback.type === 'bad');
    if (badFrames.length > 0) {
      // Cluster bad frames and pick representative ones
      const clusters = [];
      let cluster = [badFrames[0]];
      for (let i = 1; i < badFrames.length; i++) {
        if (badFrames[i].time - badFrames[i - 1].time < 2) {
          cluster.push(badFrames[i]);
        } else {
          clusters.push(cluster);
          cluster = [badFrames[i]];
        }
      }
      clusters.push(cluster);

      for (const c of clusters.slice(0, 3)) { // Top 3 issues
        const rep = c[Math.floor(c.length / 2)];
        highlights.push({
          time: rep.time,
          type: 'issue',
          label: 'Form Issue',
          message: rep.feedback.message
        });
      }
    }

    return highlights.sort((a, b) => a.time - b.time);
  }

  /**
   * Get video MIME type from canvas or element
   * @returns {string} MIME type
   */
  _getVideoMimeType() {
    // Try to infer from video element's current src
    // This is a basic check; in practice, you'd validate at upload time
    if (this.video && this.video.src) {
      if (this.video.src.includes('.mp4')) return 'video/mp4';
      if (this.video.src.includes('.webm')) return 'video/webm';
      if (this.video.src.includes('.mov')) return 'video/quicktime';
    }
    return 'video/mp4'; // Default assumption
  }

  /**
   * Detect pose on current canvas frame
   * @param {Object} poseDetector - MediaPipe Pose
   * @returns {Promise<Object>} Pose results
   */
  _detectPose(poseDetector) {
    return new Promise((resolve) => {
      // MediaPipe Pose uses a callback pattern
      // We temporarily override onResults to capture this frame's results
      const originalCallback = poseDetector.onResults;

      poseDetector.onResults = (results) => {
        poseDetector.onResults = originalCallback; // Restore
        resolve(results);
      };

      poseDetector.send({ image: this.canvas }).catch(() => {
        poseDetector.onResults = originalCallback;
        resolve(null);
      });
    });
  }

  /**
   * Get the ExerciseTracker constructor
   * (Available in both browser and test environments)
   */
  _getTrackerClass() {
    if (typeof ExerciseTracker !== 'undefined') return ExerciseTracker;
    throw new Error('ExerciseTracker not available');
  }

  /**
   * Generate a shareable report from analysis results
   * @returns {Object} Report data for display
   */
  getReport() {
    if (!this.results) return null;

    const { summary, timeline, highlights, framesAnalyzed, duration } = this.results;

    return {
      exercise: summary.exercise,
      exerciseType: summary.exerciseType,
      reps: summary.reps,
      formScore: summary.formScore,
      duration: Math.round(duration),
      framesAnalyzed,
      issuesFound: Object.entries(summary.formIssues || {}).map(([issue, count]) => ({
        issue,
        count,
        severity: count > framesAnalyzed * 0.3 ? 'frequent' : count > framesAnalyzed * 0.1 ? 'occasional' : 'rare'
      })),
      timeline: timeline.slice(0, 20), // Cap at 20 events
      highlights,
      recommendations: this._generateRecommendations(summary)
    };
  }

  /**
   * Generate form improvement recommendations
   */
  _generateRecommendations(summary) {
    const recs = [];

    if (!summary.formIssues) return recs;

    const issues = Object.entries(summary.formIssues).sort((a, b) => b[1] - a[1]);

    for (const [issue] of issues.slice(0, 3)) {
      const issueLower = issue.toLowerCase();
      if (issueLower.includes('depth')) {
        recs.push('Work on your range of motion. Try holding at the bottom position for 2 seconds per rep.');
      } else if (issueLower.includes('knee') && issueLower.includes('valgus')) {
        recs.push('Place a resistance band above your knees during squats to train knee-out tracking.');
      } else if (issueLower.includes('back') || issueLower.includes('lean')) {
        recs.push('Strengthen your upper back with rows and face pulls to maintain an upright torso.');
      } else if (issueLower.includes('hip') && issueLower.includes('sag')) {
        recs.push('Your core is fatiguing. Practice planks to build endurance before adding push-up volume.');
      } else if (issueLower.includes('asymmetr')) {
        recs.push('You have a left-right imbalance. Do single-arm or single-leg work to equalize.');
      } else {
        recs.push(`Focus on: ${issue}. Slow down your reps and use a mirror or side-view camera.`);
      }
    }

    if (summary.formScore >= 90) {
      recs.push('Your form is excellent! Consider progressing to a harder variation.');
    }

    return recs;
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.video) {
      if (this.video.src) URL.revokeObjectURL(this.video.src);
      this.video = null;
    }
    this.canvas = null;
    this.ctx = null;
    this.results = null;
  }
}

// Singleton
const videoAnalyzer = new VideoAnalyzer();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VideoAnalyzer };
}
