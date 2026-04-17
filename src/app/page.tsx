'use client';

import { useState, useEffect, useCallback } from 'react';
import GachaCanvas from '@/components/game/GachaCanvas';
import type { GachaQuality } from '@/lib/game/gacha-constants';
import { useAuth } from '@/components/auth/AuthProvider';
import { UpgradePrompt } from '@/components/auth/UpgradePrompt';

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
  const { isAuthenticated, accessToken, login } = useAuth();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [crates, setCrates] = useState<CrateInfo[]>([]);
  const [pityProgress, setPityProgress] = useState({ current: 0, target: 50 });
  const [view, setView] = useState<PageView>('gacha');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // ==================== Init ====================

  useEffect(() => {
    init();
  }, []);

  const init = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // 检查是否已登录
      const storedToken = localStorage.getItem('access_token');

      if (storedToken) {
        // 已登录用户：跳过 guest 流程，直接拉用户数据
        const authHeaders = { Authorization: `Bearer ${storedToken}` };

        const statsRes = await fetch('/api/gacha/stats', { headers: authHeaders });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setSession({
            sessionId: statsData.playerId ?? '',
            ticketsRemaining: statsData.dailyLimit - statsData.pullsToday,
            dailyLimit: statsData.dailyLimit,
          });
          setPityProgress(statsData.pityProgress ?? { current: 0, target: 50 });
        }
      } else {
        // 游客：创建 guest session
        const sessionRes = await fetch('/api/auth/guest', { method: 'POST' });
        const sessionData = await sessionRes.json();

        if (sessionRes.ok) {
          setSession({
            sessionId: sessionData.sessionId,
            ticketsRemaining: sessionData.ticketsRemaining,
            dailyLimit: sessionData.dailyLimit,
          });
        } else if (sessionRes.status === 409) {
          setSession({
            sessionId: sessionData.sessionId,
            ticketsRemaining: 3,
            dailyLimit: 3,
          });
        }

        // 游客拉 stats（用 cookie 鉴权）
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
                      ticketsRemaining: statsData.dailyLimit - statsData.pullsToday,
                      dailyLimit: statsData.dailyLimit,
                    }
                  : prev
              );
            }
          }
        } catch {
          // Stats fetch failure is non-critical
        }
      }

      // Fetch crates
      const cratesRes = await fetch('/api/gacha/crates');
      if (cratesRes.ok) {
        const cratesData = await cratesRes.json();
        setCrates(cratesData.crates ?? []);
      }
    } catch (err) {
      setError('初始化失败，请刷新重试');
      console.error('[Init]', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ==================== Upgrade Handlers ====================

  const handleUpgradeClick = () => {
    setShowUpgradePrompt(true);
  };

  const handleUpgradeSuccess = async (data: { accessToken: string; playerId: string; user: any }) => {
    login(data.accessToken, data.playerId, data.user);
    await init(true); // silent refresh, no loading flash
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
      {/* 升级提示横幅（如果未登录） */}
      {!isAuthenticated && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center justify-between">
            <div className="text-sm text-amber-400">
              <span className="font-medium">游客模式</span>
              <span className="text-zinc-500 ml-2">升级账号可保存记录，每日+2次开箱</span>
            </div>
            <button
              onClick={handleUpgradeClick}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black text-sm font-medium rounded transition-colors"
            >
              升级
            </button>
          </div>
        </div>
      )}

      <GachaCanvas
        crates={crates}
        ticketsRemaining={session?.ticketsRemaining ?? 0}
        dailyLimit={session?.dailyLimit ?? 3}
        pityProgress={pityProgress}
        accessToken={isAuthenticated ? accessToken : null}
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

      {/* 升级引导抽屉 */}
      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        guestSessionId={session?.sessionId}
        onUpgradeSuccess={handleUpgradeSuccess}
      />
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
