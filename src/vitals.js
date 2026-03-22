/* globals vitalsMonitor, VitalsMonitor */
// Vitals monitoring — real-time heart rate and breathing rate via pose landmarks

class VitalsMonitor {
  /**
   * Initialize the vitals monitor with buffers and state
   */
  constructor() {
    // === Configuration ===
    this.hrWindowSize = 300;        // ~10 seconds at 30 fps (sufficient for bandpass filter response)
    this.brWindowSize = 600;        // ~20 seconds at 30 fps (breathing oscillation cycles)
    this.targetFps = 30;            // Expected frame rate
    this.enabled = true;

    // === Heart Rate (rPPG) State ===
    this.greenChannelBuffer = [];   // Raw green channel values from face ROI
    this.filteredSignal = [];       // After bandpass filtering
    this.currentHR = 0;             // Beats per minute
    this.hrConfidence = 0;          // 0-1 scale, based on signal quality
    this.hrHistory = [];            // Time-series for workout summary: [{time, value}, ...]

    // === Breathing Rate State ===
    this.shoulderYBuffer = [];      // Y-position of shoulder midpoint
    this.currentBR = 0;             // Breaths per minute
    this.brConfidence = 0;          // 0-1 scale
    this.brHistory = [];            // Time-series for summary

    // === Frame Timing ===
    this.frameTimestamps = [];      // Timestamps for precise sample rate calculation
    this.lastProcessTime = 0;       // Throttle/diagnostics

    // === Bandpass Filter Coefficients (precomputed) ===
    // Butterworth 2nd-order IIR for 0.75-3.0 Hz @ 30 fps
    // Low cut: 0.75 Hz (45 BPM), High cut: 3.0 Hz (180 BPM)
    this._initFilterCoefficients();

    // === Face ROI Caching ===
    this.lastFaceROI = null;        // Cache ROI bbox for diagnostics/visualization

    console.log('[VitalsMonitor] Initialized with HR window=%d, BR window=%d',
                this.hrWindowSize, this.brWindowSize);
  }

  /**
   * Precompute Butterworth bandpass filter coefficients for HR (0.75-3.0 Hz @ 30 fps)
   * Using cascaded 2nd-order high-pass and low-pass filters
   */
  _initFilterCoefficients() {
    const fs = 30; // Sampling frequency (Hz)

    // High-pass: 0.75 Hz cutoff
    const wc_high = 0.75 / (fs / 2); // Normalized frequency
    const hp_coeff = this._butter(2, wc_high, 'high');

    // Low-pass: 3.0 Hz cutoff
    const wc_low = 3.0 / (fs / 2);
    const lp_coeff = this._butter(2, wc_low, 'low');

    this.hr_filter = {
      hp: hp_coeff,
      lp: lp_coeff
    };
  }

  /**
   * Design a 2nd-order Butterworth filter (simplified)
   * Returns {b: [...], a: [...]} for difference equation
   * y[n] = b[0]*x[n] + b[1]*x[n-1] + b[2]*x[n-2] - a[1]*y[n-1] - a[2]*y[n-2]
   *
   * @param {number} order - Filter order (2)
   * @param {number} wc - Normalized cutoff frequency (0-1, where 1 = Nyquist)
   * @param {string} type - 'high' or 'low'
   * @returns {Object} {b, a} coefficients
   */
  _butter(order, wc, type) {
    if (order !== 2) {
      console.warn('[VitalsMonitor._butter] Only order=2 implemented, got', order);
    }

    // Butterworth pole locations (s-domain)
    const _theta = Math.PI * (2 * order + 1) / (4 * order);
    void _theta; // pole angle used for reference; simplified sqrt(2) form used below

    // Bilinear transform: s = 2/Ts * (1-z^-1) / (1+z^-1)
    // For unit gain at DC/Nyquist, adjust cutoff
    const m = 2 * Math.tan(wc * Math.PI / 2);

    if (type === 'low') {
      // Low-pass Butterworth
      const a0 = m * m + m * Math.sqrt(2) + 1;
      return {
        b: [m * m / a0, 2 * m * m / a0, m * m / a0],
        a: [1, 2 * (m * m - 1) / a0, (m * m - m * Math.sqrt(2) + 1) / a0]
      };
    } else if (type === 'high') {
      // High-pass Butterworth
      const a0 = m * m + m * Math.sqrt(2) + 1;
      return {
        b: [1 / a0, -2 / a0, 1 / a0],
        a: [1, 2 * (m * m - 1) / a0, (m * m - m * Math.sqrt(2) + 1) / a0]
      };
    }
    return { b: [1], a: [1] };
  }

