'use client';

import { useState, useEffect } from 'react';
import type { FogOfWarNode, MoveResult, RunItem } from '@/lib/game/extraction/types';

interface RunState {
  runId: string;
  zoneId: string;
  currentNodeId: string;
  hp: number;
  maxHp: number;
  backpack: RunItem[];
  backpackCapacity: number;
  evacWaitTurns: number;
}

interface ExtractionMapProps {
  runState: RunState;
  map: FogOfWarNode[];
  moveResult: MoveResult | null;
  onMove: (targetNodeId: string) => void;
  onEvacuate: () => void;
  loading: boolean;
}

const ZONE_NAMES: Record<string, string> = {
  hawkeye_power: '哈夫克发电站',
  zero_dam: '零号大坝',
  black_hawk: '黑鹰坠落区',
  aurora_lab: '极光实验室',
};

const QUALITY_COLORS: Record<string, string> = {
  common: 'bg-gray-500',
  uncommon: 'bg-green-500',
  rare: 'bg-blue-500',
  epic: 'bg-purple-500',
  legendary: 'bg-orange-500',
};

export default function ExtractionMap({
  runState,
  map,
  moveResult,
  onMove,
  onEvacuate,
  loading,
}: ExtractionMapProps) {
  const [showTrapFlash, setShowTrapFlash] = useState(false);
  const [flashOpacity, setFlashOpacity] = useState(1);

  useEffect(() => {
    if (moveResult?.trapDamage && moveResult.trapDamage > 0) {
      setShowTrapFlash(true);
      setFlashOpacity(1);
      const fade = setInterval(() => {
        setFlashOpacity((prev) => {
          if (prev <= 0) {
            clearInterval(fade);
            setShowTrapFlash(false);
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
      return () => clearInterval(fade);
    }
  }, [moveResult]);

  const zoneName = ZONE_NAMES[runState.zoneId] || runState.zoneId;
  const hpPercent = (runState.hp / runState.maxHp) * 100;
  const currentNode = map.find((n) => n.id === runState.currentNodeId);
  const adjacentNodes = currentNode?.adjacentIds.map((id) => map.find((n) => n.id === id)).filter(Boolean) as FogOfWarNode[];

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'loot': return '🎒';
      case 'evac': return '🚁';
      case 'event': return '⚡';
      case 'unknown': return '?';
      case 'hidden': return '???';
      default: return '?';
    }
  };

  const getNodeLabel = (type: string) => {
    switch (type) {
      case 'loot': return '搜刮点';
      case 'evac': return '撤离点';
      case 'event': return '事件';
      case 'unknown': return '未知区域';
      case 'hidden': return '???';
      default: return type;
    }
  };

  const getNodeAccentColor = (type: string) => {
    switch (type) {
      case 'loot': return 'border-amber-400';
      case 'evac': return 'border-green-400';
      case 'event': return 'border-gray-400';
      case 'unknown': return 'border-gray-400';
      case 'hidden': return 'border-gray-600 border-dashed';
      default: return 'border-gray-400';
    }
  };

  const isAdjacentAndRevealed = (node: FogOfWarNode) => {
    return adjacentNodes.some((adj) => adj.id === node.id) && node.revealed && !node.looted;
  };

  const sortedNodes = [...map].sort((a, b) => a.y - b.y || a.x - b.x);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* Status Bar */}
      <div className="fixed top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 z-50 px-4 py-2">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          {/* Left: HP */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
              🎯
            </div>
            <div className="w-32">
              <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
              <div className="text-xs text-gray-300 mt-1 text-center">
                {runState.hp}/{runState.maxHp}
              </div>
            </div>
          </div>

          {/* Center: Zone Name */}
          <div className="text-lg font-bold text-white">
            {zoneName}
          </div>

          {/* Right: Backpack */}
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: runState.backpackCapacity }).map((_, i) => {
              const item = runState.backpack[i];
              return (
                <div
                  key={i}
                  className={`w-8 h-8 rounded border border-gray-600 ${
                    item ? QUALITY_COLORS[item.quality] || 'bg-gray-500' : 'bg-gray-700 opacity-40'
                  }`}
                  title={item ? item.itemName : 'Empty'}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend Strip */}
      <div className="fixed top-16 left-0 right-0 bg-gray-850 border-b border-gray-700 z-40 px-4 py-2">
        <div className="flex items-center justify-center gap-6 text-sm text-gray-300 max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-400 rounded" />
            <span>搜刮点</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded" />
            <span>撤离点</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-400 rounded" />
            <span>未探索</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-600 border-2 border-dashed border-gray-500 rounded" />
            <span>迷雾区</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-28 pb-4 px-4">
        <div className="max-w-md mx-auto space-y-4">
          {sortedNodes.map((node) => {
            const isCurrent = node.id === runState.currentNodeId;
            const isVisited = node.looted || (node.type === 'evac' && isCurrent && !node.revealed);
            const isClickable = !isCurrent && isAdjacentAndRevealed(node);

            return (
              <div
                key={node.id}
                className={`
                  relative bg-gray-800 rounded-lg border-2 p-4 transition-all duration-200
                  ${getNodeAccentColor(node.type)}
                  ${isCurrent ? 'opacity-100 scale-105 animate-pulse shadow-lg shadow-amber-500/20' : ''}
                  ${isVisited && !isCurrent ? 'opacity-40 scale-95' : ''}
                  ${!node.revealed ? 'opacity-60' : ''}
                  ${isClickable ? 'cursor-pointer hover:brightness-110 active:scale-95' : ''}
                `}
                onClick={() => isClickable && onMove(node.id)}
              >
                {/* Trap Flash Overlay */}
                {isCurrent && showTrapFlash && (
                  <div
                    className="absolute inset-0 bg-red-500 rounded-lg pointer-events-none transition-opacity duration-100"
                    style={{ opacity: flashOpacity }}
                  />
                )}

                {/* Card Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getNodeIcon(node.type)}</span>
                    <span className="font-bold text-lg">{getNodeLabel(node.type)}</span>
                  </div>
                  {isVisited && (
                    <span className="text-xs bg-green-600 px-2 py-1 rounded">
                      已搜刮
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="text-sm text-gray-300 mb-2">
                  {node.type === 'loot' && '这里可能有珍贵的装备等待搜刮'}
                  {node.type === 'evac' && '安全撤离点，从这里可以脱离区域'}
                  {node.type === 'event' && '这里可能发生意外事件'}
                  {node.type === 'unknown' && '前方区域情况不明'}
                  {node.type === 'hidden' && '隐藏区域，需要探索才能发现'}
                </div>

                {/* Quality Tags */}
                {node.type === 'loot' && node.revealed && (
                  <div className="flex gap-2 text-xs">
                    <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded">装备</span>
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded">材料</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Node Actions */}
      {currentNode && currentNode.revealed && !moveResult?.gameOver && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 z-50">
          <div className="max-w-md mx-auto">
            {currentNode.type === 'loot' && !currentNode.looted && (
              <button
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                onClick={() => onMove(currentNode.id)}
              >
                搜刮
              </button>
            )}
            {currentNode.type === 'evac' && (
              <button
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                onClick={onEvacuate}
              >
                撤离
              </button>
            )}
            {adjacentNodes.filter((n) => n.revealed && !n.looted).length > 0 && (
              <div className="mt-3">
                <div className="text-sm text-gray-400 mb-2">移动到相邻区域：</div>
                <div className="grid grid-cols-2 gap-2">
                  {adjacentNodes
                    .filter((n) => n.revealed && !n.looted)
                    .map((node) => (
                      <button
                        key={node.id}
                        className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded text-sm transition-colors"
                        onClick={() => onMove(node.id)}
                      >
                        {getNodeIcon(node.type)} {getNodeLabel(node.type)}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {moveResult?.gameOver && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 text-center max-w-sm mx-4">
            <div className="text-4xl mb-4">💀</div>
            <h2 className="text-2xl font-bold text-red-500 mb-2">行动失败</h2>
            <p className="text-gray-300 mb-6">生命值已耗尽</p>
            <button
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              onClick={() => window.location.reload()}
            >
              重新开始
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
