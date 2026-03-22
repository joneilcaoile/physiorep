// Tempo tracker — tracks rep phases and time-under-tension

class TempoTracker {
  constructor() {
    this.currentRep = null;
    this.repHistory = [];
    this.targetTempo = null; // e.g., { eccentric: 3, pause: 1, concentric: 2 } = "3-1-2"
  }

  /**
   * Set a target tempo (e.g., "3-1-2" = 3s eccentric, 1s pause, 2s concentric)
   */
  setTempo(eccentric, pause, concentric) {
    this.targetTempo = { eccentric, pause, concentric };
  }

  /**
   * Called when exercise phase changes
   * @param {string} phase - Current phase from ExerciseTracker
   * @param {number} timestamp - Current time in ms
   */
  onPhaseChange(phase, timestamp) {
    if (!this.currentRep) {
      this.currentRep = { startTime: timestamp, phases: {} };
    }

    const prevPhase = this.currentRep.currentPhase;
    if (prevPhase) {
      this.currentRep.phases[prevPhase] = (timestamp - this.currentRep.phaseStart) / 1000;
    }

    this.currentRep.currentPhase = phase;
    this.currentRep.phaseStart = timestamp;

    // Rep complete when we return to start phase after going through cycle
    if ((phase === 'standing' || phase === 'up' || phase === 'down' || phase === 'top') && Object.keys(this.currentRep.phases).length >= 2) {
      this._completeRep(timestamp);
    }
  }

  _completeRep(timestamp) {
    const rep = this.currentRep;
    if (!rep) return;

    const totalTUT = Object.values(rep.phases).reduce((sum, t) => sum + t, 0);
    const eccentricTime = rep.phases.descending || rep.phases.lowering || 0;
    const concentricTime = rep.phases.ascending || rep.phases.lifting || rep.phases.pressing || 0;
    const pauseTime = rep.phases.bottom || rep.phases.top || 0;

    const repData = {
      repNumber: this.repHistory.length + 1,
      totalTUT: Math.round(totalTUT * 10) / 10,
      eccentric: Math.round(eccentricTime * 10) / 10,
      concentric: Math.round(concentricTime * 10) / 10,
      pause: Math.round(pauseTime * 10) / 10,
      tempoScore: this._scoreTempo(eccentricTime, pauseTime, concentricTime),
      phases: { ...rep.phases }
    };

    this.repHistory.push(repData);
    this.currentRep = { startTime: timestamp, phases: {}, currentPhase: null, phaseStart: null };
    return repData;
  }

  _scoreTempo(eccentric, pause, concentric) {
    if (!this.targetTempo) {
      // No target — score based on control (slower = better, up to a point)
      const totalTUT = eccentric + pause + concentric;
      if (totalTUT < 1) return 30; // Too fast
      if (totalTUT < 2) return 60;
      if (totalTUT < 4) return 85;
      if (totalTUT < 7) return 100;
      return 90; // Very slow, still good
    }

    // Score against target tempo
    const t = this.targetTempo;
    const eccScore = Math.max(0, 100 - Math.abs(eccentric - t.eccentric) * 25);
    const pauseScore = Math.max(0, 100 - Math.abs(pause - t.pause) * 25);
    const conScore = Math.max(0, 100 - Math.abs(concentric - t.concentric) * 25);
    return Math.round((eccScore + pauseScore + conScore) / 3);
  }

  /**
   * Get session summary
   */
  getSummary() {
    if (this.repHistory.length === 0) return null;

    const avgTUT = this.repHistory.reduce((s, r) => s + r.totalTUT, 0) / this.repHistory.length;
    const totalTUT = this.repHistory.reduce((s, r) => s + r.totalTUT, 0);
    const avgTempo = this.repHistory.reduce((s, r) => s + r.tempoScore, 0) / this.repHistory.length;
    const avgEcc = this.repHistory.reduce((s, r) => s + r.eccentric, 0) / this.repHistory.length;
    const avgCon = this.repHistory.reduce((s, r) => s + r.concentric, 0) / this.repHistory.length;
    const avgPause = this.repHistory.reduce((s, r) => s + r.pause, 0) / this.repHistory.length;

    return {
      reps: this.repHistory.length,
      avgTUT: Math.round(avgTUT * 10) / 10,
      totalTUT: Math.round(totalTUT * 10) / 10,
      avgTempoScore: Math.round(avgTempo),
      avgTempo: `${avgEcc.toFixed(1)}-${avgPause.toFixed(1)}-${avgCon.toFixed(1)}`,
      targetTempo: this.targetTempo ? `${this.targetTempo.eccentric}-${this.targetTempo.pause}-${this.targetTempo.concentric}` : null,
      repHistory: this.repHistory,
      consistency: this._calcConsistency()
    };
  }

  _calcConsistency() {
    if (this.repHistory.length < 3) return 100;
    const tuts = this.repHistory.map(r => r.totalTUT);
    const mean = tuts.reduce((a, b) => a + b) / tuts.length;
    const variance = tuts.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / tuts.length;
    const cv = Math.sqrt(variance) / mean; // coefficient of variation
    return Math.round(Math.max(0, 100 - cv * 200)); // lower CV = more consistent
  }

  reset() {
    this.currentRep = null;
    this.repHistory = [];
  }
}

const tempoTracker = new TempoTracker();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TempoTracker };
}