  /**
   * Apply IIR filter to signal (direct form II)
   * y[n] = b[0]*x[n] + b[1]*x[n-1] + b[2]*x[n-2] - a[1]*y[n-1] - a[2]*y[n-2]
   *
   * @param {number[]} signal - Input signal
   * @param {Object} filter - {b: [...], a: [...]} coefficients
   * @returns {number[]} Filtered signal
   */
  _applyFilter(signal, filter) {
    if (signal.length === 0) return [];

    const b = filter.b;
    const a = filter.a;
    const filtered = [];

    for (let i = 0; i < signal.length; i++) {
      let y = b[0] * signal[i];
      if (i >= 1) y += b[1] * signal[i - 1];
      if (i >= 2) y += b[2] * signal[i - 2];

      if (i >= 1) y -= a[1] * filtered[i - 1];
      if (i >= 2) y -= a[2] * filtered[i - 2];

      filtered.push(y / a[0]);
    }
    return filtered;
  }

  /**
   * Cascade multiple filters (apply high-pass then low-pass)
   *
   * @param {number[]} signal - Input signal
   * @returns {number[]} Bandpass filtered signal
   */
  _applyBandpassFilter(signal) {
    if (signal.length < 3) return [];

    let filtered = this._applyFilter(signal, this.hr_filter.hp);
    filtered = this._applyFilter(filtered, this.hr_filter.lp);

    return filtered;
  }

  /**
   * Detect peaks in a signal using simple threshold + minimum distance
   * Returns indices of detected peaks
   *
   * @param {number[]} signal - Input signal
   * @param {number} minDistance - Minimum samples between peaks (default: 15 for ~2 sec at 30 fps)
   * @returns {number[]} Indices of peaks
   */
  _detectPeaks(signal, minDistance = 15) {
    if (signal.length < 3) return [];

    const peaks = [];
    const threshold = this._computeThreshold(signal);

    for (let i = 1; i < signal.length - 1; i++) {
      // Local maximum above threshold
      if (signal[i] > signal[i - 1] &&
          signal[i] > signal[i + 1] &&
          signal[i] > threshold) {

        // Enforce minimum distance
        if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistance) {
          peaks.push(i);
        }
      }
    }

