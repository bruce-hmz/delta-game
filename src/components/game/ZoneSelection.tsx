'use client';

import React from 'react';

interface ZoneSelectionProps {
  zones: Array<{
    id: string;
    name: string;
    difficulty: string;
    nodeCountRange: [number, number];
    trapChance: number;
    evacCount: number;
  }>;
  onSelect: (zoneId: string) => void;
  loading: boolean;
}

const DIFFICULTY_LABELS: Record<string, { label: string; color: string; border: string }> = {
  low: { label: '简单', color: 'text-green-400', border: 'border-green-500/30' },
  medium: { label: '中等', color: 'text-amber-400', border: 'border-amber-500/30' },
  high: { label: '困难', color: 'text-red-400', border: 'border-red-500/30' },
  extreme: { label: '极限', color: 'text-purple-400', border: 'border-purple-500/30' },
};

export function ZoneSelection({ zones, onSelect, loading }: ZoneSelectionProps) {
  if (loading) {
    return (
      <div className="bg-[#0a0a0a] text-white max-w-[430px] mx-auto min-h-screen">
        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-bold tracking-wider mb-2">选择战区</h1>
          <p className="text-zinc-500 text-xs">选择一个区域开始暗区行动</p>
        </div>
        <div className="grid grid-cols-2 gap-3 px-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-900/50 rounded-xl p-4 animate-pulse">
              <div className="h-5 w-16 bg-zinc-800 rounded mb-3" />
              <div className="h-7 bg-zinc-800 rounded mb-4" />
              <div className="space-y-2">
                <div className="h-4 bg-zinc-800 rounded w-3/4" />
                <div className="h-4 bg-zinc-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] text-white max-w-[430px] mx-auto min-h-screen">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold tracking-wider mb-2">选择战区</h1>
        <p className="text-zinc-500 text-xs">选择一个区域开始暗区行动</p>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4">
        {zones.map((zone) => {
          const difficulty = DIFFICULTY_LABELS[zone.difficulty] || DIFFICULTY_LABELS.low;
          return (
            <button
              key={zone.id}
              onClick={() => onSelect(zone.id)}
              className={`bg-zinc-900/50 border ${difficulty.border} rounded-xl p-4 text-left active:scale-95 transition-transform duration-150`}
            >
              <div className={`text-xs font-bold mb-3 ${difficulty.color}`}>
                {difficulty.label}
              </div>
              <div className="text-lg font-bold mb-4 text-white">
                {zone.name}
              </div>
              <div className="space-y-1.5">
                <div className="text-xs text-zinc-400">
                  {zone.nodeCountRange[0]}-{zone.nodeCountRange[1]}节点
                </div>
                <div className="text-xs text-zinc-400">
                  {zone.trapChance}%陷阱
                </div>
                <div className="text-xs text-zinc-400">
                  {zone.evacCount}撤离点
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
