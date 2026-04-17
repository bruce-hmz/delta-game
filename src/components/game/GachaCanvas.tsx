'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { GachaEngine } from '@/lib/game/canvas/gacha-engine';
import type { GachaLoot, GachaPhase } from '@/lib/game/canvas/gacha-engine';
import type { GachaQuality } from '@/lib/game/gacha-constants';
import { PITY_THRESHOLD } from '@/lib/game/gacha-constants';
import ShareCard from './ShareCard';

// ==================== Types ====================

interface CrateInfo {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  dropRates: Record<GachaQuality, number>;
  ticketCost: number;
  starRating: number;
}

interface PullResult {
  item: {
    id: string;
    name: string;
    quality: GachaQuality;
    value: number;
    affixes: Array<{ type: string; description: string }>;
  };
  ticketsRemaining: number;
  pityProgress: { current: number; target: number };
  isPityTriggered: boolean;
}

interface GachaCanvasProps {
  crates: CrateInfo[];
  ticketsRemaining: number;
  dailyLimit: number;
  pityProgress: { current: number; target: number };
  accessToken?: string | null;
}

// ==================== Quality Colors ====================

const QUALITY_COLORS: Record<GachaQuality, string> = {
  white: '#888888',
  blue: '#4a90e2',
  purple: '#a855f7',
  red: '#ef4444',
  gold: '#fbbf24',
};

const QUALITY_BG: Record<GachaQuality, string> = {
  white: 'bg-zinc-600',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
  gold: 'bg-amber-400',
};

const QUALITY_LABEL: Record<GachaQuality, string> = {
  white: '普通',
  blue: '精良',
  purple: '稀有',
  red: '史诗',
  gold: '传说',
};

const CRATE_EMOJI: Record<number, string> = {
  1: '📦',
  2: '🎁',
  3: '💎',
};

// ==================== Component ====================