    return peaks;
  }

  /**
   * Compute adaptive threshold for peak detection
   * Uses mean + std of signal
   *
   * @param {number[]} signal - Input signal
   * @returns {number} Threshold value
   */
  _computeThreshold(signal) {
    if (signal.length === 0) return 0;

    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    const variance = signal.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / signal.length;
    const std = Math.sqrt(variance);

    // Threshold at mean + 0.5*std
    return mean + 0.5 * std;
  }

  /**
   * Extract face region of interest from the VIDEO element (not skeleton canvas).
   * Uses a temporary off-screen canvas to read video pixels directly,
   * avoiding contamination from skeleton/overlay drawing.
   *
   * MediaPipe Pose face landmarks (sparse):
   *   0: NOSE, 2: LEFT_EYE, 5: RIGHT_EYE
   * Landmarks are in normalized coords (0-1), so we scale by video dimensions.
   *
   * @param {HTMLCanvasElement} _canvas - Unused (kept for API compat)
   * @param {HTMLVideoElement} video - Video element (pixel source)
   * @param {Array} landmarks - MediaPipe pose landmarks
   * @returns {Object|null} {avgGreen, x, y, width, height} or null if invalid
   */
  _extractFaceROI(_canvas, video, landmarks) {
    try {
      if (!landmarks || landmarks.length < 6) return null;
      if (!video || video.readyState < 2) return null;

      const nose = landmarks[0];
      const leftEye = landmarks[2];
      const rightEye = landmarks[5];

      // Check visibility
      if (!nose || !leftEye || !rightEye) return null;
      if ((nose.visibility || 0) < 0.5) return null;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;

      // Eye distance in pixels — used to estimate face size
      const eyeDist = Math.abs(rightEye.x - leftEye.x) * vw;
      if (eyeDist < 15) return null; // Face too small/far

      // Cheek ROI: between nose and eyes, avoids forehead (often occluded by hair)
      // Center on nose, width = eyeDist, height = eyeDist * 0.4
      const roiW = Math.round(eyeDist * 0.6);
      const roiH = Math.round(eyeDist * 0.35);
      const roiX = Math.round(nose.x * vw - roiW / 2);
      const roiY = Math.round(nose.y * vh - roiH * 0.3); // Slightly below nose = cheek area

      // Bounds check
      const x = Math.max(0, roiX);
      const y = Math.max(0, roiY);
      const w = Math.min(roiW, vw - x);
      const h = Math.min(roiH, vh - y);
      if (w < 8 || h < 8) return null;

      // Use offscreen canvas to read VIDEO pixels (not the skeleton canvas)
      if (!this._offCanvas) {
        this._offCanvas = document.createElement('canvas');
        this._offCtx = this._offCanvas.getContext('2d', { willReadFrequently: true });
      }
      this._offCanvas.width = w;
      this._offCanvas.height = h;
      this._offCtx.drawImage(video, x, y, w, h, 0, 0, w, h);

      const imageData = this._offCtx.getImageData(0, 0, w, h);
      const data = imageData.data;
      const pixelCount = w * h;

      // Extract green channel average (pulsatile signal is strongest in green)
      let sumGreen = 0;
      for (let i = 1; i < data.length; i += 4) {
        sumGreen += data[i];
      }
      const avgGreen = sumGreen / pixelCount;

      this.lastFaceROI = { x, y, width: w, height: h };

      return { avgGreen, x, y, width: w, height: h };
    } catch (error) {
      console.error('[VitalsMonitor._extractFaceROI] Error:', error);
      return null;
    }
  }

  /**
   * Estimate heart rate from filtered green channel signal
   * Uses peak detection to find beat intervals
   *
   * @returns {Object} {hr: number, confidence: number}
   */
  _estimateHeartRate() {
    if (this.greenChannelBuffer.length < 30) {
      return { hr: 0, confidence: 0 };
    }

    // Apply bandpass filter
    this.filteredSignal = this._applyBandpassFilter(this.greenChannelBuffer);

    if (this.filteredSignal.length < 30) {
      return { hr: 0, confidence: 0 };
    }

    // Detect peaks
    const peaks = this._detectPeaks(this.filteredSignal);

    if (peaks.length < 2) {
      return { hr: 0, confidence: 0 };
    }

    // Compute inter-peak intervals (in samples)
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    // Average interval -> HR
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const avgIntervalMs = (avgInterval / this.targetFps) * 1000;
    const hr = 60000 / avgIntervalMs;

    // Confidence based on signal quality (variance + consistency)
    const signal = this.filteredSignal;
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    const variance = signal.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / signal.length;
    const std = Math.sqrt(variance);
    const snr = std > 0 ? Math.abs(mean) / std : 0;

    // Interval consistency: low std = high confidence
    const intervalStd = Math.sqrt(
      intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length
    );
    const intervalVariance = intervalStd / avgInterval;

    const confidence = Math.max(0, Math.min(1,
      Math.exp(-intervalVariance) * Math.min(snr / 2, 1)
    ));

    return { hr, confidence };
  }

  /**
   * Estimate breathing rate from shoulder Y-position oscillation
   * Uses zero-crossing or cycle counting on smoothed shoulder midpoint
   *
   * @returns {Object} {br: number, confidence: number}
   */
  _estimateBreathingRate() {
    if (this.shoulderYBuffer.length < 60) {
      return { br: 0, confidence: 0 };
    }

    // Smooth the shoulder Y values (simple moving average)
    const smoothed = this._smoothSignal(this.shoulderYBuffer, 5);

    // Count zero-crossings in detrended signal
    const detrended = this._detrend(smoothed);
    let crossings = 0;

    for (let i = 1; i < detrended.length; i++) {
      if ((detrended[i - 1] < 0 && detrended[i] >= 0) ||
          (detrended[i - 1] >= 0 && detrended[i] < 0)) {
        crossings++;
      }
    }

    // Two zero-crossings per breathing cycle (up and down)
    const cycles = crossings / 2;
    const durationSec = smoothed.length / this.targetFps;
    const br = (cycles / durationSec) * 60;

    // Confidence: based on oscillation amplitude and stability
    const amplitude = Math.max(...detrended) - Math.min(...detrended);
    const mean = detrended.reduce((a, b) => a + b, 0) / detrended.length;
    const variance = detrended.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / detrended.length;
    const std = Math.sqrt(variance);

    const confidence = Math.max(0, Math.min(1,
      Math.min(amplitude / 20, 1) * Math.min(std / 10, 1)
    ));

    return { br, confidence };
  }

  /**
   * Simple moving average smoothing
   *
   * @param {number[]} signal - Input signal
   * @param {number} windowSize - Size of moving window
   * @returns {number[]} Smoothed signal
   */
  _smoothSignal(signal, windowSize = 5) {
    if (signal.length < windowSize) return signal;

    const smoothed = [];
    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(signal.length, i + Math.ceil(windowSize / 2));
      const window = signal.slice(start, end);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      smoothed.push(avg);
    }
    return smoothed;
  }

  /**
   * Detrend signal using linear detrending (remove mean)
   *
   * @param {number[]} signal - Input signal
   * @returns {number[]} Detrended signal
   */
  _detrend(signal) {
    if (signal.length === 0) return [];

    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    return signal.map(x => x - mean);
  }

  /**
   * Main processing function — called each frame from pose results
   * Extracts ROI, updates buffers, estimates vitals
   *
   * @param {HTMLCanvasElement} canvas - Canvas element (for pixel reading)
   * @param {HTMLVideoElement} video - Video element (unused but kept for API consistency)
   * @param {Array} landmarks - MediaPipe pose landmarks (full array)
   * @returns {Object} Current vitals {heartRate, hrConfidence, breathingRate, brConfidence}
   */
  processFrame(canvas, video, landmarks) {
    if (!this.enabled || !landmarks || landmarks.length < 13) {
      return this.getVitals();
    }

    const now = performance.now();
    this.frameTimestamps.push(now);

    // Keep only recent timestamps
    if (this.frameTimestamps.length > this.hrWindowSize) {
      this.frameTimestamps.shift();
    }

    // === Heart Rate: Extract face ROI and green channel ===
    const faceROI = this._extractFaceROI(canvas, video, landmarks);
    if (faceROI && faceROI.avgGreen > 0) {
      this.greenChannelBuffer.push(faceROI.avgGreen);

      if (this.greenChannelBuffer.length > this.hrWindowSize) {
        this.greenChannelBuffer.shift();
      }

      // Estimate HR when buffer has enough samples
      if (this.greenChannelBuffer.length >= 60) {
        const hrResult = this._estimateHeartRate();
        this.currentHR = Math.round(hrResult.hr);
        this.hrConfidence = hrResult.confidence;

        // Clamp to realistic range and apply exponential smoothing
        if (this.currentHR > 40 && this.currentHR < 200) {
          this.hrHistory.push({
            time: now,
            value: this.currentHR,
            confidence: this.hrConfidence
          });
        }
      }
    }

    // === Breathing Rate: Track shoulder Y oscillation ===
    if (landmarks.length >= 12) {
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];

      if (leftShoulder?.y && rightShoulder?.y) {
        const shoulderYMid = (leftShoulder.y + rightShoulder.y) / 2;
        this.shoulderYBuffer.push(shoulderYMid);

        if (this.shoulderYBuffer.length > this.brWindowSize) {
          this.shoulderYBuffer.shift();
        }

        // Estimate BR when buffer has enough samples
        if (this.shoulderYBuffer.length >= 120) {
          const brResult = this._estimateBreathingRate();
          this.currentBR = Math.round(brResult.br);
          this.brConfidence = brResult.confidence;

          // Clamp to realistic range
          if (this.currentBR > 8 && this.currentBR < 60) {
            this.brHistory.push({
              time: now,
              value: this.currentBR,
              confidence: this.brConfidence
            });
          }
        }
      }
    }

    this.lastProcessTime = performance.now() - now;
    return this.getVitals();
  }

  /**
   * Get current vital signs readings
   *
   * @returns {Object} {heartRate, hrConfidence, breathingRate, brConfidence}
   */
  getVitals() {
    return {
      heartRate: this.currentHR,
      hrConfidence: Number(this.hrConfidence.toFixed(2)),
      breathingRate: this.currentBR,
      brConfidence: Number(this.brConfidence.toFixed(2))
    };
  }

  /**
   * Get summary statistics for workout end
   * Useful for workout summary screen / data export
   *
   * @returns {Object} Summary with averages, ranges, and time-series data
   */
  getSummary() {
    const hrValues = this.hrHistory
      .filter(h => h.confidence > 0.3)
      .map(h => h.value);

    const brValues = this.brHistory
      .filter(b => b.confidence > 0.3)
      .map(b => b.value);

    const computeStats = (values) => {
      if (values.length === 0) {
        return { avg: 0, min: 0, max: 0, count: 0 };
      }
      return {
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      };
    };

    return {
      heartRate: computeStats(hrValues),
      breathingRate: computeStats(brValues),
      hrData: this.hrHistory.slice(-300),      // Last ~10 seconds
      brData: this.brHistory.slice(-600),      // Last ~20 seconds
      durationSec: this.frameTimestamps.length / this.targetFps
    };
  }

  /**
   * Enable/disable vitals monitoring
   *
   * @param {boolean} enabled - Enable or disable
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      console.log('[VitalsMonitor] Disabled');
    }
  }

  /**
   * Reset all buffers and state (for new workout session)
   */
  reset() {
    this.greenChannelBuffer = [];
    this.filteredSignal = [];
    this.currentHR = 0;
    this.hrConfidence = 0;
    this.hrHistory = [];

    this.shoulderYBuffer = [];
    this.currentBR = 0;
    this.brConfidence = 0;
    this.brHistory = [];

    this.frameTimestamps = [];
    this.lastFaceROI = null;

    console.log('[VitalsMonitor] Reset');
  }

  /**
   * Get diagnostic info (for debugging/visualization)
   *
   * @returns {Object} Diagnostic data
   */
  getDiagnostics() {
    return {
      enabled: this.enabled,
      greenChannelBufferSize: this.greenChannelBuffer.length,
      filteredSignalSize: this.filteredSignal.length,
      shoulderYBufferSize: this.shoulderYBuffer.length,
      hrHistorySize: this.hrHistory.length,
      brHistorySize: this.brHistory.length,
      lastFaceROI: this.lastFaceROI,
      lastProcessTime: this.lastProcessTime.toFixed(1) + 'ms',
      estimatedFps: (this.frameTimestamps.length / ((performance.now() - this.frameTimestamps[0] + 1) / 1000)).toFixed(1)
    };
  }
}

// === Singleton Instance ===
const vitalsMonitor = new VitalsMonitor();

// === Export for Node.js / Testing ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VitalsMonitor, vitalsMonitor };
}
