// GachaEngine — 4-phase state machine for gacha pull animations
// Adapted from ExtractionEngine. Keeps: particle system, quality effects,
// screen shake/flash, canvas lifecycle, event system.
// Replaces: RPG phases with gacha phases (idle → opening → revealing → result)

import type { GachaQuality } from '../gacha-constants';

// ==================== Types ====================

export type GachaPhase = 'idle' | 'opening' | 'revealing' | 'result';

export interface GachaLoot {
  quality: GachaQuality;
  itemName: string;
  itemValue: number;
  affixes: Array<{ type: string; description: string }>;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'sparkle' | 'fire' | 'smoke' | 'ray' | 'confetti';
}

export interface GachaState {
  phase: GachaPhase;
  crateName: string;
  loot: GachaLoot | null;
  // Animation timing (ms into current phase)
  phaseTime: number;
  // Visual FX state
  shakeIntensity: number;
  flashColor: string | null;
  flashAlpha: number;
  particles: Particle[];
  // Animation configs
  reducedMotion: boolean;
}

// ==================== Quality Config ====================

const QUALITY_COLORS: Record<GachaQuality, string> = {
  white: '#888888',
  blue: '#4a90e2',
  purple: '#a855f7',
  red: '#ef4444',
  gold: '#fbbf24',
};

const QUALITY_NAMES: Record<GachaQuality, string> = {
  white: '普通',
  blue: '精良',
  purple: '稀有',
  red: '史诗',
  gold: '传说',
};

// ==================== Engine ====================