export default function GachaCanvas({
  crates,
  ticketsRemaining: initialTickets,
  dailyLimit,
  pityProgress: initialPity,
  accessToken,
}: GachaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GachaEngine | null>(null);

  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [selectedCrate, setSelectedCrate] = useState(0);
  const [tickets, setTickets] = useState(initialTickets);
  const [pity, setPity] = useState(initialPity);
  const [loot, setLoot] = useState<PullResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Sync tickets when prop changes
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const crate = crates[selectedCrate] ?? crates[0];

  // ==================== Engine Setup ====================

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GachaEngine();
    engine.mount(canvasRef.current);
    engineRef.current = engine;

    engine.on('stateChange', (state: { phase: GachaPhase }) => {
      setPhase(state.phase);
    });

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.unmount();
      engineRef.current = null;
    };
  }, []);

  // ==================== Pull Logic ====================

  const handlePull = useCallback(async () => {
    if (isPulling || !crate || tickets <= 0) return;

    setIsPulling(true);
    setError(null);
    setShowResult(false);

    // Local ticket check first
    if (tickets <= 0) {
      setError('今日次数已用完');
      setIsPulling(false);
      return;
    }

    // Generate idempotency key
    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Start animation immediately, fire API in parallel
    const engine = engineRef.current;
    if (!engine) return;

    engine.startPull(crate.name);

    // Fire API call
    try {
      const res = await fetch('/api/gacha/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ crateId: crate.id, idempotencyKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setTickets(0);
          setError('今日次数已用完');
          engine.reset();
          setIsPulling(false);
          return;
        }
        throw new Error(data.error || 'pull_failed');
      }

      const result = data as PullResult;

      // Wait for opening animation minimum time (1.5s)
      await new Promise((r) => setTimeout(r, 1500));

      // Reveal loot
      const gachaLoot: GachaLoot = {
        quality: result.item.quality,
        itemName: result.item.name,
        itemValue: result.item.value,
        affixes: result.item.affixes,
      };

      engine.revealLoot(gachaLoot);
      setLoot(result);
      setTickets(result.ticketsRemaining);
      setPity(result.pityProgress);

      // After reveal animation (1.5s), show result UI
      await new Promise((r) => setTimeout(r, 1500));
      engine.showResult();
      setShowResult(true);
    } catch (err: any) {
      setError(err.message || '网络错误');
      engine.reset();
    } finally {
      setIsPulling(false);
    }
  }, [crate, tickets, isPulling]);

  const handleReset = useCallback(() => {
    engineRef.current?.reset();
    setLoot(null);
    setShowResult(false);
    setError(null);
  }, []);

  // ==================== Crate Swipe ====================

  const handlePrevCrate = useCallback(() => {
    if (isPulling) return;
    setSelectedCrate((prev) => (prev - 1 + crates.length) % crates.length);
  }, [isPulling, crates.length]);

  const handleNextCrate = useCallback(() => {
    if (isPulling) return;
    setSelectedCrate((prev) => (prev + 1) % crates.length);
  }, [isPulling, crates.length]);

  // Touch swipe support
  const touchStartRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartRef.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStartRef.current;
      if (Math.abs(diff) > 50) {
        if (diff > 0) handlePrevCrate();
        else handleNextCrate();
      }
      touchStartRef.current = null;
    },
    [handlePrevCrate, handleNextCrate]
  );

  // ==================== Render ====================

  return (
    <div className="flex flex-col h-full w-full max-w-[430px] mx-auto bg-[#0a0a0a] text-white select-none">
      {/* Header: Tickets + Pity */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-lg">🎫</span>
          <span className="text-sm font-bold">
            {tickets}/{dailyLimit}
          </span>
          <span className="text-xs text-zinc-500">今日剩余</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">保底</span>
          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (pity.current / pity.target) * 100)}%`,
              }}
            />
          </div>
          <span className="text-xs text-zinc-400">
            {pity.current}/{pity.target}
          </span>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none' }}
        />

        {/* Crate selector overlay (idle only) */}
        {phase === 'idle' && !showResult && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Crate nav arrows */}
            {crates.length > 1 && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-auto">
                <button
                  onClick={handlePrevCrate}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900/80 text-zinc-400 active:bg-zinc-800"
                >
                  ‹
                </button>
              </div>
            )}
            {crates.length > 1 && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-auto">
                <button
                  onClick={handleNextCrate}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900/80 text-zinc-400 active:bg-zinc-800"
                >
                  ›
                </button>
              </div>
            )}

            {/* Crate info */}
            {crate && (
              <div className="text-center mt-24">
                <div className="text-4xl mb-2">
                  {CRATE_EMOJI[crate.starRating] || '📦'}
                </div>
                <div className="text-lg font-bold">{crate.name}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {crate.description}
                </div>
                {/* Drop rates */}
                <div className="flex gap-2 mt-3 justify-center">
                  {(Object.entries(crate.dropRates) as [GachaQuality, number][]).map(
                    ([q, rate]) => (
                      <div key={q} className="flex flex-col items-center">
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: QUALITY_COLORS[q] }}
                        >
                          {(rate * 100).toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-zinc-600">
                          {QUALITY_LABEL[q]}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Crate dots */}
            {crates.length > 1 && (
              <div className="flex gap-1.5 mt-4">
                {crates.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === selectedCrate ? 'bg-amber-400' : 'bg-zinc-700'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Result overlay */}
        {showResult && loot && (
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-32 pointer-events-auto">
            <div className="bg-zinc-900/90 backdrop-blur-sm rounded-2xl p-5 mx-4 w-[calc(100%-32px)] max-w-[360px]">
              {/* Quality badge */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`w-2 h-2 rounded-full ${QUALITY_BG[loot.item.quality]}`}
                />
                <span
                  className="text-xs font-bold"
                  style={{ color: QUALITY_COLORS[loot.item.quality] }}
                >
                  {QUALITY_LABEL[loot.item.quality]}
                </span>
                {loot.isPityTriggered && (
                  <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">
                    保底触发
                  </span>
                )}
              </div>

              {/* Item name */}
              <div className="text-xl font-bold mb-1">{loot.item.name}</div>

              {/* Value */}
              <div className="text-amber-400 text-2xl font-bold mb-3">
                ¥{loot.item.value.toLocaleString()}
              </div>

              {/* Affixes */}
              {loot.item.affixes.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {loot.item.affixes.map((a, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded"
                    >
                      {a.description}
                    </span>
                  ))}
                </div>
              )}

              {/* Pity progress */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-zinc-500">保底进度</span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (loot.pityProgress.current / loot.pityProgress.target) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-zinc-400">
                  {loot.pityProgress.current}/{loot.pityProgress.target}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 h-11 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold active:bg-zinc-700"
                >
                  继续
                </button>
                <ShareCard
                  itemName={loot.item.name}
                  quality={loot.item.quality}
                  value={loot.item.value}
                  affixes={loot.item.affixes}
                  pityProgress={loot.pityProgress}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error toast */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-200 text-sm px-4 py-2 rounded-lg z-50">
          {error}
          <button
            className="ml-2 text-red-400"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Bottom: Open Button */}
      <div className="px-4 pb-6 pt-2">
        {tickets > 0 ? (
          <button
            onClick={handlePull}
            disabled={isPulling || phase !== 'idle' || !crate}
            className={`w-full h-14 rounded-2xl text-lg font-bold transition-all active:scale-[0.98] ${
              isPulling || phase !== 'idle'
                ? 'bg-zinc-800 text-zinc-500'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20'
            }`}
          >
            {isPulling ? '开箱中...' : phase !== 'idle' ? '开箱中...' : '打开'}
          </button>
        ) : (
          <div className="text-center">
            <div className="text-zinc-500 text-sm mb-2">今日次数已用完</div>
            <button className="w-full h-12 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold">
              注册获取更多次数
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
