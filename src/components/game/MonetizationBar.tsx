'use client';

import { useState } from 'react';
import { ticketSystem, boosterSystem, battlePass, BATTLE_PASS_TIERS, COSMETIC_ITEMS, getOwnedCosmetics, purchaseCosmetic } from '@/lib/game/canvas/ticket-system';

interface MonetizationBarProps {
  money: number;
  onSpend: (amount: number) => boolean;
}

export default function MonetizationBar({ money, onSpend }: MonetizationBarProps) {
  const [showPanel, setShowPanel] = useState<'none' | 'tickets' | 'boosters' | 'battlepass' | 'cosmetics'>('none');
  const remaining = ticketSystem.getRemainingRuns();
  const isInfinite = remaining === Infinity;
  const passTier = battlePass.getCurrentTier();
  const passProgress = battlePass.getProgress();
  const ownedCosmetics = getOwnedCosmetics();

  return (
    <div className="border-t border-[#1a2a3a] bg-[#0a0a15]">
      {/* Quick stats bar */}
      <div className="flex items-center justify-between p-2 text-xs">
        <div className="flex items-center gap-3">
          {/* Tickets */}
          <button
            onClick={() => setShowPanel(showPanel === 'tickets' ? 'none' : 'tickets')}
            className={`flex items-center gap-1 px-2 py-1 border transition-colors ${
              !isInfinite && remaining <= 1 ? 'border-red-700 text-red-400 bg-red-900/20' : 'border-[#2a3a4a] text-[#8ab8d8]'
            }`}
          >
            <span>🎫</span>
            <span>{isInfinite ? '无限' : `${remaining}/${ticketSystem.getState().maxFreeRuns}`}</span>
          </button>

          {/* Battle Pass */}
          <button
            onClick={() => setShowPanel(showPanel === 'battlepass' ? 'none' : 'battlepass')}
            className="flex items-center gap-1 px-2 py-1 border border-[#2a3a4a] text-[#8ab8d8] transition-colors"
          >
            <span>🏅</span>
            <span>Lv.{passTier}</span>
            <div className="w-12 h-1 bg-[#1a2a3a] overflow-hidden">
              <div className="h-full bg-[#4a8a6a]" style={{ width: `${passProgress.percentage}%` }} />
            </div>
          </button>

          {/* Boosters */}
          <button
            onClick={() => setShowPanel(showPanel === 'boosters' ? 'none' : 'boosters')}
            className="flex items-center gap-1 px-2 py-1 border border-[#2a3a4a] text-[#8ab8d8] transition-colors"
          >
            <span>⚡</span>
            <span>{boosterSystem.getActiveBoosters().length} 增幅</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-yellow-400">💰 {money.toLocaleString()}</span>
          <button
            onClick={() => setShowPanel(showPanel === 'cosmetics' ? 'none' : 'cosmetics')}
            className="px-2 py-1 border border-[#2a3a4a] text-[#8ab8d8] hover:border-[#4a5a6a] transition-colors"
          >
            🎨
          </button>
        </div>
      </div>

      {/* Expandable Panels */}
      {showPanel !== 'none' && (
        <div className="border-t border-[#1a2a3a] p-3 max-h-60 overflow-y-auto">
          {/* Tickets Panel */}
          {showPanel === 'tickets' && (
            <div className="space-y-2">
              <div className="text-sm font-bold text-[#c8d8e8]">🎫 行动门票</div>
              <div className="text-xs text-[#5a7a9a]">
                每日免费 {ticketSystem.getState().maxFreeRuns} 次 | 今日剩余 {isInfinite ? '∞' : remaining} 次
              </div>
              {!ticketSystem.getState().premium && (
                <div className="p-2 bg-[#1a2a4a]/30 border border-[#2a4a6a]">
                  <div className="text-xs text-[#8ab8d8] font-bold mb-1">👑 升级VIP</div>
                  <div className="text-xs text-[#5a7a9a] mb-2">无限行动 + 专属增幅 + VIP徽章</div>
                  <button className="w-full py-1.5 bg-gradient-to-r from-yellow-700 to-yellow-600 text-black text-xs font-bold">
                    ¥18/月 立即开通
                  </button>
                </div>
              )}
              <button className="w-full py-1.5 bg-[#1a2a3a] text-[#8ab8d8] text-xs border border-[#2a3a4a] hover:bg-[#2a3a4a]">
                📺 看广告 +1 次行动
              </button>
            </div>
          )}

          {/* Boosters Panel */}
          {showPanel === 'boosters' && (
            <div className="space-y-2">
              <div className="text-sm font-bold text-[#c8d8e8]">⚡ 幸运增幅</div>
              <div className="text-xs text-[#5a7a9a] mb-2">提高稀有掉落概率</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (onSpend(500)) {
                      boosterSystem.activateBooster({ red: 0.03 }, 30);
                    }
                  }}
                  disabled={money < 500}
                  className="p-2 bg-[#1a0a15] border border-purple-800 hover:border-purple-600 disabled:opacity-50 transition-colors"
                >
                  <div className="text-xs font-bold text-purple-400">🔥 红装增幅</div>
                  <div className="text-xs text-[#5a7a9a]">红装+3% | 30分钟</div>
                  <div className="text-xs text-yellow-400 mt-1">¥500</div>
                </button>
                <button
                  onClick={() => {
                    if (onSpend(1000)) {
                      boosterSystem.activateBooster({ red: 0.03, gold: 0.02 }, 60);
                    }
                  }}
                  disabled={money < 1000}
                  className="p-2 bg-[#1a1a0a] border border-yellow-800 hover:border-yellow-600 disabled:opacity-50 transition-colors"
                >
                  <div className="text-xs font-bold text-yellow-400">👑 金装增幅</div>
                  <div className="text-xs text-[#5a7a9a]">红+3% 金+2% | 1小时</div>
                  <div className="text-xs text-yellow-400 mt-1">¥1000</div>
                </button>
              </div>
              {boosterSystem.getActiveBoosters().length > 0 && (
                <div className="text-xs text-green-400 mt-1">✅ {boosterSystem.getActiveBoosters().length} 个增幅生效中</div>
              )}
            </div>
          )}

          {/* Battle Pass Panel */}
          {showPanel === 'battlepass' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-[#c8d8e8]">🏅 战斗通行证</div>
                <div className="text-xs text-[#5a7a9a]">Lv.{passTier} | {battlePass.getXP()} XP</div>
              </div>
              <div className="w-full h-2 bg-[#1a2a3a] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#2a5a3a] to-[#4a8a6a] transition-all" style={{ width: `${passProgress.percentage}%` }} />
              </div>
              <div className="space-y-1">
                {BATTLE_PASS_TIERS.filter(t => t.level >= passTier && t.level <= passTier + 3).map(tier => {
                  const canClaim = battlePass.canClaim(tier.level);
                  const claimed = battlePass.getClaimedTiers().includes(tier.level);
                  const locked = battlePass.getXP() < tier.requiredXP;
                  return (
                    <div key={tier.level} className={`flex items-center gap-2 p-1.5 border ${
                      claimed ? 'border-green-800 bg-green-900/10' : canClaim ? 'border-yellow-600 bg-yellow-900/20' : 'border-[#1a2a3a]'
                    }`}>
                      <span className={`text-xs font-bold w-8 ${locked ? 'text-[#3a3a4a]' : 'text-[#8ab8d8]'}`}>
                        Lv.{tier.level}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#c8d8e8] truncate">{tier.name}</div>
                        <div className="text-xs text-[#5a7a9a] truncate">{tier.reward.name}</div>
                      </div>
                      {canClaim && (
                        <button
                          onClick={() => {
                            const reward = battlePass.claim(tier.level);
                            if (reward) alert(`获得奖励: ${reward.name}`);
                          }}
                          className="px-2 py-0.5 bg-yellow-700 text-white text-xs font-bold"
                        >
                          领取
                        </button>
                      )}
                      {claimed && <span className="text-green-400 text-xs">✓</span>}
                      {locked && <span className="text-[#3a3a4a] text-xs">🔒</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cosmetics Panel */}
          {showPanel === 'cosmetics' && (
            <div className="space-y-2">
              <div className="text-sm font-bold text-[#c8d8e8]">🎨 外观商店</div>
              <div className="grid grid-cols-2 gap-2">
                {COSMETIC_ITEMS.map(item => {
                  const owned = ownedCosmetics.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (!owned && onSpend(item.price)) {
                          purchaseCosmetic(item.id);
                        }
                      }}
                      disabled={owned || money < item.price}
                      className={`p-2 border text-left disabled:opacity-50 transition-colors ${
                        owned ? 'border-green-800 bg-green-900/10' : 'border-[#2a3a4a] hover:border-[#4a5a6a]'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${
                          item.rarity === 'legendary' ? 'bg-yellow-400' :
                          item.rarity === 'epic' ? 'bg-purple-400' :
                          item.rarity === 'rare' ? 'bg-blue-400' : 'bg-gray-400'
                        }`} />
                        <span className="text-xs font-bold text-[#c8d8e8]">{item.name}</span>
                      </div>
                      <div className="text-xs text-[#5a7a9a] mt-0.5">{item.description}</div>
                      <div className="text-xs text-yellow-400 mt-1">
                        {owned ? '✓ 已拥有' : `¥${item.price.toLocaleString()}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