export class GachaEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private animationFrame = 0;
  private state: GachaState;
  private listeners: Map<string, Array<(data: any) => void>> = new Map();
  private dpr = 1;
  private lastTime = 0;

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): GachaState {
    return {
      phase: 'idle',
      crateName: '',
      loot: null,
      phaseTime: 0,
      shakeIntensity: 0,
      flashColor: null,
      flashAlpha: 0,
      particles: [],
      reducedMotion:
        typeof window !== 'undefined'
          ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
          : false,
    };
  }

  // ==================== Lifecycle ====================

  mount(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    this.startLoop();
  }

  unmount() {
    this.stopLoop();
    this.canvas = null;
    this.ctx = null;
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width * this.dpr;
    this.height = rect.height * this.dpr;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  // ==================== State ====================

  setState(partial: Partial<GachaState>) {
    this.state = { ...this.state, ...partial };
    this.emit('stateChange', this.state);
  }

  getState(): GachaState {
    return { ...this.state };
  }

  // ==================== Pull Lifecycle ====================

  /**
   * Start a gacha pull. Transitions idle → opening.
   * The caller should fire the API request and call revealLoot when ready.
   */
  startPull(crateName: string) {
    this.setState({
      ...this.getInitialState(),
      phase: 'opening',
      crateName,
    });
    this.emit('pullStarted', { crateName });
  }

  /**
   * Called when the API returns the pull result.
   * Transitions opening → revealing if animation is far enough,
   * otherwise queues the reveal.
   */
  revealLoot(loot: GachaLoot) {
    if (this.state.phase !== 'opening' && this.state.phase !== 'idle') return;

    this.setState({
      phase: 'revealing',
      loot,
      phaseTime: 0,
    });

    // Trigger quality-based effects
    this.triggerQualityEffects(loot.quality);
    this.emit('lootRevealing', loot);
  }

  /**
   * Transition to result phase. Shows the loot card fully revealed.
   */
  showResult() {
    if (this.state.phase !== 'revealing') return;
    this.setState({ phase: 'result' });
    this.emit('resultShown', this.state.loot);
  }

  /**
   * Reset to idle. Ready for next pull.
   */
  reset() {
    this.setState({ ...this.getInitialState() });
  }

  // ==================== Quality Effects ====================

  private triggerQualityEffects(quality: GachaQuality) {
    if (this.state.reducedMotion) return;

    switch (quality) {
      case 'white':
        break;
      case 'blue':
        this.spawnParticles('sparkle', 20, '#4a90e2');
        break;
      case 'purple':
        this.spawnParticles('sparkle', 40, '#a855f7');
        this.setState({ flashColor: '#a855f7', flashAlpha: 0.3 });
        break;
      case 'red':
        this.spawnParticles('fire', 60, '#ef4444');
        this.setState({
          shakeIntensity: 0.8,
          flashColor: '#ef4444',
          flashAlpha: 0.5,
        });
        break;
      case 'gold':
        this.spawnParticles('ray', 80, '#fbbf24');
        this.spawnParticles('confetti', 40, '#fbbf24');
        this.setState({
          shakeIntensity: 1.0,
          flashColor: '#fbbf24',
          flashAlpha: 0.8,
        });
        break;
    }
  }

  // ==================== Particles ====================

  private spawnParticles(type: Particle['type'], count: number, color: string) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 6;

      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed * this.dpr,
        vy: Math.sin(angle) * speed * this.dpr,
        life: 1,
        maxLife: 0.6 + Math.random() * 0.6,
        size: (2 + Math.random() * 4) * this.dpr,
        color,
        type,
      });
    }

    this.state.particles = [...this.state.particles, ...particles];
  }

  private updateParticles(dt: number) {
    this.state.particles = this.state.particles
      .map((p) => ({
        ...p,
        x: p.x + p.vx * dt * 60,
        y: p.y + p.vy * dt * 60,
        vy: p.vy + (p.type === 'smoke' ? -0.02 : 0.05) * this.dpr,
        life: p.life - dt / p.maxLife,
        size:
          p.type === 'smoke'
            ? p.size + 0.3 * dt * 60 * this.dpr
            : p.size * (1 - dt),
      }))
      .filter((p) => p.life > 0);
  }

  // ==================== Render Loop ====================

  private startLoop() {
    this.lastTime = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time - this.lastTime) / 1000, 0.05);
      this.lastTime = time;

      this.update(dt);
      this.render();

      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  }

  private stopLoop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  private update(dt: number) {
    // Phase timer
    this.state.phaseTime += dt * 1000;

    // Update particles
    this.updateParticles(dt);

    // Decay screen shake
    if (this.state.shakeIntensity > 0) {
      this.state.shakeIntensity *= Math.max(0, 1 - dt * 3);
      if (this.state.shakeIntensity < 0.01) this.state.shakeIntensity = 0;
    }

    // Decay flash
    if (this.state.flashAlpha > 0) {
      this.state.flashAlpha *= Math.max(0, 1 - dt * 4);
      if (this.state.flashAlpha < 0.01) this.state.flashAlpha = 0;
    }

    // Auto-transition opening → result if loot arrives during opening
    // (the React component handles the reveal timing)
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Screen shake offset
    const shakeX =
      this.state.shakeIntensity * (Math.random() - 0.5) * 20 * this.dpr;
    const shakeY =
      this.state.shakeIntensity * (Math.random() - 0.5) * 20 * this.dpr;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Dark military background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(-10, -10, w + 20, h + 20);

    // Subtle grid pattern
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 1;
    const gridSize = 40 * this.dpr;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Phase-specific rendering
    switch (this.state.phase) {
      case 'idle':
        this.renderIdle(ctx, w, h);
        break;
      case 'opening':
        this.renderOpening(ctx, w, h);
        break;
      case 'revealing':
        this.renderRevealing(ctx, w, h);
        break;
      case 'result':
        this.renderResult(ctx, w, h);
        break;
    }

    // Render particles on top
    this.renderParticles(ctx);

    // Flash overlay
    if (this.state.flashColor && this.state.flashAlpha > 0) {
      ctx.fillStyle = this.state.flashColor;
      ctx.globalAlpha = this.state.flashAlpha;
      ctx.fillRect(-10, -10, w + 20, h + 20);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ==================== Phase Renderers ====================

  private renderIdle(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Waiting state — crate shown by React component, canvas is ambient
    ctx.fillStyle = '#1a1a1a';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  private renderOpening(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const t = this.state.phaseTime; // ms

    if (this.state.reducedMotion) {
      // Static: just show "Opening..." text
      ctx.fillStyle = '#e8e8e8';
      ctx.font = `bold ${20 * this.dpr}px "PingFang SC", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('开箱中...', w / 2, h / 2);
      return;
    }

    // CS:GO rhythm animation (3 seconds total):
    // 0-500ms: crate scales down, shakes violently
    // 500-1000ms: white glow from crate edges
    // 1000-1500ms: crate spins on Y-axis
    // 1500-2500ms: card slides up from behind
    // 2500-3000ms: card scales up then back

    const cx = w / 2;
    const cy = h / 2;
    const crateSize = 120 * this.dpr;

    ctx.save();
    ctx.translate(cx, cy);

    if (t < 500) {
      // Phase 1: shake
      const shakeX = Math.sin(t * 0.075) * 3 * this.dpr;
      const scale = 1 - (t / 500) * 0.4;
      ctx.translate(shakeX, 0);
      ctx.scale(scale, scale);
      this.drawCrate(ctx, crateSize, this.state.crateName);
    } else if (t < 1000) {
      // Phase 2: glow
      const glowProgress = (t - 500) / 500;
      ctx.scale(0.6, 0.6);

      // White glow
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 40 * glowProgress * this.dpr;
      this.drawCrate(ctx, crateSize, this.state.crateName);
      ctx.shadowBlur = 0;
    } else if (t < 1500) {
      // Phase 3: spin (simulate Y-axis rotation via scale X)
      const spinProgress = (t - 1000) / 500;
      const scaleX = Math.cos(spinProgress * Math.PI);
      ctx.scale(0.6 * Math.abs(scaleX), 0.6);

      if (Math.abs(scaleX) < 0.3) {
        // Mid-spin: show card back
        this.drawCardBack(ctx, crateSize * 1.5);
      } else {
        this.drawCrate(ctx, crateSize, this.state.crateName);
      }
    } else if (t < 2500) {
      // Phase 4: card slides up
      const slideProgress = easeOutCubic((t - 1500) / 1000);
      const cardY = (1 - slideProgress) * 200 * this.dpr;
      ctx.translate(0, cardY);
      this.drawCardBack(ctx, crateSize * 1.5);
    } else {
      // Phase 5: card scale pulse
      const pulseProgress = (t - 2500) / 500;
      const scale = pulseProgress < 0.5
        ? 1 + pulseProgress * 0.2
        : 1.1 - (pulseProgress - 0.5) * 0.2;
      ctx.scale(scale, scale);
      this.drawCardBack(ctx, crateSize * 1.5);
    }

    ctx.restore();

    // "Opening..." text at bottom
    ctx.fillStyle = '#666';
    ctx.font = `${14 * this.dpr}px "PingFang SC", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('开箱中...', cx, h - 60 * this.dpr);
  }

  private renderRevealing(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.state.loot) return;

    const { quality, itemName, itemValue } = this.state.loot;
    const color = QUALITY_COLORS[quality];
    const animProgress = Math.min(this.state.phaseTime / 600, 1); // 600ms reveal
    const scale = easeOutBack(animProgress);

    // Dim background
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.7 * animProgress;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    const cx = w / 2;
    const cy = h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // Card
    const cardW = 240 * this.dpr;
    const cardH = 320 * this.dpr;
    const rx = cx - cardW / 2;
    const ry = cy - cardH / 2;

    // Card background
    ctx.fillStyle = '#0a1520';
    roundRect(ctx, rx, ry, cardW, cardH, 16 * this.dpr);
    ctx.fill();

    // Card border with quality glow
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * this.dpr;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30 * this.dpr;
    roundRect(ctx, rx, ry, cardW, cardH, 16 * this.dpr);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Quality badge
    ctx.fillStyle = color;
    ctx.font = `bold ${18 * this.dpr}px "PingFang SC", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`★ ${QUALITY_NAMES[quality]} ★`, cx, ry + 45 * this.dpr);

    // Item name
    if (animProgress > 0.3) {
      ctx.fillStyle = '#e8e8e8';
      ctx.font = `bold ${20 * this.dpr}px "PingFang SC", system-ui, sans-serif`;
      ctx.fillText(itemName, cx, ry + 200 * this.dpr);

      // Value
      ctx.fillStyle = '#fbbf24';
      ctx.font = `bold ${24 * this.dpr}px "PingFang SC", system-ui, sans-serif`;
      ctx.fillText(`¥${itemValue.toLocaleString()}`, cx, ry + 260 * this.dpr);
    }

    ctx.restore();
  }

  private renderResult(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.state.loot) return;
    // Same as reveal but fully shown, particles may still be active
    this.renderRevealing(ctx, w, h);
  }

  // ==================== Drawing Helpers ====================

  private drawCrate(
    ctx: CanvasRenderingContext2D,
    size: number,
    name: string
  ) {
    const half = size / 2;

    // Crate body
    ctx.fillStyle = '#2a2a2a';
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 2 * this.dpr;
    ctx.fillRect(-half, -half, size, size);
    ctx.strokeRect(-half, -half, size, size);

    // Crate bands
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-half, -half, size, 8 * this.dpr);
    ctx.fillRect(-half, half - 8 * this.dpr, size, 8 * this.dpr);

    // Crate name
    ctx.fillStyle = '#888';
    ctx.font = `${12 * this.dpr}px "PingFang SC", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(name, 0, half + 25 * this.dpr);
  }

  private drawCardBack(ctx: CanvasRenderingContext2D, size: number) {
    const half = size / 2;

    ctx.fillStyle = '#1a1a2a';
    ctx.strokeStyle = '#3a3a5a';
    ctx.lineWidth = 2 * this.dpr;
    roundRect(ctx, -half, -half, size, size, 16 * this.dpr);
    ctx.fill();
    roundRect(ctx, -half, -half, size, size, 16 * this.dpr);
    ctx.stroke();

    // Question mark
    ctx.fillStyle = '#4a4a6a';
    ctx.font = `bold ${40 * this.dpr}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 0);
    ctx.textBaseline = 'alphabetic';
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.state.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;

      switch (p.type) {
        case 'sparkle':
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'fire':
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'smoke':
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'ray':
          ctx.fillRect(
            p.x - 1,
            p.y - p.size,
            2 * this.dpr,
            p.size * 2
          );
          break;
        case 'confetti':
          ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  // ==================== Events ====================

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data: any) => void) {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(callback);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  private emit(event: string, data: any) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => cb(data));
    }
  }
}

// ==================== Utils ====================

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
