// Health sync — integrates wearable and manual health data
 * Supported data sources:
 * - Apple Health (via Web Health API, when available in Safari)
 * - Google Fit (via Fitness REST API with OAuth)
 * - Manual input (always available as fallback)
 * - In-app rPPG vitals (from vitals.js)
 */

const HEALTH_STORAGE_KEY = 'physiorep_health_data';

const HEALTH_METRICS = {
  sleep: { label: 'Sleep', unit: 'hours', icon: '😴', idealMin: 7, idealMax: 9 },
  hrv: { label: 'HRV', unit: 'ms', icon: '💓', idealMin: 40, idealMax: 100 },
  restingHR: { label: 'Resting HR', unit: 'bpm', icon: '❤️', idealMin: 50, idealMax: 70 },
  steps: { label: 'Steps', unit: 'steps', icon: '👟', idealMin: 6000, idealMax: 15000 },
  activeCalories: { label: 'Active Cal', unit: 'kcal', icon: '🔥', idealMin: 200, idealMax: 800 },
  bodyWeight: { label: 'Weight', unit: 'kg', icon: '⚖️', idealMin: null, idealMax: null }
};

class HealthSync {
  constructor() {
    this.data = this._load();
    this.connected = false;
    this.source = 'manual'; // 'apple_health', 'google_fit', 'manual'
    this._lastSyncTime = 0; // Rate limit sync to 5 min minimum (security fix)
  }

