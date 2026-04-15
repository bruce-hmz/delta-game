// Auto-clip recorder for viral sharing on Douyin/Kuaishou
// Records 5-10 seconds around red/gold loot drops
// Exports as vertical video (9:16) with game branding

import type { Quality } from '../types';

// ==================== Types ====================

export interface ClipOptions {
  duration: number;          // Clip length in seconds
  vertical: boolean;         // 9:16 aspect ratio for Douyin
  branding: {
    gameName: string;
    playerName: string;
    qualityText: string;
  };
}

export interface ClipResult {
  blob: Blob;
  url: string;
  duration: number;
}

// ==================== Clip Recorder ====================

export class ClipRecorder {
  private canvas: HTMLCanvasElement | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private isRecording = false;
  private recordingStart = 0;
  private clipResolve: ((result: ClipResult | null) => void) | null = null;

  // Ring buffer approach: continuously capture, keep last N seconds
  private ringBuffer: Blob[] = [];
  private ringBufferMaxAge = 10000; // Keep last 10 seconds
  private ringInterval: ReturnType<typeof setInterval> | null = null;
  private stream: MediaStream | null = null;

  /**
   * Initialize the recorder with the game canvas
   */
  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Start continuous capture (ring buffer mode)
   * Continuously records, keeping only the last 10 seconds
   */
  startContinuousCapture() {
    if (!this.canvas || this.isRecording) return;

    try {
      const fps = 30;
      this.stream = this.canvas.captureStream(fps);

      // Check supported mime types
      const mimeType = this.getSupportedMimeType();
      if (!mimeType) {
        console.warn('ClipRecorder: No supported video MIME type');
        return;
      }

      this.chunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps - good quality for short clips
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.ringBuffer.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        // Combine chunks into final clip
        if (this.chunks.length > 0) {
          const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
          const blob = new Blob(this.chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);

          if (this.clipResolve) {
            this.clipResolve({
              blob,
              url,
              duration: (Date.now() - this.recordingStart) / 1000,
            });
            this.clipResolve = null;
          }
        } else {
          if (this.clipResolve) {
            this.clipResolve(null);
            this.clipResolve = null;
          }
        }
      };

      // Start recording in timeslice mode (produces chunks every 500ms)
      this.mediaRecorder.start(500);
      this.isRecording = true;

      // Ring buffer cleanup: remove old chunks
      this.ringInterval = setInterval(() => {
        const now = Date.now();
        while (this.ringBuffer.length > 0) {
          // Keep at least enough for 10 seconds at current bitrate
          if (this.ringBuffer.length > 60) { // ~30 seconds of chunks at 500ms intervals
            this.ringBuffer.shift();
          } else {
            break;
          }
        }
      }, 1000);
    } catch (err) {
      console.warn('ClipRecorder: Failed to start capture', err);
    }
  }

  /**
   * Trigger a clip capture around a rare loot drop
   * Keeps the last few seconds (pre-drop) and continues recording for a few more (post-drop)
   */
  async captureLootDrop(quality: Quality): Promise<ClipResult | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      return null;
    }

    // Only capture for red and gold drops
    if (quality !== 'red' && quality !== 'gold') {
      return null;
    }

    // Save current ring buffer as pre-drop footage
    const preDropChunks = [...this.ringBuffer];
    this.ringBuffer = [];

    const qualityText: Record<Quality, string> = {
      white: '普通', blue: '精良', purple: '稀有', red: '🔥 史诗', gold: '👑 传说',
    };

    // Continue recording for 3 more seconds post-drop
    return new Promise((resolve) => {
      this.clipResolve = resolve;
      this.chunks = [...preDropChunks];

      setTimeout(() => {
        // Add any new ring buffer chunks
        this.chunks.push(...this.ringBuffer);

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          // Request final data then stop
          this.mediaRecorder.requestData();
          this.mediaRecorder.stop();
          this.isRecording = false;

          // Restart continuous capture
          setTimeout(() => {
            this.startContinuousCapture();
          }, 500);
        } else {
          resolve(null);
        }
      }, 3000);
    });
  }

  /**
   * Generate a share card image (static PNG for WeChat/Xiaohongshu)
   */
  generateShareCard(options: {
    playerName: string;
    lootName: string;
    lootQuality: Quality;
    lootValue: number;
    zoneName: string;
    round: number;
    carryValue: number;
  }): Promise<string> {
    return new Promise((resolve) => {
      const card = document.createElement('canvas');
      const dpr = 2;
      const w = 360 * dpr;
      const h = 640 * dpr;
      card.width = w;
      card.height = h;
      const ctx = card.getContext('2d')!;

      // Quality colors
      const qualityColors: Record<Quality, { bg: string; border: string; text: string }> = {
        white: { bg: '#1a1a2a', border: '#555', text: '#aaa' },
        blue: { bg: '#0a1a3a', border: '#4a90e2', text: '#4a90e2' },
        purple: { bg: '#1a0a2a', border: '#a855f7', text: '#a855f7' },
        red: { bg: '#2a0a0a', border: '#ef4444', text: '#ef4444' },
        gold: { bg: '#2a1a0a', border: '#fbbf24', text: '#fbbf24' },
      };
      const colors = qualityColors[options.lootQuality];
      const qualityNames: Record<Quality, string> = {
        white: '普通', blue: '精良', purple: '稀有', red: '史诗', gold: '传说',
      };

      // Background
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);

      // Border
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 4 * dpr;
      ctx.strokeRect(8 * dpr, 8 * dpr, w - 16 * dpr, h - 16 * dpr);

      // Game title
      ctx.fillStyle = '#5a7a9a';
      ctx.font = `bold ${14 * dpr}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('⚔️ 三角洲行动', w / 2, 40 * dpr);

      // Player name
      ctx.fillStyle = '#8ab8d8';
      ctx.font = `${12 * dpr}px monospace`;
      ctx.fillText(options.playerName, w / 2, 65 * dpr);

      // Quality badge
      ctx.fillStyle = colors.border;
      ctx.font = `bold ${20 * dpr}px monospace`;
      ctx.fillText(qualityNames[options.lootQuality], w / 2, 130 * dpr);

      // Loot emoji
      const qualityEmojis: Record<Quality, string> = {
        white: '📦', blue: '💎', purple: '🔮', red: '🔥', gold: '👑',
      };
      ctx.font = `${60 * dpr}px sans-serif`;
      ctx.fillText(qualityEmojis[options.lootQuality], w / 2, 220 * dpr);

      // Item name
      ctx.fillStyle = colors.text;
      ctx.font = `bold ${22 * dpr}px monospace`;
      ctx.fillText(options.lootName, w / 2, 290 * dpr);

      // Value
      ctx.fillStyle = '#fbbf24';
      ctx.font = `bold ${32 * dpr}px monospace`;
      ctx.fillText(`¥${options.lootValue.toLocaleString()}`, w / 2, 350 * dpr);

      // Zone and round info
      ctx.fillStyle = '#5a7a9a';
      ctx.font = `${14 * dpr}px monospace`;
      ctx.fillText(`${options.zoneName} · 回合 ${options.round}`, w / 2, 410 * dpr);

      // Carry value
      ctx.fillStyle = '#8ab8d8';
      ctx.font = `${16 * dpr}px monospace`;
      ctx.fillText(`携带价值 ¥${options.carryValue.toLocaleString()}`, w / 2, 450 * dpr);

      // CTA
      ctx.fillStyle = '#4a8a6a';
      ctx.font = `bold ${16 * dpr}px monospace`;
      ctx.fillText('你能比我运气更好吗？', w / 2, 540 * dpr);

      // QR code placeholder
      ctx.fillStyle = '#2a3a4a';
      ctx.fillRect(w / 2 - 30 * dpr, 570 * dpr, 60 * dpr, 60 * dpr);
      ctx.fillStyle = '#5a7a9a';
      ctx.font = `${10 * dpr}px monospace`;
      ctx.fillText('扫码试玩', w / 2, 610 * dpr);

      resolve(card.toDataURL('image/png'));
    });
  }

  /**
   * Download a clip or share card
   */
  downloadClip(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  /**
   * Share to WeChat (copy link)
   */
  async shareToWeChat(shareUrl: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== Cleanup ====================

  dispose() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
    }
    this.isRecording = false;
    this.canvas = null;
  }

  // ==================== Helpers ====================

  private getSupportedMimeType(): string | null {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return null;
  }
}

// Singleton
export const clipRecorder = new ClipRecorder();
