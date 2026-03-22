// Form correction HUD — real-time visual feedback on camera feed

const HUD_COLORS = {
  good: '#06d6a0',
  warn: '#ffd166',
  bad: '#ef476f',
  neutral: 'rgba(255,255,255,0.5)',
  bg: 'rgba(0,0,0,0.6)',
  accent: '#06d6a0'
};

// MediaPipe Pose skeleton connections (pairs of landmark indices)
const SKELETON_CONNECTIONS = [
  [11, 13], [13, 15],  // left arm
  [12, 14], [14, 16],  // right arm
  [11, 12],            // shoulders
  [11, 23], [12, 24],  // torso sides
  [23, 24],            // hips
  [23, 25], [25, 27],  // left leg
  [24, 26], [26, 28]   // right leg
];

// Landmark indices for key joints
const JOINT_INDICES = {
  leftShoulder: 11, rightShoulder: 12,
  leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28
};

class FormHUD {
  constructor() {
    this.enabled = true;
    this.showAngles = false;
    this.showDepthLine = true;
    this.showFormRing = true;
    this.showCorrectionArrows = true;
    this.showRepPop = true;
    this.lastRepCount = 0;
    this.repPopTimer = 0;
    this.repPopScale = 0;

    // Load preferences
    this._loadPrefs();
  }

