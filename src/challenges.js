// Challenge system — social competitions and leaderboards for retention

const CHALLENGE_TEMPLATES = [
  // Daily challenges (rotate)
  { id: 'daily_50_squats', type: 'daily', name: '50 Squat Challenge', target: 50, exercise: 'squat', metric: 'reps', icon: '🏋️' },
  { id: 'daily_30_pushups', type: 'daily', name: '30 Push-Up Blitz', target: 30, exercise: 'pushup', metric: 'reps', icon: '💪' },
  { id: 'daily_2min_plank', type: 'daily', name: '2-Min Plank Hold', target: 120, exercise: 'plank', metric: 'time', icon: '🧱' },
  { id: 'daily_perfect_10', type: 'daily', name: 'Perfect 10', target: 10, exercise: 'any', metric: 'perfect_reps', desc: '10 reps with 90%+ form', icon: '💎' },

  // Weekly challenges
  { id: 'weekly_5_days', type: 'weekly', name: '5-Day Warrior', target: 5, exercise: 'any', metric: 'active_days', icon: '📅' },
  { id: 'weekly_200_reps', type: 'weekly', name: 'Rep Machine', target: 200, exercise: 'any', metric: 'total_reps', icon: '🔢' },
  { id: 'weekly_variety', type: 'weekly', name: 'Jack of All Trades', target: 4, exercise: 'any', metric: 'unique_exercises', icon: '🎨' },
  { id: 'weekly_form_focus', type: 'weekly', name: 'Form Focused', target: 85, exercise: 'any', metric: 'avg_form', desc: '85%+ avg form score for the week', icon: '🎯' },

  // Monthly challenges
  { id: 'monthly_1000_reps', type: 'monthly', name: 'Thousand Rep Club', target: 1000, exercise: 'any', metric: 'total_reps', icon: '🏆' },
  { id: 'monthly_streak_14', type: 'monthly', name: 'Fortnight Fighter', target: 14, exercise: 'any', metric: 'streak', icon: '🔥' },
  { id: 'monthly_all_exercises', type: 'monthly', name: 'Complete Athlete', target: 6, exercise: 'any', metric: 'unique_exercises', desc: 'Use all 6 exercises this month', icon: '⭐' },
];

class ChallengeEngine {
  /**
   * Initialize challenge engine with localStorage persistence
   */
  constructor() {
    this.activeChallenges = [];
    this.completedChallenges = [];
    this.friends = [];
    this.myCode = '';
    this.load();
    this.refreshChallenges();
  }

  /**
   * Load state from localStorage
   */
  load() {
    try {
      const challenges = localStorage.getItem('physiorep_challenges');
      if (challenges) {
        const data = JSON.parse(challenges);
        if (data && typeof data === 'object') {
          this.activeChallenges = Array.isArray(data.active) ? data.active : [];
          this.completedChallenges = Array.isArray(data.completed) ? data.completed : [];
        }
      }

      const friends = localStorage.getItem('physiorep_friends');
      if (friends) {
        const friendsData = JSON.parse(friends);
        if (Array.isArray(friendsData)) {
          this.friends = friendsData;
        }
      }

      const myCode = localStorage.getItem('physiorep_mycode');
      if (myCode && typeof myCode === 'string') {
        this.myCode = myCode;
      } else {
        this.myCode = this._generateCode();
        this._saveCode();
      }
    } catch (e) {
      console.warn('Failed to load challenges from localStorage:', e);
    }
  }

  /**
   * Save state to localStorage
   */
  save() {
    try {
      localStorage.setItem('physiorep_challenges', JSON.stringify({
        active: this.activeChallenges,
        completed: this.completedChallenges
      }));
      localStorage.setItem('physiorep_friends', JSON.stringify(this.friends));
    } catch (e) {
      console.warn('Failed to save challenges to localStorage:', e);
    }
  }

  /**
   * Save friend code to localStorage
   */
  _saveCode() {
    try {
      localStorage.setItem('physiorep_mycode', this.myCode);
    } catch (e) {
      console.warn('Failed to save friend code:', e);
    }
  }

  // Date Helpers

