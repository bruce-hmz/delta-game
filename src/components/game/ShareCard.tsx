'use client';

import { useRef, useCallback } from 'react';
import type { GachaQuality } from '@/lib/game/gacha-constants';

const QUALITY_COLORS: Record<GachaQuality, string> = {
  white: '#888888',
  blue: '#4a90e2',
  purple: '#a855f7',
  red: '#ef4444',
  gold: '#fbbf24',
};

const QUALITY_LABEL: Record<GachaQuality, string> = {
  white: '普通',
  blue: '精良',
  purple: '稀有',
  red: '史诗',
  gold: '传说',
};

interface ShareCardProps {
  itemName: string;
  quality: GachaQuality;
  value: number;
  affixes: Array<{ type: string; description: string }>;
  pityProgress: { current: number; target: number };
}

export default function ShareCard({
  itemName,
  quality,
  value,
  affixes,
  pityProgress,
}: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generatePNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const dpr = 2;
    const w = 360;
    const h = 640;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const color = QUALITY_COLORS[quality];

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // Top bar gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 120);
    gradient.addColorStop(0, color + '33');
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, 120);

    // Title
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 16px "PingFang SC", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('三角洲战利品', w / 2, 36);

    // Quality badge
    ctx.fillStyle = color;
    ctx.font = 'bold 24px "PingFang SC", system-ui, sans-serif';
    ctx.fillText(`★ ${QUALITY_LABEL[quality]} ★`, w / 2, 120);

    // Item name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "PingFang SC", system-ui, sans-serif';
    ctx.fillText(itemName, w / 2, 240);

    // Value
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 36px "PingFang SC", system-ui, sans-serif';
    ctx.fillText(`¥${value.toLocaleString()}`, w / 2, 300);

    // Divider
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 340);
    ctx.lineTo(w - 40, 340);
    ctx.stroke();

    // Affixes
    ctx.fillStyle = '#888';
    ctx.font = '14px "PingFang SC", system-ui, sans-serif';
    affixes.forEach((a, i) => {
      ctx.fillText(a.description, w / 2, 375 + i * 28);
    });

    // Pity progress
    const barY = 500;
    ctx.fillStyle = '#333';
    ctx.font = '12px "PingFang SC", system-ui, sans-serif';
    ctx.fillText(`保底进度 ${pityProgress.current}/${pityProgress.target}`, w / 2, barY - 10);

    // Progress bar
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, 60, barY, w - 120, 8, 4);
    ctx.fill();

    const progress = Math.min(1, pityProgress.current / pityProgress.target);
    ctx.fillStyle = '#ef4444';
    roundRect(ctx, 60, barY, (w - 120) * progress, 8, 4);
    ctx.fill();

    // Watermark
    ctx.fillStyle = '#333';
    ctx.font = '10px "PingFang SC", system-ui, sans-serif';
    ctx.fillText('三角洲战利品 | 开箱模拟', w / 2, h - 30);

    return canvas.toDataURL('image/png');
  }, [itemName, quality, value, affixes, pityProgress]);

  const handleShare = useCallback(async () => {
    const dataUrl = generatePNG();
    if (!dataUrl) return;

    // Try native share first
    if (navigator.share) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `战利品_${itemName}.png`, { type: 'image/png' });
        await navigator.share({
          title: '我的三角洲战利品',
          text: `刚开出 ${QUALITY_LABEL[quality]} 品质的 ${itemName}，价值 ¥${value.toLocaleString()}！`,
          files: [file],
        });
        return;
      } catch {
        // User cancelled or not supported, fall through to download
      }
    }

    // Fallback: download
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `战利品_${itemName}.png`;
    a.click();
  }, [generatePNG, itemName, quality, value]);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <button
        onClick={handleShare}
        className="h-11 px-5 rounded-xl bg-amber-500 text-black text-sm font-bold active:bg-amber-400"
      >
        分享
      </button>
    </>
  );
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