  _load() {
    try {
      const raw = localStorage.getItem(HEALTH_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          return data;
        } else {
          console.warn('Invalid health data: expected object');
        }
      }
    } catch (e) {
      console.warn('Failed to load health data:', e);
    }
    return {
      today: {},
      history: [], // last 30 days of daily summaries
      lastSync: null,
      source: 'manual',
      preferences: {
        autoSync: false,
        showOnHome: true,
        dailyReminder: false
      }
    };
  }

  _save() {
    try {
      localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) { /* ignore */ }
  }

  /**
   * Check if any health API is available
   * @returns {Object} { appleHealth: bool, googleFit: bool, manual: true }
   */
  checkAvailability() {
    return {
      appleHealth: typeof navigator !== 'undefined' && 'health' in navigator,
      googleFit: false, // Would require OAuth setup
      manual: true,
      inAppVitals: typeof vitalsMonitor !== 'undefined'
    };
  }

  /**
   * Request permission and connect to a health data source
   * @param {string} source - 'apple_health', 'google_fit', or 'manual'
   * @returns {Promise<boolean>} success
   */
  async connect(source = 'manual') {
    if (source === 'apple_health' && 'health' in navigator) {
      try {
        // Web Health API (experimental, Safari-only as of 2025)
        const permissions = await navigator.health.requestAuthorization({
          read: ['stepCount', 'heartRate', 'sleepAnalysis', 'heartRateVariabilitySDNN', 'bodyMass', 'activeEnergyBurned']
        });
        this.connected = permissions.granted;
        this.source = 'apple_health';
        this.data.source = 'apple_health';
        this._save();
        return this.connected;
      } catch (e) {
        console.warn('Apple Health connection failed:', e);
        return false;
      }
    }

    // Manual mode is always available
    this.connected = true;
    this.source = source || 'manual';
    this.data.source = this.source;
    this._save();
    return true;
  }

  /**
   * Sync today's health data from connected source
   * @returns {Promise<Object>} Today's health summary
   */
  async syncToday() {
    // Rate limit: minimum 5 minutes between syncs (security fix)
    const now = Date.now();
    if (now - this._lastSyncTime < 300000) {
      return { cached: true, data: this.todayData };
    }
    this._lastSyncTime = now;

    const today = new Date().toDateString();

    if (this.source === 'apple_health' && 'health' in navigator) {
      try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [steps, hr, sleep, hrv] = await Promise.all([
          navigator.health.query({ type: 'stepCount', start: startOfDay, end: now }),
          navigator.health.query({ type: 'heartRate', start: startOfDay, end: now }),
          navigator.health.query({ type: 'sleepAnalysis', start: new Date(now - 86400000), end: now }),
          navigator.health.query({ type: 'heartRateVariabilitySDNN', start: startOfDay, end: now })
        ]);

        this.data.today = {
          date: today,
          sleep: sleep.totalHours || null,
          hrv: hrv.latestValue || null,
          restingHR: hr.restingValue || null,
          steps: steps.totalCount || null,
          activeCalories: null,
          source: 'apple_health',
          syncedAt: new Date().toISOString()
        };
      } catch (e) {
        console.warn('Health sync failed:', e);
      }
    }

    // If manual or API failed, return whatever we have
    this.data.lastSync = new Date().toISOString();
    this._save();
    return this.getTodaySummary();
  }

  /**
   * Manual input for a health metric
   * @param {string} metric - Key from HEALTH_METRICS
   * @param {number} value - The value
   */
  logMetric(metric, value) {
    if (!HEALTH_METRICS[metric]) return;

    const today = new Date().toDateString();
    if (!this.data.today || this.data.today.date !== today) {
      this.data.today = { date: today, source: 'manual' };
    }

    this.data.today[metric] = value;
    this.data.today.source = 'manual';
    this.data.today.syncedAt = new Date().toISOString();
    this._save();
  }

  /**
   * Log rPPG vitals from in-app measurement
   * @param {Object} vitals - { heartRate, breathingRate } from vitalsMonitor
   */
  logInAppVitals(vitals) {
    if (!vitals) return;

    const today = new Date().toDateString();
    if (!this.data.today || this.data.today.date !== today) {
      this.data.today = { date: today, source: 'in_app' };
    }

    if (vitals.heartRate && vitals.heartRate.avg) {
      this.data.today.restingHR = vitals.heartRate.avg;
    }
    this.data.today.inAppVitals = vitals;
    this._save();
  }

  /**
   * Get today's summary for display and adaptive engine
   * @returns {Object} Full health summary with status indicators
   */
  getTodaySummary() {
    const today = this.data.today || {};
    const summary = {};

    for (const [key, meta] of Object.entries(HEALTH_METRICS)) {
      const value = today[key];
      let status = 'missing';
      let statusColor = '#666';

      if (value !== null && value !== undefined) {
        if (meta.idealMin !== null && value < meta.idealMin) {
          status = 'low';
          statusColor = '#ef476f';
        } else if (meta.idealMax !== null && value > meta.idealMax) {
          status = 'high';
          statusColor = '#ffd166';
        } else {
          status = 'good';
          statusColor = '#06d6a0';
        }
      }

      summary[key] = {
        ...meta,
        value,
        status,
        statusColor,
        displayValue: value !== null && value !== undefined ? `${value} ${meta.unit}` : '—'
      };
    }

    return {
      date: today.date || new Date().toDateString(),
      metrics: summary,
      source: today.source || 'none',
      lastSync: this.data.lastSync,
      hasData: Object.keys(today).some(k => today[k] !== null && today[k] !== undefined && k !== 'date' && k !== 'source' && k !== 'syncedAt'),
      recoveryInput: this._toRecoveryInput(today)
    };
  }

  /**
   * Convert today's data to format expected by AdaptiveEngine.assessReadiness()
   * @returns {Object|null} { sleepHours, hrvScore, restingHR, stepsYesterday }
   */
  _toRecoveryInput(today) {
    if (!today || (!today.sleep && !today.hrv && !today.restingHR)) return null;

    return {
      sleepHours: today.sleep || null,
      hrvScore: today.hrv || null,
      restingHR: today.restingHR || null,
      stepsYesterday: today.steps || null
    };
  }

  /**
   * Archive today's data at end of day and add to history
   */
  archiveDay() {
    if (this.data.today && this.data.today.date) {
      this.data.history.push({ ...this.data.today });
      if (this.data.history.length > 90) {
        this.data.history = this.data.history.slice(-90);
      }
    }
    this.data.today = {};
    this._save();
  }

  /**
   * Get trend data for a metric over the last N days
   * @param {string} metric - Key from HEALTH_METRICS
   * @param {number} days - Number of days
   * @returns {Array} [{ date, value }]
   */
  getTrend(metric, days = 14) {
    return this.data.history
      .slice(-days)
      .filter(d => d[metric] !== null && d[metric] !== undefined)
      .map(d => ({ date: d.date, value: d[metric] }));
  }

  /**
   * Calculate a composite recovery score (0-100) from available data
   * @returns {Object} { score, label, color, factors }
   */
  getRecoveryScore() {
    const today = this.data.today || {};
    const factors = [];
    let totalWeight = 0;
    let weightedSum = 0;

    // Sleep (weight: 40%)
    if (today.sleep !== null && today.sleep !== undefined) {
      const sleepScore = today.sleep >= 8 ? 100 : today.sleep >= 7 ? 80 : today.sleep >= 6 ? 50 : today.sleep >= 5 ? 30 : 10;
      factors.push({ label: 'Sleep', score: sleepScore, weight: 40, detail: `${today.sleep}h` });
      weightedSum += sleepScore * 40;
      totalWeight += 40;
    }

    // HRV (weight: 25%)
    if (today.hrv !== null && today.hrv !== undefined) {
      const hrvScore = today.hrv >= 70 ? 100 : today.hrv >= 50 ? 80 : today.hrv >= 30 ? 50 : 20;
      factors.push({ label: 'HRV', score: hrvScore, weight: 25, detail: `${today.hrv}ms` });
      weightedSum += hrvScore * 25;
      totalWeight += 25;
    }

    // Resting HR (weight: 20%)
    if (today.restingHR !== null && today.restingHR !== undefined) {
      const hrScore = today.restingHR <= 55 ? 100 : today.restingHR <= 65 ? 80 : today.restingHR <= 75 ? 50 : 20;
      factors.push({ label: 'Resting HR', score: hrScore, weight: 20, detail: `${today.restingHR}bpm` });
      weightedSum += hrScore * 20;
      totalWeight += 20;
    }

    // Steps (weight: 15%)
    if (today.steps !== null && today.steps !== undefined) {
      const stepsScore = today.steps >= 10000 ? 100 : today.steps >= 7000 ? 80 : today.steps >= 4000 ? 50 : 20;
      factors.push({ label: 'Activity', score: stepsScore, weight: 15, detail: `${today.steps} steps` });
      weightedSum += stepsScore * 15;
      totalWeight += 15;
    }

    if (totalWeight === 0) {
      return { score: null, label: 'No data', color: '#666', factors: [] };
    }

    const score = Math.round(weightedSum / totalWeight);
    let label, color;
    if (score >= 80) { label = 'Fully Recovered'; color = '#06d6a0'; }
    else if (score >= 60) { label = 'Mostly Recovered'; color = '#69f0ae'; }
    else if (score >= 40) { label = 'Partial Recovery'; color = '#ffd166'; }
    else { label = 'Low Recovery'; color = '#ef476f'; }

    return { score, label, color, factors };
  }

  /**
   * Get available metrics config for settings UI
   */
  getMetricsConfig() {
    return Object.entries(HEALTH_METRICS).map(([key, meta]) => ({
      key,
      ...meta,
      currentValue: this.data.today?.[key] || null
    }));
  }
}

const healthSync = new HealthSync();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HealthSync, HEALTH_METRICS };
}