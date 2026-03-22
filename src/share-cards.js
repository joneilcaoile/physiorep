// Social share cards — canvas-rendered workout summaries for sharing

class ShareCardGenerator {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Generate a workout summary share card
   * @param {Object} data - Workout summary data
   * @param {string} format - 'square' (1080x1080) or 'story' (1080x1920)
   * @returns {Promise<string>} Data URL of the generated image
   */
  async generateWorkoutCard(data, format = 'square') {
    const width = 1080;
    const height = format === 'story' ? 1920 : 1080;

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    // Background gradient
    const grad = this.ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(0.5, '#111');
    grad.addColorStop(1, '#0a1a0a');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, width, height);

    // Accent border glow
    this.ctx.shadowColor = '#06d6a0';
    this.ctx.shadowBlur = 30;
    this.ctx.strokeStyle = '#06d6a0';
    this.ctx.lineWidth = 3;
    this.ctx.roundRect(20, 20, width - 40, height - 40, 20);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // PhysioRep brand
    this.ctx.fillStyle = '#06d6a0';
    this.ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PhysioRep', width / 2, format === 'story' ? 120 : 80);

    // Exercise name
    this.ctx.fillStyle = '#fff';
    this.ctx.font = `bold ${format === 'story' ? 72 : 64}px -apple-system, sans-serif`;
    this.ctx.fillText(data.exercise || 'Workout Complete', width / 2, format === 'story' ? 260 : 200);

    // Date
    this.ctx.fillStyle = '#888';
    this.ctx.font = '28px -apple-system, sans-serif';
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    this.ctx.fillText(dateStr, width / 2, format === 'story' ? 320 : 260);

    // Stats grid
    const statsY = format === 'story' ? 480 : 380;
    const stats = this._buildStats(data);
    this._drawStatsGrid(stats, width, statsY, format);

    // Form score ring (if available)
    if (data.formScore !== null && data.formScore !== undefined) {
      const ringY = format === 'story' ? 980 : 680;
      this._drawFormRing(data.formScore, width / 2, ringY, 80);
    }

    // XP bar (if available)
    if (data.xpEarned) {
      const xpY = format === 'story' ? 1250 : 830;
      this._drawXPBar(data, width, xpY);
    }

    // Motivational quote
    const quoteY = format === 'story' ? 1550 : height - 120;
    this.ctx.fillStyle = '#06d6a0';
    this.ctx.font = 'italic 28px Georgia, serif';
    this.ctx.fillText(this._getMotivationalQuote(data), width / 2, quoteY);

    // Watermark
    this.ctx.fillStyle = '#444';
    this.ctx.font = '22px -apple-system, sans-serif';
    this.ctx.fillText('PhysioRep  •  physiorep.app', width / 2, height - 40);

