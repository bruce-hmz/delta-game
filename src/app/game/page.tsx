'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import GameCanvas from '@/components/game/GameCanvas';
import MonetizationBar from '@/components/game/MonetizationBar';
import { useGameState } from '@/hooks/useGameState';
import { soundManager } from '@/lib/game/canvas/sound';
import { ticketSystem, battlePass } from '@/lib/game/canvas/ticket-system';
import type { ZoneType } from '@/lib/game/types';
import type { Quality } from '@/lib/game/types';

export default function GamePage() {
  const state = useGameState();
  const [showMode, setShowMode] = useState<'canvas' | 'classic'>('canvas');
  const [shareOpen, setShareOpen] = useState(false);
  const [lastLoot, setLastLoot] = useState<{ name: string; quality: Quality; value: number } | null>(null);

  // Loading / auth screens
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-[#050a10] flex items-center justify-center">
        <div className="text-[#8ab8d8] text-lg animate-pulse">⚡ 正在部署战术装备...</div>
      </div>
    );
  }

  if (state.authError) {
    return (
      <div className="min-h-screen bg-[#050a10] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">{state.authError}</div>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-[#1a4a3a] text-[#a8e8b8] border border-[#3a6a5a]">
            刷新重试
          </button>
        </div>
      </div>
    );
  }

  if (!state.userExists) {
    return (
      <div className="min-h-screen bg-[#050a10] flex items-center justify-center p-4">
        <div className="max-w-md w-full border border-[#1a2a3a] bg-[#0a1018] p-6">
          <div className="text-center mb-6">
            <div className="text-2xl font-bold text-[#c8d8e8] tracking-wider mb-2">⚔️ 三角洲行动</div>
            <div className="text-sm text-[#5a7a9a]">AI 战术指挥官</div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#8ab8d8] mb-1 block">代号</label>
              <input
                type="text"
                placeholder="输入你的代号..."
                maxLength={12}
                id="nickname-input"
                className="w-full px-4 py-2 bg-[#050a10] border border-[#2a3a4a] text-[#c8d8e8] placeholder-[#3a4a5a] focus:outline-none focus:border-[#4a6a8a] text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#8ab8d8] mb-1 block">密码（可选）</label>
              <input
                type="password"
                placeholder="设置密码保护账号..."
                id="password-input"
                className="w-full px-4 py-2 bg-[#050a10] border border-[#2a3a4a] text-[#c8d8e8] placeholder-[#3a4a5a] focus:outline-none focus:border-[#4a6a8a] text-sm"
              />
            </div>
            <button
              onClick={() => {
                const nickname = (document.getElementById('nickname-input') as HTMLInputElement)?.value || '';
                const password = (document.getElementById('password-input') as HTMLInputElement)?.value || '';
                state.setNickname(nickname, password);
              }}
              disabled={state.loading}
              className="w-full py-3 bg-gradient-to-r from-[#1a4a3a] to-[#2a5a4a] border-2 border-[#4a8a6a] text-[#a8e8b8] font-bold tracking-wider disabled:opacity-50"
            >
              {state.loading ? '部署中...' : '开始行动'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => state.guestStart()}
                disabled={state.loading}
                className="flex-1 py-2 bg-[#1a2a3a] text-[#8ab8d8] text-xs border border-[#2a3a4a] hover:bg-[#2a3a4a] disabled:opacity-50"
              >
                快速开始（匿名）
              </button>
            </div>
            {state.authError && <div className="text-red-400 text-xs text-center">{state.authError}</div>}
          </div>
        </div>
      </div>
    );
  }

  if (!state.player?.isAlive && state.player?.currentRound === 0) {
    // Need to start a new game first
    return (
      <div className="min-h-screen bg-[#050a10] flex items-center justify-center">
        <button
          onClick={() => state.startGame()}
          disabled={state.loading}
          className="px-8 py-4 bg-gradient-to-r from-[#1a4a3a] to-[#2a5a4a] border-2 border-[#4a8a6a] text-[#a8e8b8] font-bold text-xl tracking-wider disabled:opacity-50"
        >
          {state.loading ? '部署中...' : '⚔️ 开始任务'}
        </button>
      </div>
    );
  }

  // Handle explore with sound + ticket check
  const handleExplore = useCallback(async (zone: ZoneType, actionType: 'stealth' | 'search' | 'assault') => {
    // Check ticket
    if (!ticketSystem.canRun()) {
      alert('今日免费行动次数已用完！升级VIP或观看广告获取额外次数。');
      return;
    }
    ticketSystem.consumeTicket();
    soundManager.playUI('click');
    const result = await state.exploreZone(zone, actionType);
    if (result) {
      if (result.loot) {
        const quality = result.loot.quality as Quality;
        setLastLoot({ name: result.loot.name, quality, value: result.loot.totalValue });
        // Delay sound to sync with canvas animation
        setTimeout(() => soundManager.playQualityReveal(quality), 300);
        // Grant battle pass XP for loot
        const xpMap: Record<Quality, number> = { white: 5, blue: 15, purple: 30, red: 60, gold: 100 };
        battlePass.addXP(xpMap[quality]);
      }
      if (result.success === false && result.combat) {
        soundManager.playUI('combat');
      }
      if (result.isDeath) {
        soundManager.playUI('death');
      }
    }
  }, [state]);

  const handleExtract = useCallback(async () => {
    soundManager.playUI('extract');
    const result = await state.extract();
    if (result) {
      if (result.success) {
        soundManager.playUI('success');
      } else {
        soundManager.playUI('death');
      }
    }
  }, [state]);

  const handleReset = useCallback(async () => {
    await state.resetGame();
    soundManager.stopAmbient();
  }, [state]);

  return (
    <div className="min-h-screen bg-[#050a10] flex flex-col">
      {/* Top bar */}
      <div className="border-b border-[#1a2a3a] bg-[#0a1018] p-2 sm:p-3 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-sm font-bold text-[#c8d8e8]">⚔️ 三角洲行动</span>
            <span className={`px-2 py-0.5 text-xs ${state.player?.isAlive ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-red-900/50 text-red-400 border border-red-700'}`}>
              {state.player?.isAlive ? '存活' : '阵亡'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-yellow-400">💰 {state.player?.money.toLocaleString()}</span>
            <a href="/" className="text-[#5a7a9a] hover:text-[#8ab8d8] ml-2 border border-[#2a3a4a] px-2 py-0.5 text-xs">经典版</a>
          </div>
        </div>
      </div>

      {/* Broadcast */}
      {state.broadcasts.length > 0 && (
        <div className="border-b border-[#1a2a3a] p-2 bg-[#1a2a4a]/20">
          <div className="text-xs text-yellow-400 animate-pulse truncate">📢 {state.broadcasts[0]?.message}</div>
        </div>
      )}

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col">
        <GameCanvas
          round={state.player?.currentRound || 1}
          exposure={state.player?.exposure || 0}
          loadLevel={state.player?.loadLevel || 'light'}
          riskStars={state.riskStars}
          isAlive={state.player?.isAlive ?? true}
          carryValue={state.carryValue}
          onExplore={handleExplore}
          onExtract={handleExtract}
          onReset={handleReset}
          loading={state.loading}
          playerName={state.player?.name || '干员'}
        />
      </div>

      {/* Monetization bar */}
      <MonetizationBar
        money={state.player?.money || 0}
        onSpend={(amount) => {
          if ((state.player?.money || 0) >= amount) {
            // In production this would be a server-side deduction
            return true;
          }
          return false;
        }}
      />

      {/* Last Loot Result Toast */}
      {lastLoot && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 border ${
          lastLoot.quality === 'red' ? 'bg-red-900/90 border-red-500 text-red-200' :
          lastLoot.quality === 'gold' ? 'bg-yellow-900/90 border-yellow-500 text-yellow-200' :
          lastLoot.quality === 'purple' ? 'bg-purple-900/90 border-purple-500 text-purple-200' :
          lastLoot.quality === 'blue' ? 'bg-blue-900/90 border-blue-500 text-blue-200' :
          'bg-[#1a2a3a]/90 border-[#3a4a5a] text-[#c8d8e8]'
        }`}
          onClick={() => setLastLoot(null)}
        >
          <span className="text-sm font-bold">
            {lastLoot.quality === 'red' && '🔥 '}
            {lastLoot.quality === 'gold' && '👑 '}
            {lastLoot.name} ¥{lastLoot.value.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
