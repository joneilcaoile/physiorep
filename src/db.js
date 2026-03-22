// Database layer — IndexedDB wrapper for workout history and analytics

const DB_NAME = 'PhysioRepDB';
const DB_VERSION = 4;
const STORE_WORKOUTS = 'workouts';
const STORE_PT_PROGRAMS = 'ptPrograms';
const STORE_PAIN_ENTRIES = 'painEntries';

class PhysioRepDB {
  constructor() {
    this.db = null;
  }

  /**
   * Open/initialize the database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Workouts store
        if (!db.objectStoreNames.contains(STORE_WORKOUTS)) {
          const store = db.createObjectStore(STORE_WORKOUTS, {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('exercise', 'exerciseType', { unique: false });
        }

        // PT Programs store
        if (!db.objectStoreNames.contains(STORE_PT_PROGRAMS)) {
          const ptStore = db.createObjectStore(STORE_PT_PROGRAMS, {
            keyPath: 'id'
          });
          ptStore.createIndex('active', 'active', { unique: false });
        }

        // Pain entries store
        if (!db.objectStoreNames.contains(STORE_PAIN_ENTRIES)) {
          const painStore = db.createObjectStore(STORE_PAIN_ENTRIES, {
            keyPath: 'id',
            autoIncrement: true
          });
          painStore.createIndex('date', 'date', { unique: false });
          painStore.createIndex('context', 'context', { unique: false });
        }

        // Custom routines store
        if (!db.objectStoreNames.contains('customRoutines')) {
          db.createObjectStore('customRoutines', { keyPath: 'id', autoIncrement: true });
        }

        // Body metrics store
        if (!db.objectStoreNames.contains('bodyMetrics')) {
          const metricsStore = db.createObjectStore('bodyMetrics', { keyPath: 'id', autoIncrement: true });
          metricsStore.createIndex('date', 'date', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('PhysioRepDB: Failed to open', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Save a workout session
   * @param {Object} workout - { exercise, exerciseType, reps, duration, formScore, formIssues, plankHoldTime }
   * @returns {Promise<number>} - The auto-generated ID
   */
  async saveWorkout(workout) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_WORKOUTS, 'readwrite');
      const store = tx.objectStore(STORE_WORKOUTS);

      const record = {
        ...workout,
        date: new Date().toISOString(),
        timestamp: Date.now()
      };

      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all workouts, newest first
   * @param {number} limit - Max number to return (0 = all)
   * @returns {Promise<Array>}
   */
  async getWorkouts(limit = 0) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_WORKOUTS, 'readonly');
      const store = tx.objectStore(STORE_WORKOUTS);
      const index = store.index('date');

      const results = [];
      const request = index.openCursor(null, 'prev'); // newest first

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && (limit === 0 || results.length < limit)) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get workouts by exercise type
   * @param {string} exerciseType - 'squat', 'pushup', 'plank'
   * @returns {Promise<Array>}
   */
  async getWorkoutsByExercise(exerciseType) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_WORKOUTS, 'readonly');
      const store = tx.objectStore(STORE_WORKOUTS);
      const index = store.index('exercise');

      const results = [];
      const request = index.openCursor(IDBKeyRange.only(exerciseType));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results.reverse()); // newest first
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get aggregate stats for an exercise
   * @param {string} exerciseType
   * @returns {Promise<Object>} { totalSessions, totalReps, avgFormScore, bestFormScore }
   */
  async getExerciseStats(exerciseType) {
    const workouts = await this.getWorkoutsByExercise(exerciseType);

    if (workouts.length === 0) {
      return { totalSessions: 0, totalReps: 0, avgFormScore: 0, bestFormScore: 0 };
    }

    const totalReps = workouts.reduce((sum, w) => sum + (w.reps || 0), 0);
    const avgFormScore = Math.round(workouts.reduce((sum, w) => sum + (w.formScore || 0), 0) / workouts.length);
    const bestFormScore = Math.max(...workouts.map(w => w.formScore || 0));

    return {
      totalSessions: workouts.length,
      totalReps,
      avgFormScore,
      bestFormScore
    };
  }

  // PT PROGRAM METHODS

  /**
   * Save or update a PT program
   * @param {Object} program - PTProgram-compatible data
   * @returns {Promise<string>} - The program ID
   */
  async savePTProgram(program) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_PT_PROGRAMS, 'readwrite');
      const store = tx.objectStore(STORE_PT_PROGRAMS);
      const request = store.put(program);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get the active PT program (most recent active one)
   * @returns {Promise<Object|null>}
   */
  async getActivePTProgram() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_PT_PROGRAMS, 'readonly');
      const store = tx.objectStore(STORE_PT_PROGRAMS);
      const results = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.active) results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results.length > 0 ? results[results.length - 1] : null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // PAIN ENTRY METHODS

  /**
   * Save a pain entry
   * @param {Object} entry - { level, location, context, notes }
   * @returns {Promise<number>}
   */
  async savePainEntry(entry) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_PAIN_ENTRIES, 'readwrite');
      const store = tx.objectStore(STORE_PAIN_ENTRIES);
      const record = {
        ...entry,
        date: new Date().toISOString(),
        timestamp: Date.now()
      };
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pain entries, newest first
   * @param {number} limit - Max entries (0 = all)
   * @returns {Promise<Array>}
   */
  async getPainEntries(limit = 0) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_PAIN_ENTRIES, 'readonly');
      const store = tx.objectStore(STORE_PAIN_ENTRIES);
      const index = store.index('date');
      const results = [];
      const request = index.openCursor(null, 'prev');

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && (limit === 0 || results.length < limit)) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // CUSTOM ROUTINES METHODS

  /**
   * Save a custom routine
   * @param {Object} routine - { name, exercises, labels, createdAt }
   * @returns {Promise<number>}
   */
  async saveRoutine(routine) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('customRoutines', 'readwrite');
      const store = tx.objectStore('customRoutines');
      const request = store.put(routine);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all custom routines
   * @returns {Promise<Array>}
   */
  async getRoutines() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('customRoutines', 'readonly');
      const store = tx.objectStore('customRoutines');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a custom routine
   * @param {number} id
   * @returns {Promise<void>}
   */
  async deleteRoutine(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('customRoutines', 'readwrite');
      const store = tx.objectStore('customRoutines');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // BODY METRICS METHODS

  /**
   * Save a body metric (weight, measurement)
   * @param {Object} metric - { weight, notes }
   * @returns {Promise<number>} - The auto-generated ID
   */
  async saveMetric(metric) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('bodyMetrics', 'readwrite');
      const store = tx.objectStore('bodyMetrics');
      const record = { ...metric, date: new Date().toISOString(), timestamp: Date.now() };
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all body metrics, newest first
   * @param {number} limit - Max number to return (0 = all)
   * @returns {Promise<Array>}
   */
  async getMetrics(limit = 0) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('bodyMetrics', 'readonly');
      const store = tx.objectStore('bodyMetrics');
      const index = store.index('date');
      const results = [];
      const request = index.openCursor(null, 'prev');
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && (limit === 0 || results.length < limit)) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all workout data
   * @returns {Promise<void>}
   */
  async clearAll() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_WORKOUTS, 'readwrite');
      const store = tx.objectStore(STORE_WORKOUTS);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton
const physioRepDB = new PhysioRepDB();

// Export for testing (Node.js) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PhysioRepDB };
}
