'use client';

import { useState, useEffect } from 'react';
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

const ALL_QUALITIES: GachaQuality[] = ['gold', 'red', 'purple', 'blue', 'white'];

interface Stats {
  totalPulls: number;
  pullsToday: number;
  dailyLimit: number;
  streak: { current: number; longest: number; lastPullDate: string | null };
  pityProgress: { current: number; target: number };
  qualityBreakdown: Record<GachaQuality, number>;
  recentPulls: Array<{ name: string; quality: GachaQuality; createdAt: string }>;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/gacha/stats');
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-sm text-zinc-600">加载中...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-dvh bg-[#0a0a0a] text-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="text-3xl mb-3">📊</div>
          <div className="text-sm text-zinc-500">无法加载统计数据</div>
          <a
            href="/"
            className="inline-block mt-4 px-6 py-2 bg-zinc-800 text-sm rounded-xl"
          >
            返回
          </a>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(1, ...Object.values(stats.qualityBreakdown));

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white max-w-[430px] mx-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <a href="/" className="text-zinc-500 text-sm">
          ‹ 返回
        </a>
        <h1 className="text-lg font-bold mt-2">统计</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 px-4 mt-4">
        <StatCard label="总开箱次数" value={String(stats.totalPulls)} />
        <StatCard
          label="今日剩余"
          value={`${stats.dailyLimit - stats.pullsToday}/${stats.dailyLimit}`}
        />
        <StatCard
          label="当前连抽"
          value={String(stats.streak.current)}
          sub={stats.streak.current >= 3 ? '🔥' : undefined}
        />
        <StatCard label="最长连抽" value={String(stats.streak.longest)} />
      </div>

      {/* Pity progress */}
      <div className="px-4 mt-6">
        <div className="bg-zinc-900 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">保底进度</span>
            <span className="text-xs text-red-400">
              {stats.pityProgress.current}/{stats.pityProgress.target}
            </span>
          </div>
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (stats.pityProgress.current / stats.pityProgress.target) * 100)}%`,
                background:
                  stats.pityProgress.current >= 40
                    ? 'linear-gradient(90deg, #ef4444, #fbbf24)'
                    : '#ef4444',
              }}
            />
          </div>
          <div className="text-[10px] text-zinc-600 mt-1.5">
            距离保底红色品质还需 {stats.pityProgress.target - stats.pityProgress.current} 次
          </div>
        </div>
      </div>

      {/* Quality breakdown */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-bold mb-3">品质分布</h2>
        <div className="space-y-2">
          {ALL_QUALITIES.map((q) => {
            const count = stats.qualityBreakdown[q] ?? 0;
            const pct = stats.totalPulls > 0 ? (count / stats.totalPulls) * 100 : 0;
            return (
              <div key={q} className="flex items-center gap-3">
                <span
                  className="text-xs w-8 text-right"
                  style={{ color: QUALITY_COLORS[q] }}
                >
                  {QUALITY_LABEL[q]}
                </span>
                <div className="flex-1 h-5 bg-zinc-900 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{
                      width: `${Math.max(pct > 0 ? 4 : 0, (count / maxCount) * 100)}%`,
                      backgroundColor: QUALITY_COLORS[q],
                    }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-12 text-right">
                  {count} ({pct.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent pulls */}
      <div className="px-4 mt-6 pb-20">
        <h2 className="text-sm font-bold mb-3">最近获得</h2>
        {stats.recentPulls.length === 0 ? (
          <div className="text-xs text-zinc-600">暂无记录</div>
        ) : (
          <div className="space-y-2">
            {stats.recentPulls.map((pull, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-zinc-900 rounded-lg px-3 py-2"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: QUALITY_COLORS[pull.quality] }}
                />
                <span className="text-sm flex-1 truncate">{pull.name}</span>
                <span className="text-[10px] text-zinc-600">
                  {new Date(pull.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-zinc-900 rounded-xl p-3">
      <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
      <div className="text-xl font-bold">
        {value} {sub && <span className="text-base">{sub}</span>}
      </div>
    </div>
  );
}
