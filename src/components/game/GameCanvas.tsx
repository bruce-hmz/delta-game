'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { ExtractionEngine, type RunState, type RunPhase } from '@/lib/game/canvas/engine';
import { clipRecorder, type ClipResult } from '@/lib/game/canvas/clip-recorder';
import type { Quality, ZoneType } from '@/lib/game/types';

interface GameCanvasProps {
  // Game state from parent
  round: number;
  exposure: number;
  loadLevel: string;
  riskStars: number;
  isAlive: boolean;
  carryValue: number;
  playerName?: string;

  // Callbacks
  onExplore: (zone: ZoneType, actionType: 'stealth' | 'search' | 'assault') => void;
  onExtract: () => void;
  onReset: () => void;
  loading: boolean;
}

export default function GameCanvas({
  round,
  exposure,
  loadLevel,
  riskStars,
  isAlive,
  carryValue,
  playerName = '干员',
  onExplore,
  onExtract,
  onReset,
  loading,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ExtractionEngine | null>(null);
  const [phase, setPhase] = useState<RunPhase>('idle');
  const [selectedZone, setSelectedZone] = useState<ZoneType | null>(null);
  const [actionType, setActionType] = useState<'stealth' | 'search' | 'assault'>('search');
  const [lastClip, setLastClip] = useState<ClipResult | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCardUrl, setShareCardUrl] = useState<string | null>(null);

  // Initialize engine + clip recorder
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new ExtractionEngine();
    engine.mount(canvasRef.current);
    engineRef.current = engine;

    // Init clip recorder with the same canvas
    clipRecorder.init(canvasRef.current);
    clipRecorder.startContinuousCapture();

    engine.on('stateChange', (state: RunState) => {
      setPhase(state.phase);
    });

    // Listen for loot reveals to auto-capture clips
    engine.on('lootRevealed', async (loot: { quality: Quality; itemName: string; itemValue: number }) => {
      if (loot.quality === 'red' || loot.quality === 'gold') {
        const clip = await clipRecorder.captureLootDrop(loot.quality);
        if (clip) {
          setLastClip(clip);
        }
      }
    });

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clipRecorder.dispose();
      engine.unmount();
      engineRef.current = null;
    };
  }, []);

  // Sync state from parent
  useEffect(() => {
    if (engineRef.current && phase !== 'loot-reveal' && phase !== 'entering') {
      engineRef.current.setState({ exposure, loadLevel, riskStars, round, carryValue });
    }
  }, [round, exposure, loadLevel, riskStars, carryValue, phase]);

  const handleZoneSelect = useCallback((zone: ZoneType) => {
    setSelectedZone(zone);
    setActionType('search');
  }, []);

  const handleStartExplore = useCallback(() => {
    if (!selectedZone || loading) return;
    engineRef.current?.startRun(selectedZone);
    onExplore(selectedZone, actionType);
  }, [selectedZone, actionType, loading, onExplore]);

  const handleExtract = useCallback(() => {
    if (loading) return;
    engineRef.current?.startExtraction();
    onExtract();
  }, [loading, onExtract]);

  const handleReset = useCallback(() => {
    setSelectedZone(null);
    setActionType('search');
    engineRef.current?.setState({
      phase: 'idle',
      zone: null,
      progress: 0,
      events: [],
      currentEvent: null,
      loot: null,
      isAlive: true,
      extracted: false,
      totalValue: 0,
    });
    onReset();
  }, [onReset]);

  // Zone info
  const zones: Array<{ key: ZoneType; name: string; icon: string; risk: string; deathRate: number; color: string }> = [
    { key: 'normal', name: '废弃居民区', icon: '🏘️', risk: '低风险', deathRate: 5, color: 'from-slate-700 to-slate-600' },
    { key: 'dangerous', name: '军事仓库', icon: '⚠️', risk: '中风险', deathRate: 15, color: 'from-amber-900 to-amber-800' },
    { key: 'boss', name: '黑区实验室', icon: '💀', risk: '高风险', deathRate: 30, color: 'from-red-900 to-red-800' },
  ];

  return (
    <div className="relative w-full h-full min-h-[60vh] flex flex-col">
      {/* Canvas - the visual game view */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* HUD Overlay */}
        <div className="absolute top-0 left-0 right-0 p-2 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-bold ${isAlive ? 'bg-green-900/80 text-green-400 border border-green-700' : 'bg-red-900/80 text-red-400 border border-red-700'}`}>
              {isAlive ? '存活' : '死亡'}
            </span>
            <span className="text-xs text-[#8ab8d8]">回合 {round}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-orange-400">☁️ {exposure}/10</span>
            <span className="text-xs text-yellow-400">¥{carryValue.toLocaleString()}</span>
          </div>
        </div>

        {/* Risk Stars */}
        <div className="absolute top-8 left-0 right-0 flex justify-center pointer-events-none z-10">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
              <span
                key={star}
                className={`text-sm ${
                  star <= riskStars
                    ? star >= 4 ? 'text-red-400' : star >= 3 ? 'text-orange-400' : 'text-yellow-400'
                    : 'text-[#2a3a4a]'
                }`}
              >
                ★
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Controls Panel */}
      <div className="flex-shrink-0 border-t border-[#1a2a3a] bg-[#0a1018] p-3">
        {phase === 'idle' && (
          <>
            {/* Zone Selection */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {zones.map(zone => (
                <button
                  key={zone.key}
                  onClick={() => handleZoneSelect(zone.key)}
                  disabled={loading || !isAlive}
                  className={`p-3 bg-gradient-to-b ${zone.color} hover:opacity-80 border transition-all disabled:opacity-50 ${
                    selectedZone === zone.key
                      ? 'border-purple-400 ring-2 ring-purple-400/50'
                      : 'border-[#3a4a5a]'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-xl mb-1">{zone.icon}</div>
                    <div className="text-xs font-bold text-[#c8d8e8]">{zone.name}</div>
                    <div className={`text-xs ${zone.key === 'normal' ? 'text-green-400' : zone.key === 'dangerous' ? 'text-amber-400' : 'text-red-400'}`}>
                      {zone.risk}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Action Type Selection */}
            {selectedZone && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { type: 'stealth' as const, icon: '🥷', label: '潜行', color: 'border-green-800 hover:border-green-600', desc: '暴露-50% 收益-20%' },
                  { type: 'search' as const, icon: '🔍', label: '搜索', color: 'border-yellow-800 hover:border-yellow-600', desc: '基准模式' },
                  { type: 'assault' as const, icon: '⚔️', label: '突击', color: 'border-orange-800 hover:border-orange-600', desc: '暴露+100% 收益+30%' },
                ].map(action => (
                  <button
                    key={action.type}
                    onClick={() => setActionType(action.type)}
                    className={`p-2 bg-[#0a1520] border ${action.color} ${
                      actionType === action.type ? 'ring-1 ring-white/30' : ''
                    } transition-all`}
                  >
                    <div className="text-center">
                      <div className="text-lg mb-0.5">{action.icon}</div>
                      <div className="text-xs font-bold text-[#c8d8e8]">{action.label}</div>
                      <div className="text-xs text-[#5a7a9a]">{action.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Start Button */}
            {selectedZone && (
              <button
                onClick={handleStartExplore}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-[#1a4a3a] to-[#2a5a4a] hover:from-[#2a5a4a] hover:to-[#3a6a5a] border-2 border-[#4a8a6a] text-[#a8e8b8] font-bold text-base tracking-wider transition-all disabled:opacity-50"
              >
                {loading ? '执行中...' : '🚀 开始行动'}
              </button>
            )}

            {/* Quick Actions */}
            {!isAlive && (
              <button
                onClick={handleReset}
                className="w-full py-3 bg-gradient-to-r from-[#1a4a3a] to-[#2a5a4a] border-2 border-[#4a8a6a] text-[#a8e8b8] font-bold text-base tracking-wider"
              >
                🔄 重新开始
              </button>
            )}
          </>
        )}

        {(phase === 'progress' || phase === 'event' || phase === 'loot-reveal') && (
          <div className="flex gap-2">
            <button
              onClick={() => { if (!loading) { /* stay and search */ }}}
              disabled={loading}
              className="flex-1 py-2 bg-[#2a3a4a] hover:bg-[#3a4a5a] border border-[#4a5a6a] text-[#8ab8d8] text-sm disabled:opacity-50"
            >
              🔄 继续搜索
            </button>
            <button
              onClick={handleExtract}
              disabled={loading || carryValue === 0}
              className={`flex-1 py-2 font-bold text-sm transition-all disabled:opacity-50 ${
                carryValue >= 5000
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 border-2 border-yellow-400 text-white animate-pulse'
                  : 'bg-[#1a4a3a] hover:bg-[#2a5a4a] border border-[#3a6a5a] text-[#8ad8a8]'
              }`}
            >
              🚁 撤离 (¥{carryValue.toLocaleString()})
            </button>
          </div>
        )}

        {(phase === 'complete' || phase === 'death') && (
          <button
            onClick={handleReset}
            className="w-full py-3 bg-gradient-to-r from-[#1a4a3a] to-[#2a5a4a] border-2 border-[#4a8a6a] text-[#a8e8b8] font-bold text-base tracking-wider"
          >
            🔄 重新开始
          </button>
        )}
      </div>

      {/* Share Modal - appears after red/gold drops */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm border border-[#2a3a4a] bg-[#0a1018]">
            <div className="border-b border-[#1a2a3a] p-3 flex items-center justify-between">
              <span className="text-sm font-bold text-[#c8d8e8]">📤 分享你的高光时刻</span>
              <button onClick={() => setShowShareModal(false)} className="text-[#5a7a9a] hover:text-[#8ab8d8]">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {/* Share card preview */}
              {shareCardUrl && (
                <div className="border border-[#2a3a4a] overflow-hidden">
                  <img src={shareCardUrl} alt="Share card" className="w-full" />
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                {lastClip && (
                  <button
                    onClick={() => {
                      clipRecorder.downloadClip(lastClip.url, `delta-force-${Date.now()}.webm`);
                    }}
                    className="w-full py-2 bg-[#1a2a4a] hover:bg-[#2a3a5a] border border-[#3a4a6a] text-[#8ab8d8] text-sm font-bold"
                  >
                    🎬 下载视频
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (shareCardUrl) {
                      const success = await clipRecorder.shareToWeChat(window.location.href);
                      if (success) {
                        alert('链接已复制！分享给好友吧');
                      }
                    }
                  }}
                  className="w-full py-2 bg-[#1a4a3a] hover:bg-[#2a5a4a] border border-[#3a6a5a] text-[#8ad8a8] text-sm font-bold"
                >
                  🔗 复制链接分享
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-full py-2 text-[#5a7a9a] text-xs"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating share button - shows after rare drops */}
      {lastClip && !showShareModal && (
        <button
          onClick={() => setShowShareModal(true)}
          className="fixed bottom-20 right-4 z-40 px-3 py-2 bg-red-900/80 hover:bg-red-900 border border-red-500 text-red-200 text-xs font-bold animate-bounce"
        >
          📤 分享
        </button>
      )}
    </div>
  );
}
