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

const ALL_QUALITIES: GachaQuality[] = ['white', 'blue', 'purple', 'red', 'gold'];

interface CrateInfo {
  id: string;
  name: string;
  dropRates: Record<GachaQuality, number>;
  starRating: number;
}

export default function ProbabilityPage() {
  const [crates, setCrates] = useState<CrateInfo[]>([]);

  useEffect(() => {
    fetch('/api/gacha/crates')
      .then((r) => r.json())
      .then((d) => setCrates(d.crates ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white max-w-[430px] mx-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <a href="/" className="text-zinc-500 text-sm">
          ‹ 返回
        </a>
        <h1 className="text-lg font-bold mt-2">概率公示</h1>
        <p className="text-xs text-zinc-500 mt-1">
          根据《网络游戏管理暂行办法》公示抽取概率
        </p>
      </div>

      {/* Per-crate rates */}
      <div className="px-4 mt-4 space-y-4 pb-20">
        {crates.map((crate) => {
          const totalRate = ALL_QUALITIES.reduce(
            (sum, q) => sum + (crate.dropRates[q] ?? 0),
            0
          );

          return (
            <div key={crate.id} className="bg-zinc-900 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">
                  {crate.starRating >= 3 ? '💎' : crate.starRating >= 2 ? '🎁' : '📦'}
                </span>
                <span className="text-sm font-bold">{crate.name}</span>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="text-left py-1 font-normal">品质</th>
                    <th className="text-right py-1 font-normal">概率</th>
                    <th className="text-right py-1 font-normal">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_QUALITIES.map((q) => {
                    const rate = crate.dropRates[q] ?? 0;
                    const pct = (rate * 100).toFixed(2);
                    return (
                      <tr key={q} className="border-t border-zinc-800">
                        <td className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: QUALITY_COLORS[q] }}
                            />
                            <span style={{ color: QUALITY_COLORS[q] }}>
                              {QUALITY_LABEL[q]}
                            </span>
                          </div>
                        </td>
                        <td className="text-right font-mono">{pct}%</td>
                        <td className="text-right text-zinc-500">
                          {rate > 0 ? `${(rate / totalRate * 100).toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700">
                    <td className="py-1.5 font-bold">合计</td>
                    <td className="text-right font-mono font-bold">
                      {(totalRate * 100).toFixed(2)}%
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}

        {/* Pity system explanation */}
        <div className="bg-zinc-900 rounded-xl p-4">
          <h2 className="text-sm font-bold mb-2">保底机制</h2>
          <ul className="text-xs text-zinc-400 space-y-1.5">
            <li>每 {50} 次开箱未获得红色或更高品质时，触发保底</li>
            <li>保底触发时，必定获得红色（史诗）品质物品</li>
            <li>自然获得红色或金色物品时，保底计数器重置为 0</li>
          </ul>
        </div>

        {/* Spending limits */}
        <div className="bg-zinc-900 rounded-xl p-4">
          <h2 className="text-sm font-bold mb-2">消费限制</h2>
          <ul className="text-xs text-zinc-400 space-y-1.5">
            <li>游客用户：每日 {3} 次免费开箱</li>
            <li>注册用户：每日 {5} 次免费开箱</li>
            <li>所有概率均经过独立验证，确保公平性</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
