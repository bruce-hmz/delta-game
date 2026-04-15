// Canvas extraction run engine
// Drives the visual state machine for gacha extraction runs

import type { Quality, ZoneType } from '../types';

// ==================== Types ====================

export type RunPhase =
  | 'idle'           // Waiting to start (zone select)
  | 'entering'       // Zone entry animation
  | 'progress'       // Run progress bar filling
  | 'event'          // Event popup/beat
  | 'loot-reveal'    // The gacha reveal moment
  | 'risk-check'     // Risk meter escalation
  | 'decision'       // Extract or continue
  | 'extracting'     // Extraction animation
  | 'death'          // Death animation
  | 'complete';      // Run complete, showing results

export interface RunEvent {
  id: string;
  icon: string;
  text: string;
  type: 'loot' | 'combat' | 'trap' | 'npc' | 'ambush' | 'treasure';
  success: boolean;
}

export interface LootRevealState {
  quality: Quality;
  itemName: string;
  itemValue: number;
  emoji: string;
  revealed: boolean;
  animProgress: number; // 0-1
}

export interface RunState {
  phase: RunPhase;
  zone: ZoneType | null;
  zoneName: string;
  round: number;
  progress: number;        // 0-1 run progress
  exposure: number;        // 0-10
  loadLevel: string;
  riskStars: number;
  carryValue: number;
  events: RunEvent[];
  currentEvent: RunEvent | null;
  loot: LootRevealState | null;
  isAlive: boolean;
  extracted: boolean;
  totalValue: number;
  // Animation state
  shakeIntensity: number;  // Screen shake 0-1
  flashColor: string | null;
  flashAlpha: number;
  particles: Particle[];
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

// ==================== Zone Config ====================

const ZONE_COLORS: Record<ZoneType, { bg: string; accent: string; danger: string }> = {
  normal: { bg: '#0a1520', accent: '#2a5a3a', danger: '#4a8a3a' },
  dangerous: { bg: '#1a1520', accent: '#5a4a2a', danger: '#8a6a2a' },
  boss: { bg: '#1a0a15', accent: '#5a2a2a', danger: '#8a3a3a' },
};

// ==================== Engine ====================

export class ExtractionEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private animationFrame = 0;
  private state: RunState;
  private listeners: Map<string, Array<(data: any) => void>> = new Map();
  private dpr = 1;

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): RunState {
    return {
      phase: 'idle',
      zone: null,
      zoneName: '',
      round: 0,
      progress: 0,
      exposure: 0,
      loadLevel: 'light',
      riskStars: 1,
      carryValue: 0,
      events: [],
      currentEvent: null,
      loot: null,
      isAlive: true,
      extracted: false,
      totalValue: 0,
      shakeIntensity: 0,
      flashColor: null,
      flashAlpha: 0,
      particles: [],
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

  // ==================== State Updates ====================

  setState(partial: Partial<RunState>) {
    this.state = { ...this.state, ...partial };
    this.emit('stateChange', this.state);
  }

  getState(): RunState {
    return { ...this.state };
  }

  startRun(zone: ZoneType) {
    const zoneNames: Record<ZoneType, string> = {
      normal: '废弃居民区',
      dangerous: '军事仓库',
      boss: '黑区实验室',
    };
    this.setState({
      ...this.getInitialState(),
      phase: 'entering',
      zone,
      zoneName: zoneNames[zone],
    });

    // Transition to progress after entry animation
    setTimeout(() => {
      if (this.state.phase === 'entering') {
        this.setState({ phase: 'progress', progress: 0 });
      }
    }, 1200);
  }

  addEvent(event: RunEvent) {
    const events = [...this.state.events, event];
    this.setState({
      events,
      currentEvent: event,
      phase: 'event',
    });
  }

  showLootReveal(quality: Quality, itemName: string, itemValue: number) {
    const qualityEmojis: Record<Quality, string> = {
      white: '⚪', blue: '🔵', purple: '🟣', red: '🔴', gold: '🟡',
    };

    this.setState({
      phase: 'loot-reveal',
      loot: {
        quality,
        itemName,
        itemValue,
        emoji: qualityEmojis[quality],
        revealed: false,
        animProgress: 0,
      },
    });

    // Trigger effects based on quality
    this.triggerQualityEffects(quality);
  }

  private triggerQualityEffects(quality: Quality) {
    switch (quality) {
      case 'white':
        // Simple glow, no particles
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

  showDecision(carryValue: number, exposure: number) {
    this.setState({
      phase: 'decision',
      carryValue,
      exposure,
    });
  }

  startExtraction() {
    this.setState({ phase: 'extracting' });
  }

  showDeath() {
    this.spawnParticles('smoke', 30, '#333');
    this.setState({
      phase: 'death',
      isAlive: false,
      flashColor: '#ff0000',
      flashAlpha: 0.6,
    });
  }

  completeRun(totalValue: number, extracted: boolean) {
    this.setState({
      phase: 'complete',
      totalValue,
      extracted,
    });
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

    this.setState({
      particles: [...this.state.particles, ...particles],
    });
  }

  private updateParticles(dt: number) {
    const updated = this.state.particles
      .map(p => ({
        ...p,
        x: p.x + p.vx * dt * 60,
        y: p.y + p.vy * dt * 60,
        vy: p.vy + (p.type === 'smoke' ? -0.02 : 0.05) * this.dpr,
        life: p.life - dt / p.maxLife,
        size: p.type === 'smoke' ? p.size + 0.3 * dt * 60 * this.dpr : p.size * (1 - dt),
      }))
      .filter(p => p.life > 0);

    this.state.particles = updated;
  }

  // ==================== Rendering ====================

  private startLoop() {
    let lastTime = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

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

    // Animate loot reveal
    if (this.state.phase === 'loot-reveal' && this.state.loot) {
      const progress = Math.min(this.state.loot.animProgress + dt * 1.5, 1);
      this.state.loot = { ...this.state.loot, animProgress: progress };
      if (progress >= 0.5 && !this.state.loot.revealed) {
        this.state.loot = { ...this.state.loot, revealed: true };
        this.emit('lootRevealed', this.state.loot);
      }
    }

    // Progress bar auto-advance
    if (this.state.phase === 'progress') {
      const newProgress = Math.min(this.state.progress + dt * 0.08, 1);
      this.state.progress = newProgress;
    }
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Screen shake offset
    const shakeX = this.state.shakeIntensity * (Math.random() - 0.5) * 20 * this.dpr;
    const shakeY = this.state.shakeIntensity * (Math.random() - 0.5) * 20 * this.dpr;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background
    const bgColor = this.state.zone ? ZONE_COLORS[this.state.zone].bg : '#050a10';
    ctx.fillStyle = bgColor;
    ctx.fillRect(-10, -10, w + 20, h + 20);

    // Phase-specific rendering
    switch (this.state.phase) {
      case 'idle':
        this.renderIdle(ctx, w, h);
        break;
      case 'entering':
        this.renderEntering(ctx, w, h);
        break;
      case 'progress':
      case 'event':
        this.renderProgress(ctx, w, h);
        break;
      case 'loot-reveal':
        this.renderLootReveal(ctx, w, h);
        break;
      case 'decision':
        this.renderDecision(ctx, w, h);
        break;
      case 'extracting':
        this.renderExtracting(ctx, w, h);
        break;
      case 'death':
        this.renderDeath(ctx, w, h);
        break;
      case 'complete':
        this.renderComplete(ctx, w, h);
        break;
    }

    // Render particles
    this.renderParticles(ctx);

    // Render flash overlay
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
    ctx.fillStyle = '#3a5a7a';
    ctx.font = `bold ${18 * this.dpr}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('选择区域开始行动', w / 2, h / 2);
  }

  private renderEntering(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const colors = this.state.zone ? ZONE_COLORS[this.state.zone] : ZONE_COLORS.normal;

    // Zone name reveal with scan line effect
    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    // Zone name
    ctx.fillStyle = '#e8e8e8';
    ctx.font = `bold ${28 * this.dpr}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(this.state.zoneName, w / 2, h / 2 - 20 * this.dpr);

    // Risk indicator
    ctx.fillStyle = colors.danger;
    ctx.font = `${14 * this.dpr}px monospace`;
    ctx.fillText('正在进入区域...', w / 2, h / 2 + 20 * this.dpr);
  }

  private renderProgress(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const colors = this.state.zone ? ZONE_COLORS[this.state.zone] : ZONE_COLORS.normal;
    const barY = h * 0.7;
    const barH = 12 * this.dpr;
    const barW = w * 0.8;
    const barX = w * 0.1;

    // Progress bar background
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(barX, barY, barW, barH);

    // Progress bar fill
    const gradient = ctx.createLinearGradient(barX, 0, barX + barW * this.state.progress, 0);
    gradient.addColorStop(0, colors.accent);
    gradient.addColorStop(1, colors.danger);
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barW * this.state.progress, barH);

    // Progress bar glow
    ctx.shadowColor = colors.danger;
    ctx.shadowBlur = 10 * this.dpr;
    ctx.fillRect(barX, barY, barW * this.state.progress, barH);
    ctx.shadowBlur = 0;

    // Round counter
    ctx.fillStyle = '#8ab8d8';
    ctx.font = `bold ${14 * this.dpr}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`回合 ${this.state.round}`, barX, barY - 10 * this.dpr);

    // Exposure meter
    ctx.textAlign = 'right';
    ctx.fillStyle = this.state.exposure > 6 ? '#ef4444' : '#8ab8d8';
    ctx.fillText(`暴露 ${this.state.exposure}/10`, barX + barW, barY - 10 * this.dpr);

    // Event icons
    const eventY = h * 0.3;
    const spacing = 40 * this.dpr;
    const startX = w / 2 - (this.state.events.length * spacing) / 2;
    ctx.font = `${20 * this.dpr}px sans-serif`;
    ctx.textAlign = 'center';
    this.state.events.forEach((event, i) => {
      ctx.globalAlpha = event.success ? 1 : 0.5;
      ctx.fillText(event.icon, startX + i * spacing, eventY);
    });
    ctx.globalAlpha = 1;
  }

  private renderLootReveal(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.state.loot) return;

    const { quality, itemName, itemValue, animProgress } = this.state.loot;
    const qualityColors: Record<Quality, string> = {
      white: '#888888', blue: '#4a90e2', purple: '#a855f7', red: '#ef4444', gold: '#fbbf24',
    };
    const qualityNames: Record<Quality, string> = {
      white: '普通', blue: '精良', purple: '稀有', red: '史诗', gold: '传说',
    };

    const color = qualityColors[quality];
    const scale = easeOutBack(animProgress);

    // Dimming overlay
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.6 * animProgress;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    // Center card
    const cardW = 240 * this.dpr;
    const cardH = 300 * this.dpr;
    const cardX = w / 2 - (cardW * scale) / 2;
    const cardY = h / 2 - (cardH * scale) / 2;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    // Card background
    ctx.fillStyle = '#0a1520';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * this.dpr;
    const rx = w / 2 - cardW / 2;
    const ry = h / 2 - cardH / 2;
    ctx.fillRect(rx, ry, cardW, cardH);
    ctx.strokeRect(rx, ry, cardW, cardH);

    // Glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 30 * this.dpr;
    ctx.strokeRect(rx, ry, cardW, cardH);
    ctx.shadowBlur = 0;

    // Quality label
    ctx.fillStyle = color;
    ctx.font = `bold ${16 * this.dpr}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(qualityNames[quality], w / 2, ry + 40 * this.dpr);

    // Item emoji
    ctx.font = `${48 * this.dpr}px sans-serif`;
    const qualityEmojis: Record<Quality, string> = {
      white: '📦', blue: '💎', purple: '🔮', red: '🔥', gold: '👑',
    };
    ctx.fillText(qualityEmojis[quality], w / 2, ry + 120 * this.dpr);

    // Item name
    if (animProgress > 0.5) {
      ctx.fillStyle = '#e8e8e8';
      ctx.font = `bold ${18 * this.dpr}px monospace`;
      ctx.fillText(itemName, w / 2, ry + 190 * this.dpr);

      // Value
      ctx.fillStyle = '#fbbf24';
      ctx.font = `bold ${22 * this.dpr}px monospace`;
      ctx.fillText(`¥${itemValue.toLocaleString()}`, w / 2, ry + 240 * this.dpr);
    }

    ctx.restore();
  }

  private renderDecision(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = '#0a0a0a';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#e8e8e8';
    ctx.font = `bold ${20 * this.dpr}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('继续搜索还是撤离？', w / 2, h * 0.3);

    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${36 * this.dpr}px monospace`;
    ctx.fillText(`¥${this.state.carryValue.toLocaleString()}`, w / 2, h * 0.45);

    // Risk indicator
    const riskColor = this.state.exposure > 6 ? '#ef4444' : this.state.exposure > 3 ? '#f59e0b' : '#22c55e';
    ctx.fillStyle = riskColor;
    ctx.font = `${16 * this.dpr}px monospace`;
    ctx.fillText(`暴露度: ${this.state.exposure}/10`, w / 2, h * 0.55);
  }

  private renderExtracting(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Helicopter extraction animation
    ctx.fillStyle = '#1a4a3a';
    ctx.font = `bold ${24 * this.dpr}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('🚁 正在撤离...', w / 2, h / 2);

    // Pulsing circle
    const t = Date.now() / 1000;
    const radius = (30 + Math.sin(t * 3) * 10) * this.dpr;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 40 * this.dpr, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#4a8a6a';
    ctx.lineWidth = 3 * this.dpr;
    ctx.stroke();
  }

  private renderDeath(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ef4444';
    ctx.font = `bold ${32 * this.dpr}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('💀 任务失败', w / 2, h / 2);
  }

  private renderComplete(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.state.extracted) {
      ctx.fillStyle = '#0a1a15';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#22c55e';
      ctx.font = `bold ${28 * this.dpr}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('✅ 撤离成功！', w / 2, h * 0.35);

      ctx.fillStyle = '#fbbf24';
      ctx.font = `bold ${36 * this.dpr}px monospace`;
      ctx.fillText(`¥${this.state.totalValue.toLocaleString()}`, w / 2, h * 0.5);
    } else {
      this.renderDeath(ctx, w, h);
    }
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
          ctx.fillRect(p.x - 1, p.y - p.size, 2 * this.dpr, p.size * 2);
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
      list.forEach(cb => cb(data));
    }
  }
}

// ==================== Utils ====================

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
