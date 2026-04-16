'use client';

import { useState, useEffect, useCallback } from 'react';
import GachaCanvas from '@/components/game/GachaCanvas';
import type { GachaQuality } from '@/lib/game/gacha-constants';

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

interface SessionInfo {
  sessionId: string;
  ticketsRemaining: number;
  dailyLimit: number;
}

type PageView = 'gacha' | 'collection' | 'stats' | 'probability';

// ==================== Page Component ====================

export default function HomePage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [crates, setCrates] = useState<CrateInfo[]>([]);
  const [pityProgress, setPityProgress] = useState({ current: 0, target: 50 });
  const [view, setView] = useState<PageView>('gacha');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==================== Init ====================

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      setLoading(true);

      // Create guest session (returns existing if cookie set)
      const sessionRes = await fetch('/api/auth/guest', { method: 'POST' });
      const sessionData = await sessionRes.json();

      if (sessionRes.ok) {
        setSession({
          sessionId: sessionData.sessionId,
          ticketsRemaining: sessionData.ticketsRemaining,
          dailyLimit: sessionData.dailyLimit,
        });
      } else if (sessionRes.status === 409) {
        // Session exists — fetch stats to get ticket count
        setSession({
          sessionId: sessionData.sessionId,
          ticketsRemaining: 3, // default, will be corrected by stats
          dailyLimit: 3,
        });
      }

      // Fetch crates
      const cratesRes = await fetch('/api/gacha/crates');
      if (cratesRes.ok) {
        const cratesData = await cratesRes.json();
        setCrates(cratesData.crates ?? []);
      }

      // Fetch stats for pity progress
      try {
        const statsRes = await fetch('/api/gacha/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setPityProgress(statsData.pityProgress ?? { current: 0, target: 50 });
          if (sessionRes.status === 409) {
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    ticketsRemaining:
                      statsData.dailyLimit - statsData.pullsToday,
                    dailyLimit: statsData.dailyLimit,
                  }
                : prev
            );
          }
        }
      } catch {
        // Stats fetch failure is non-critical
      }
    } catch (err) {
      setError('初始化失败，请刷新重试');
      console.error('[Init]', err);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Loading State ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh w-full bg-[#0a0a0a] text-white">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📦</div>
          <div className="text-sm text-zinc-500">加载中...</div>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex items-center justify-center h-dvh w-full bg-[#0a0a0a] text-white">
        <div className="text-center px-8">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-sm text-red-400 mb-4">{error}</div>
          <button
            onClick={init}
            className="px-6 py-2 bg-zinc-800 rounded-lg text-sm"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // ==================== Fallback: no crates ====================

  if (crates.length === 0) {
    return (
      <div className="flex items-center justify-center h-dvh w-full bg-[#0a0a0a] text-white">
        <div className="text-center px-8">
          <div className="text-4xl mb-4">📦</div>
          <div className="text-sm text-zinc-500 mb-2">暂无可用箱子</div>
          <div className="text-xs text-zinc-600">请在后台添加箱子配置</div>
        </div>
      </div>
    );
  }

  // ==================== Main View ====================

  return (
    <div className="h-dvh w-full bg-[#0a0a0a] overflow-hidden pb-16">
      <GachaCanvas
        crates={crates}
        ticketsRemaining={session?.ticketsRemaining ?? 0}
        dailyLimit={session?.dailyLimit ?? 3}
        pityProgress={pityProgress}
      />

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-around py-2 bg-[#0a0a0]/90 backdrop-blur-sm border-t border-zinc-900 max-w-[430px] mx-auto">
        <NavButton
          active={view === 'gacha'}
          onClick={() => setView('gacha')}
          icon="📦"
          label="开箱"
        />
        <NavLink href="/collection" icon="🏆" label="收藏" />
        <NavLink href="/stats" icon="📊" label="统计" />
        <NavLink href="/probability" icon="📋" label="概率" />
      </div>
    </div>
  );
}

// ==================== Nav Button ====================

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
        active ? 'text-amber-400' : 'text-zinc-600'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-zinc-600 transition-colors active:text-amber-400"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-[10px]">{label}</span>
    </a>
  );
}