  /**
   * Get day of year (0-364)
   */
  _getDayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  /**
   * Get start of current week (Monday)
   */
  _getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  }

  /**
   * Get start of current month
   */
  _getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }

  /**
   * Get today's date string (YYYY-MM-DD)
   */
  _getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Parse date string to Date object
   */
  _parseDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // Challenge Refresh & Updates

  /**
   * Refresh active challenges based on current date
   * Includes: 1 daily + current weekly + current monthly
   */
  refreshChallenges() {
    const today = this._getTodayString();
    const dayOfYear = this._getDayOfYear();
    const dailyIndex = dayOfYear % CHALLENGE_TEMPLATES.filter(c => c.type === 'daily').length;
    const dailyTemplates = CHALLENGE_TEMPLATES.filter(c => c.type === 'daily');
    const dailyTemplate = dailyTemplates[dailyIndex];

    const weekStart = this._getWeekStart();
    const monthStart = this._getMonthStart();

    // Check if we need to refresh
    const needsRefresh = !this.activeChallenges.some(c => c.startDate === today && c.type === 'daily')
      || !this.activeChallenges.some(c => c.startDate === weekStart && c.type === 'weekly')
      || !this.activeChallenges.some(c => c.startDate === monthStart && c.type === 'monthly');

    if (!needsRefresh) return;

    // Archive old challenges that aren't completed
    this.activeChallenges.forEach(c => {
      if (!c.completed) {
        if (c.type === 'daily' && c.startDate !== today) {
          this.completedChallenges.push(c);
        } else if (c.type === 'weekly' && c.startDate !== weekStart) {
          this.completedChallenges.push(c);
        } else if (c.type === 'monthly' && c.startDate !== monthStart) {
          this.completedChallenges.push(c);
        }
      }
    });

    // Remove archived from active
    this.activeChallenges = this.activeChallenges.filter(c => {
      if (c.type === 'daily') return c.startDate === today;
      if (c.type === 'weekly') return c.startDate === weekStart;
      if (c.type === 'monthly') return c.startDate === monthStart;
      return true;
    });

    // Add missing challenges
    if (!this.activeChallenges.some(c => c.type === 'daily')) {
      this.activeChallenges.push({
        templateId: dailyTemplate.id,
        type: 'daily',
        startDate: today,
        progress: 0,
        completed: false,
        completedAt: null
      });
    }

    if (!this.activeChallenges.some(c => c.type === 'weekly')) {
      const weeklyTemplate = CHALLENGE_TEMPLATES.find(c => c.type === 'weekly' && c.id === 'weekly_5_days');
      this.activeChallenges.push({
        templateId: weeklyTemplate.id,
        type: 'weekly',
        startDate: weekStart,
        progress: 0,
        completed: false,
        completedAt: null
      });
    }

    if (!this.activeChallenges.some(c => c.type === 'monthly')) {
      const monthlyTemplate = CHALLENGE_TEMPLATES.find(c => c.type === 'monthly' && c.id === 'monthly_1000_reps');
      this.activeChallenges.push({
        templateId: monthlyTemplate.id,
        type: 'monthly',
        startDate: monthStart,
        progress: 0,
        completed: false,
        completedAt: null
      });
    }

    this.save();
  }

  /**
   * Update challenge progress from workout data
   * @param {Object} workoutData - { exerciseType, reps, formScore, duration, plankHoldTime, date }
   */
  updateProgress(workoutData) {
    if (!workoutData) return;

    this.activeChallenges.forEach(challenge => {
      if (challenge.completed) return;

      const template = CHALLENGE_TEMPLATES.find(t => t.id === challenge.templateId);
      if (!template) return;

      // Only update if challenge matches exercise type or is "any"
      if (template.exercise !== 'any' && template.exercise !== workoutData.exerciseType) {
        return;
      }

      let progressIncrement = 0;

      switch (template.metric) {
        case 'reps':
          progressIncrement = workoutData.reps || 0;
          break;
        case 'time':
          progressIncrement = workoutData.plankHoldTime || workoutData.duration || 0;
          break;
        case 'perfect_reps':
          progressIncrement = (workoutData.formScore >= 90) ? workoutData.reps || 0 : 0;
          break;
        case 'total_reps':
          progressIncrement = workoutData.reps || 0;
          break;
        case 'active_days':
          // Only count once per day
          if (challenge.lastUpdated !== this._getTodayString()) {
            progressIncrement = 1;
            challenge.lastUpdated = this._getTodayString();
          }
          break;
        case 'unique_exercises':
          // Only count if not already counted for this exercise
          if (!challenge.exercisesCounted) challenge.exercisesCounted = new Set();
          if (!challenge.exercisesCounted.has(workoutData.exerciseType)) {
            progressIncrement = 1;
            challenge.exercisesCounted.add(workoutData.exerciseType);
          }
          break;
        case 'avg_form':
          // Store form scores and calculate average
          if (!challenge.formScores) challenge.formScores = [];
          challenge.formScores.push(workoutData.formScore || 0);
          challenge.progress = Math.round(
            challenge.formScores.reduce((a, b) => a + b, 0) / challenge.formScores.length
          );
          break;
        case 'streak':
          // Streak tracking would require daily data analysis - simplified here
          progressIncrement = 0; // Requires external calculation
          break;
      }

      challenge.progress += progressIncrement;

      // Check completion
      if (challenge.progress >= template.target) {
        challenge.completed = true;
        challenge.completedAt = new Date().toISOString();
      }
    });

    this.save();
  }

  // Challenge Queries

  /**
   * Get active challenges with template data and progress
   * @returns {Array} challenges with merged template data
   */
  getActiveChallenges() {
    this.refreshChallenges();
    return this.activeChallenges.map(challenge => {
      const template = CHALLENGE_TEMPLATES.find(t => t.id === challenge.templateId);
      if (!template) return null;

      const percentComplete = Math.min(100, Math.round((challenge.progress / template.target) * 100));
      const timeRemaining = this._getTimeRemaining(challenge);

      return {
        ...template,
        ...challenge,
        percentComplete,
        status: challenge.completed ? 'completed' : (percentComplete === 100 ? 'ready' : 'in_progress'),
        timeRemaining
      };
    }).filter(c => c !== null);
  }

  /**
   * Calculate time remaining for challenge
   */
  _getTimeRemaining(challenge) {
    const endDate = new Date(challenge.startDate);
    if (challenge.type === 'daily') {
      endDate.setDate(endDate.getDate() + 1);
    } else if (challenge.type === 'weekly') {
      endDate.setDate(endDate.getDate() + 7);
    } else if (challenge.type === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const now = new Date();
    const diff = endDate - now;
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    return Math.max(0, hours);
  }

  /**
   * Get completed challenges history
   * @param {number} limit - max results to return
   * @returns {Array} completed challenges
   */
  getCompletedChallenges(limit = 20) {
    return this.completedChallenges
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, limit)
      .map(challenge => {
        const template = CHALLENGE_TEMPLATES.find(t => t.id === challenge.templateId);
        return { ...template, ...challenge };
      })
      .filter(c => c !== null);
  }

  // Friend System

  /**
   * Generate a unique 6-character alphanumeric friend code
   * @returns {string} friend code
   */
  _generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Get user's friend code
   * @returns {string} friend code
   */
  getMyCode() {
    return this.myCode;
  }

  /**
   * Regenerate user's friend code
   * @returns {string} new friend code
   */
  regenerateMyCode() {
    this.myCode = this._generateCode();
    this._saveCode();
    return this.myCode;
  }

  /**
   * Add a friend by code
   * @param {string} code - friend's code
   * @param {string} name - friend's name
   * @returns {boolean} success
   */
  addFriend(code, name) {
    if (!code || !name) return false;
    if (code.toUpperCase() === this.myCode) return false; // Can't add self

    if (this.friends.some(f => f.code === code.toUpperCase())) {
      return false; // Already added
    }

    this.friends.push({
      code: code.toUpperCase(),
      name: name.slice(0, 20),
      scores: {},
      addedAt: new Date().toISOString()
    });

    this.save();
    return true;
  }

  /**
   * Remove a friend by code
   * @param {string} code - friend's code
   * @returns {boolean} success
   */
  removeFriend(code) {
    const initialLength = this.friends.length;
    this.friends = this.friends.filter(f => f.code !== code.toUpperCase());
    if (this.friends.length < initialLength) {
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Get list of friends
   * @returns {Array} friends
   */
  getFriends() {
    return this.friends.map(f => ({ ...f }));
  }

  // Scoring & Leaderboard

  /**
   * Calculate user's current score
   * @returns {Object} score metrics
   */
  getMyScore() {
    let totalReps = 0;
    let totalFormScore = 0;
    let formScoreCount = 0;
    let streak = 0;
    const challengesCompleted = this.completedChallenges.length;
    let weeklyPoints = 0;

    // If we have access to physioRepDB, compute from workouts
    if (typeof physioRepDB !== 'undefined') {
      const workouts = physioRepDB.getWorkouts();
      workouts.forEach(w => {
        totalReps += (w.reps || 0);
        if (w.formScore) {
          totalFormScore += w.formScore;
          formScoreCount++;
        }
      });

      // Calculate streak (simplified - from achievements if available)
      if (typeof computeAchievementStats === 'function') {
        const stats = computeAchievementStats(workouts);
        streak = stats.streak;
      }

      // Weekly points: completed challenges + active challenge progress
      const weekStart = this._getWeekStart();
      const completedThisWeek = this.completedChallenges.filter(c => c.startDate >= weekStart).length;
      weeklyPoints = completedThisWeek * 50;

      this.activeChallenges.forEach(c => {
        if (c.type === 'weekly' && c.completed) {
          weeklyPoints += 100;
        } else if (c.type === 'weekly') {
          weeklyPoints += Math.round(c.percentComplete || 0);
        }
      });
    }

    const avgFormScore = formScoreCount > 0 ? Math.round(totalFormScore / formScoreCount) : 0;

    return {
      totalReps,
      avgForm: avgFormScore,
      streak,
      challengesCompleted,
      weeklyPoints
    };
  }

  /**
   * Get leaderboard: self + friends, sorted by weeklyPoints
   * Note: friends' scores must be manually entered via updateFriendScore()
   * @returns {Array} leaderboard entries
   */
  getLeaderboard() {
    const myScore = this.getMyScore();
    const board = [
      {
        rank: 0,
        name: 'You',
        code: this.myCode,
        ...myScore,
        isSelf: true
      }
    ];

    this.friends.forEach(friend => {
      board.push({
        rank: 0,
        name: friend.name,
        code: friend.code,
        totalReps: friend.scores.totalReps || 0,
        avgForm: friend.scores.avgForm || 0,
        streak: friend.scores.streak || 0,
        challengesCompleted: friend.scores.challengesCompleted || 0,
        weeklyPoints: friend.scores.weeklyPoints || 0,
        isSelf: false
      });
    });

    // Sort by weeklyPoints descending, then by totalReps
    board.sort((a, b) => {
      if (b.weeklyPoints !== a.weeklyPoints) return b.weeklyPoints - a.weeklyPoints;
      return b.totalReps - a.totalReps;
    });

    // Assign ranks
    board.forEach((entry, i) => {
      entry.rank = i + 1;
    });

    return board;
  }

  /**
   * Update a friend's score (called when friend shares their stats)
   * @param {string} code - friend's code
   * @param {Object} scoreData - { totalReps, avgForm, streak, challengesCompleted, weeklyPoints }
   * @returns {boolean} success
   */
  updateFriendScore(code, scoreData) {
    const friend = this.friends.find(f => f.code === code.toUpperCase());
    if (!friend) return false;

    friend.scores = { ...scoreData };
    friend.lastUpdated = new Date().toISOString();
    this.save();
    return true;
  }

  // Sharing

  /**
   * Generate shareable challenge result text
   * @param {string} challengeId - challenge template id
   * @returns {Object} { text, shareData } for Web Share API
   */
  shareChallenge(challengeId) {
    const active = this.activeChallenges.find(c => c.templateId === challengeId && c.completed);
    if (!active) return null;

    const template = CHALLENGE_TEMPLATES.find(t => t.id === challengeId);
    if (!template) return null;

    const text = `${template.icon} I just completed "${template.name}" on PhysioRep! ${template.icon}
Add me: ${this.myCode}
#PhysioRep #FitnessChallenge`;

    return {
      text,
      shareData: {
        title: 'PhysioRep Challenge',
        text,
        url: window.location.href
      }
    };
  }

  /**
   * Generate weekly stats summary for sharing
   * @returns {Object} { text, shareData } for Web Share API
   */
  shareWeeklyStats() {
    const score = this.getMyScore();
    const completed = this.completedChallenges.filter(c => c.startDate >= this._getWeekStart()).length;

    const text = `📊 My PhysioRep Weekly Stats:
🏋️ ${score.totalReps} total reps
📈 ${score.avgForm}% avg form
🔥 ${score.streak}-day streak
🏆 ${completed} challenges completed
Weekly Points: ${score.weeklyPoints}

Add me: ${this.myCode}
#PhysioRep #FitnessStats`;

    return {
      text,
      shareData: {
        title: 'PhysioRep Weekly Stats',
        text,
        url: window.location.href
      }
    };
  }

  /**
   * Copy text to clipboard
   * @param {string} text - text to copy
   * @returns {Promise} resolves when copied
   */
  copyToClipboard(text) {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return Promise.resolve(success);
    }
  }

  /**
   * Share via Web Share API if available, otherwise copy to clipboard
   * @param {Object} shareData - { text, shareData }
   * @returns {Promise} resolves when shared
   */
  async share(shareData) {
    if (navigator.share) {
      try {
        await navigator.share(shareData.shareData);
        return { success: true, method: 'share-api' };
      } catch (e) {
        if (e.name !== 'AbortError') console.error('Share failed:', e);
      }
    }

    // Fallback to clipboard
    try {
      await this.copyToClipboard(shareData.text);
      return { success: true, method: 'clipboard' };
    } catch (e) {
      console.error('Clipboard copy failed:', e);
      return { success: false, method: 'none' };
    }
  }
}

const challengeEngine = new ChallengeEngine();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChallengeEngine, CHALLENGE_TEMPLATES };
}