  _loadPrefs() {
    try {
      const raw = localStorage.getItem('physiorep_hud_prefs');
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs && typeof prefs === 'object') {
          this.enabled = prefs.enabled !== false;
          this.showAngles = prefs.showAngles || false;
          this.showDepthLine = prefs.showDepthLine !== false;
          this.showFormRing = prefs.showFormRing !== false;
          this.showCorrectionArrows = prefs.showCorrectionArrows !== false;
        }
      }
    } catch (e) {
      console.warn('Failed to load HUD preferences:', e);
    }
  }

  savePrefs() {
    try {
      localStorage.setItem('physiorep_hud_prefs', JSON.stringify({
        enabled: this.enabled,
        showAngles: this.showAngles,
        showDepthLine: this.showDepthLine,
        showFormRing: this.showFormRing,
        showCorrectionArrows: this.showCorrectionArrows
      }));
    } catch (e) { /* ignore */ }
  }

  /**
   * Main render method — call after each pose detection frame
   * @param {CanvasRenderingContext2D} ctx - Canvas context overlaid on video
   * @param {Array} landmarks - MediaPipe pose landmarks (normalized 0-1)
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @param {Object} feedback - { formScore, feedback: { message, type }, reps } from ExerciseTracker
   * @param {string} exerciseType - Current exercise type
   */
  render(ctx, landmarks, width, height, feedback, exerciseType) {
    if (!this.enabled || !landmarks || !ctx) return;

    // Determine form quality for coloring
    const formColor = this._getFormColor(feedback);

    // 1. Draw colored skeleton
    this._drawSkeleton(ctx, landmarks, width, height, formColor, feedback);

    // 2. Draw joint angle indicators
    if (this.showAngles) {
      this._drawAngleIndicators(ctx, landmarks, width, height, exerciseType);
    }

    // 3. Draw depth/ROM target line
    if (this.showDepthLine) {
      this._drawDepthGuide(ctx, landmarks, width, height, exerciseType, feedback);
    }

    // 4. Draw correction arrows
    if (this.showCorrectionArrows && feedback && feedback.feedback) {
      this._drawCorrectionArrows(ctx, landmarks, width, height, feedback.feedback, exerciseType);
    }

    // 5. Draw form score ring
    if (this.showFormRing) {
      this._drawFormScoreRing(ctx, width, height, feedback ? feedback.formScore : 100);
    }

    // 6. Rep pop animation
    if (this.showRepPop && feedback) {
      this._drawRepPop(ctx, width, height, feedback.reps);
    }
  }

  // === SKELETON DRAWING ===

  _drawSkeleton(ctx, landmarks, w, h, formColor, feedback) {
    const badJoints = this._getBadJoints(feedback);

    // Draw connections (bones)
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    for (const [i, j] of SKELETON_CONNECTIONS) {
      const a = landmarks[i];
      const b = landmarks[j];
      if (!a || !b || (a.visibility || 0) < 0.5 || (b.visibility || 0) < 0.5) continue;

      const ax = this._clamp(a.x * w, 0, w), ay = this._clamp(a.y * h, 0, h);
      const bx = this._clamp(b.x * w, 0, w), by = this._clamp(b.y * h, 0, h);

      // Color based on whether connected joints have issues
      const isBadBone = badJoints.has(i) || badJoints.has(j);
      ctx.strokeStyle = isBadBone ? HUD_COLORS.bad : formColor;
      ctx.shadowColor = isBadBone ? HUD_COLORS.bad : formColor;
      ctx.shadowBlur = 6;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Draw joint dots
    for (const [, idx] of Object.entries(JOINT_INDICES)) {
      const lm = landmarks[idx];
      if (!lm || (lm.visibility || 0) < 0.5) continue;

      const x = this._clamp(lm.x * w, 0, w), y = this._clamp(lm.y * h, 0, h);
      const isBad = badJoints.has(idx);

      ctx.beginPath();
      ctx.arc(x, y, isBad ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isBad ? HUD_COLORS.bad : formColor;
      ctx.fill();

      // White center dot
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  _getBadJoints(feedback) {
    const bad = new Set();
    if (!feedback || !feedback.feedback) return bad;

    const msg = (feedback.feedback.message || '').toLowerCase();
    const type = feedback.feedback.type;

    if (type !== 'bad' && type !== 'warn') return bad;

    // Map feedback messages to affected joints
    if (msg.includes('knee') || msg.includes('depth')) {
      bad.add(25).add(26); // knees
    }
    if (msg.includes('hip') || msg.includes('hips')) {
      bad.add(23).add(24); // hips
    }
    if (msg.includes('elbow') || msg.includes('arm')) {
      bad.add(13).add(14); // elbows
    }
    if (msg.includes('shoulder') || msg.includes('chest') || msg.includes('back')) {
      bad.add(11).add(12); // shoulders
    }
    if (msg.includes('wrist') || msg.includes('lockout')) {
      bad.add(15).add(16); // wrists
    }
    if (msg.includes('ankle') || msg.includes('heel')) {
      bad.add(27).add(28); // ankles
    }

    return bad;
  }

  // === ANGLE INDICATORS ===

  _drawAngleIndicators(ctx, landmarks, w, h, exerciseType) {
    const angleConfig = this._getAngleJoints(exerciseType);
    if (!angleConfig) return;

    for (const { a, b, c, label: _label } of angleConfig) {
      const la = landmarks[a], lb = landmarks[b], lc = landmarks[c];
      if (!la || !lb || !lc) continue;
      if ((la.visibility || 0) < 0.5 || (lb.visibility || 0) < 0.5 || (lc.visibility || 0) < 0.5) continue;

      // Calculate angle at joint b
      const radians = Math.atan2(lc.y - lb.y, lc.x - lb.x) - Math.atan2(la.y - lb.y, la.x - lb.x);
      let angle = Math.abs(radians * 180 / Math.PI);
      if (angle > 180) angle = 360 - angle;

      const x = this._clamp(lb.x * w, 0, w), y = this._clamp(lb.y * h, 0, h);

      // Draw angle arc
      const startAngle = Math.atan2(la.y - lb.y, la.x - lb.x);
      const endAngle = Math.atan2(lc.y - lb.y, lc.x - lb.x);

      ctx.beginPath();
      ctx.arc(x, y, 25, startAngle, endAngle, false);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw angle text
      ctx.fillStyle = HUD_COLORS.bg;
      ctx.fillRect(x + 15, y - 22, 55, 20);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(angle)}°`, x + 18, y - 8);
    }
  }

  _getAngleJoints(exerciseType) {
    const configs = {
      squat: [
        { a: 23, b: 25, c: 27, label: 'L Knee' }, // hip-knee-ankle
        { a: 24, b: 26, c: 28, label: 'R Knee' }
      ],
      pushup: [
        { a: 11, b: 13, c: 15, label: 'L Elbow' },
        { a: 12, b: 14, c: 16, label: 'R Elbow' }
      ],
      lunge: [
        { a: 23, b: 25, c: 27, label: 'L Knee' },
        { a: 24, b: 26, c: 28, label: 'R Knee' }
      ],
      shoulderpress: [
        { a: 11, b: 13, c: 15, label: 'L Elbow' },
        { a: 12, b: 14, c: 16, label: 'R Elbow' }
      ],
      deadlift: [
        { a: 11, b: 23, c: 25, label: 'L Hip' },
        { a: 12, b: 24, c: 26, label: 'R Hip' }
      ]
    };
    return configs[exerciseType] || null;
  }

  // === DEPTH GUIDE ===

  _drawDepthGuide(ctx, landmarks, w, h, exerciseType, _feedback) {
    if (!['squat', 'lunge', 'squat_jump'].includes(exerciseType)) return;

    // Draw a horizontal target depth line at knee level
    const lHip = landmarks[23], rHip = landmarks[24];
    if (!lHip || !rHip) return;

    const hipY = this._clamp(((lHip.y + rHip.y) / 2) * h, 0, h);
    const targetY = this._clamp(hipY, 0, h); // Target: hips at or below knee height (parallel)

    // Dashed target line
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(6, 214, 160, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, targetY);
    ctx.lineTo(w * 0.85, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = HUD_COLORS.bg;
    ctx.fillRect(w * 0.85 - 2, targetY - 12, 80, 18);
    ctx.fillStyle = HUD_COLORS.accent;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TARGET', w * 0.85 + 4, targetY + 2);
  }

  // === CORRECTION ARROWS ===

  _drawCorrectionArrows(ctx, landmarks, w, h, feedbackInfo, _exerciseType) {
    if (!feedbackInfo.message || feedbackInfo.type === 'good' || feedbackInfo.type === '') return;

    const msg = feedbackInfo.message.toLowerCase();
    const arrows = [];

    // Map feedback messages to arrow directions
    if (msg.includes('deeper') || msg.includes('depth') || msg.includes('lower')) {
      const hip = landmarks[23];
      if (hip) arrows.push({ x: this._clamp(hip.x * w, 0, w), y: this._clamp(hip.y * h, 0, h), dx: 0, dy: 30, label: 'DEEPER' });
    }
    if (msg.includes('knees out') || msg.includes('knees cav')) {
      const lk = landmarks[25], rk = landmarks[26];
      if (lk) arrows.push({ x: this._clamp(lk.x * w, 0, w), y: this._clamp(lk.y * h, 0, h), dx: -20, dy: 0, label: 'OUT' });
      if (rk) arrows.push({ x: this._clamp(rk.x * w, 0, w), y: this._clamp(rk.y * h, 0, h), dx: 20, dy: 0, label: 'OUT' });
    }
    if (msg.includes('chest up') || msg.includes('forward lean') || msg.includes('back straight')) {
      const shoulder = landmarks[11];
      if (shoulder) arrows.push({ x: this._clamp(shoulder.x * w, 0, w), y: this._clamp(shoulder.y * h, 0, h), dx: 0, dy: -25, label: 'UP' });
    }
    if (msg.includes('hips') && (msg.includes('sag') || msg.includes('drop'))) {
      const hip = landmarks[23];
      if (hip) arrows.push({ x: hip.x * w, y: hip.y * h, dx: 0, dy: -25, label: 'RAISE' });
    }
    if (msg.includes('hips') && (msg.includes('high') || msg.includes('pike'))) {
      const hip = landmarks[23];
      if (hip) arrows.push({ x: hip.x * w, y: hip.y * h, dx: 0, dy: 25, label: 'LOWER' });
    }
    if (msg.includes('elbow') && (msg.includes('flare') || msg.includes('tuck'))) {
      const le = landmarks[13], re = landmarks[14];
      if (le) arrows.push({ x: this._clamp(le.x * w, 0, w), y: this._clamp(le.y * h, 0, h), dx: 10, dy: 0, label: 'TUCK' });
      if (re) arrows.push({ x: this._clamp(re.x * w, 0, w), y: this._clamp(re.y * h, 0, h), dx: -10, dy: 0, label: 'TUCK' });
    }
    if (msg.includes('lockout') || msg.includes('overhead') || msg.includes('press')) {
      const lw = landmarks[15];
      if (lw) arrows.push({ x: this._clamp(lw.x * w, 0, w), y: this._clamp(lw.y * h, 0, h), dx: 0, dy: -25, label: 'PUSH' });
    }

    // Draw arrows
    for (const arrow of arrows) {
      this._drawArrow(ctx, arrow.x, arrow.y, arrow.dx, arrow.dy, arrow.label, feedbackInfo.type);
    }
  }

  _drawArrow(ctx, x, y, dx, dy, label, type) {
    const color = type === 'bad' ? HUD_COLORS.bad : HUD_COLORS.warn;
    const endX = this._clamp(x + dx * 1.5, 0, 1280); // Approximate canvas width
    const endY = this._clamp(y + dy * 1.5, 0, 720); // Approximate canvas height

    // Arrow line
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + dx * 0.3, y + dy * 0.3);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(dy, dx);
    const headLen = 10;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen * Math.cos(angle - 0.5), endY - headLen * Math.sin(angle - 0.5));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen * Math.cos(angle + 0.5), endY - headLen * Math.sin(angle + 0.5));
    ctx.stroke();

    // Label
    ctx.fillStyle = HUD_COLORS.bg;
    const labelW = ctx.measureText(label).width + 10;
    ctx.fillRect(endX + dx * 0.2 - labelW / 2, endY + dy * 0.2 - 8, labelW, 16);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, endX + dx * 0.2, endY + dy * 0.2 + 4);
  }

  // === FORM SCORE RING ===

  _drawFormScoreRing(ctx, w, h, formScore) {
    const cx = w - 40;
    const cy = 50;
    const radius = 22;

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = HUD_COLORS.bg;
    ctx.fill();

    // Score arc
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + ((formScore || 0) / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = formScore >= 80 ? HUD_COLORS.good : formScore >= 50 ? HUD_COLORS.warn : HUD_COLORS.bad;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${formScore || 0}`, cx, cy);
    ctx.textBaseline = 'alphabetic';
  }

  // === REP POP ANIMATION ===

  _drawRepPop(ctx, w, h, currentReps) {
    if (currentReps > this.lastRepCount) {
      this.repPopScale = 1.5;
      this.repPopTimer = 30; // frames
      this.lastRepCount = currentReps;
    }

    if (this.repPopTimer > 0) {
      this.repPopTimer--;
      this.repPopScale = Math.max(1, this.repPopScale * 0.92);

      const cx = 50;
      const cy = 50;
      const scale = this.repPopScale;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // Circle bg
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fillStyle = HUD_COLORS.bg;
      ctx.fill();
      ctx.strokeStyle = HUD_COLORS.accent;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Rep count
      ctx.fillStyle = HUD_COLORS.accent;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(currentReps), 0, 0);
      ctx.textBaseline = 'alphabetic';

      ctx.restore();
    }
  }

  _getFormColor(feedback) {
    if (!feedback || !feedback.feedback) return HUD_COLORS.good;
    switch (feedback.feedback.type) {
      case 'bad': return HUD_COLORS.bad;
      case 'warn': return HUD_COLORS.warn;
      case 'good': return HUD_COLORS.good;
      default: return HUD_COLORS.neutral;
    }
  }

  /**
   * Reset rep counter (call on new workout)
   */
  reset() {
    this.lastRepCount = 0;
    this.repPopTimer = 0;
    this.repPopScale = 0;
  }

  // Canvas bounds clamping helper (security fix)
  _clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

}

const formHUD = new FormHUD();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FormHUD, HUD_COLORS, SKELETON_CONNECTIONS };
}