    return this.canvas.toDataURL('image/png');
  }

  _buildStats(data) {
    const stats = [];
    if (data.reps) stats.push({ label: 'REPS', value: data.reps, icon: '💪' });
    if (data.duration) stats.push({ label: 'DURATION', value: this._formatDuration(data.duration), icon: '⏱' });
    if (data.formScore !== null && data.formScore !== undefined) stats.push({ label: 'FORM', value: data.formScore + '%', icon: '🎯' });
    if (data.calories) stats.push({ label: 'CALORIES', value: data.calories, icon: '🔥' });
    if (data.plankHoldTime) stats.push({ label: 'HOLD TIME', value: data.plankHoldTime + 's', icon: '🧘' });
    if (data.tempoScore) stats.push({ label: 'TEMPO', value: data.tempoScore + '%', icon: '⏳' });
    return stats;
  }

  _drawStatsGrid(stats, width, startY, format) {
    const cols = Math.min(stats.length, 3);
    const colWidth = (width - 120) / cols;

    stats.forEach((stat, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 60 + col * colWidth + colWidth / 2;
      const y = startY + row * (format === 'story' ? 200 : 160);

      // Icon
      this.ctx.font = '48px -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(stat.icon, x, y);

      // Value
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 56px -apple-system, sans-serif';
      this.ctx.fillText(String(stat.value), x, y + 70);

      // Label
      this.ctx.fillStyle = '#888';
      this.ctx.font = '24px -apple-system, sans-serif';
      this.ctx.fillText(stat.label, x, y + 105);
    });
  }

  _drawFormRing(score, cx, cy, radius) {
    // Background ring
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 12;
    this.ctx.stroke();

    // Score arc
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (score / 100) * Math.PI * 2;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, startAngle, endAngle);
    this.ctx.strokeStyle = score >= 80 ? '#06d6a0' : score >= 60 ? '#ffd166' : '#ef476f';
    this.ctx.lineWidth = 12;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    // Score text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 48px -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(score + '%', cx, cy);
    this.ctx.textBaseline = 'alphabetic';

    // Label
    this.ctx.fillStyle = '#888';
    this.ctx.font = '22px -apple-system, sans-serif';
    this.ctx.fillText('FORM SCORE', cx, cy + radius + 35);
  }

  _drawXPBar(data, width, y) {
    const barWidth = width - 200;
    const barHeight = 20;
    const x = 100;

    // Label
    this.ctx.fillStyle = '#06d6a0';
    this.ctx.font = 'bold 28px -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`+${data.xpEarned} XP`, width / 2, y);

    // Level info
    if (data.level) {
      this.ctx.fillStyle = '#888';
      this.ctx.font = '22px -apple-system, sans-serif';
      this.ctx.fillText(`Level ${data.level}  •  ${data.title || ''}`, width / 2, y + 35);
    }

    // Bar background
    this.ctx.fillStyle = '#333';
    this.ctx.beginPath();
    this.ctx.roundRect(x, y + 50, barWidth, barHeight, barHeight / 2);
    this.ctx.fill();

    // Bar fill
    const fillWidth = Math.max(barHeight, barWidth * (data.xpPercent || 0) / 100);
    this.ctx.fillStyle = '#06d6a0';
    this.ctx.beginPath();
    this.ctx.roundRect(x, y + 50, fillWidth, barHeight, barHeight / 2);
    this.ctx.fill();
  }

  _formatDuration(seconds) {
    if (seconds < 60) return seconds + 's';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  _getMotivationalQuote(data) {
    const quotes = [
      'Every rep counts.',
      'Consistency beats perfection.',
      'Stronger than yesterday.',
      'Your body is your gym.',
      'Form is everything.',
      'Progress, not perfection.',
      'One workout at a time.',
      'Discipline equals freedom.'
    ];

    if (data.formScore >= 95) return 'Perfect form. Perfect mindset.';
    if (data.reps >= 50) return 'Fifty reps. Zero excuses.';
    if (data.plankHoldTime >= 120) return 'Two minutes of steel.';

    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  /**
   * Download the card as an image
   */
  async download(data, format = 'square') {
    const dataUrl = await this.generateWorkoutCard(data, format);
    const link = document.createElement('a');
    link.download = `physiorep-workout-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }

  /**
   * Share via Web Share API if available
   */
  async share(data, format = 'square') {
    const dataUrl = await this.generateWorkoutCard(data, format);

    // Convert data URL to blob
    try {
      const response = await fetch(dataUrl);
      if (!response.ok) {
        console.warn('Failed to fetch workout card:', response.status);
        this.download(data, format);
        return false;
      }
      const blob = await response.blob();
      const file = new File([blob], 'physiorep-workout.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My PhysioRep Workout',
          text: `Just crushed ${data.reps || 0} ${data.exercise || 'reps'} with ${data.formScore || 0}% form score!`,
          files: [file]
        });
        return true;
      }
    } catch (e) {
      console.warn('Failed to share workout card:', e);
    }

    // Fallback: download
    this.download(data, format);
    return false;
  }
}

const shareCardGenerator = new ShareCardGenerator();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ShareCardGenerator };
}
