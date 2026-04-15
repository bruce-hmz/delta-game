'use client';

import { useState, useCallback } from 'react';

// AI 事件类型
export interface AIEvent {
  title: string;
  description: string;
  choices: Array<{
    id: string;
    text: string;
    riskHint: string;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  eventType: string;
  tensionLevel: number;
}

// AI 战术建议类型
export interface AITacticalAdvice {
  advice: string;
  recommendation: {
    action: 'explore' | 'extract';
    confidence: number;
    reason: string;
  };
  personality: 'cautious' | 'encouraging' | 'analytical';
}

// AI 战报类型
export interface AIBattleReport {
  title: string;
  narrative: string;
  highlights: Array<{
    round: number;
    type: string;
    description: string;
  }>;
  advisorComment: string;
}

// AI 事件生成 Hook
export function useAIEvent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateEvent = useCallback(async (
    token: string,
    zone: 'normal' | 'dangerous' | 'boss',
    zoneName: string,
    carryValue: number,
    round: number,
    recentEvents: string[]
  ): Promise<AIEvent | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          zone,
          zoneName,
          carryValue,
          round,
          recentEvents,
        }),
      });

      const data = await response.json();

      if (data.success && data.data.event) {
        return data.data.event;
      } else {
        setError(data.error || '事件生成失败');
        return null;
      }
    } catch (err) {
      setError('网络错误');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateEvent, loading, error };
}

// AI 战术建议 Hook
export function useAIAdvice() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAdvice = useCallback(async (
    token: string,
    zone: 'normal' | 'dangerous' | 'boss',
    zoneName: string,
    carryValue: number,
    round: number,
    buffs: {
      deathRateReduction: number;
      redDropBoost: number;
      extractBoost: number;
      combatBoost: number;
    }
  ): Promise<AITacticalAdvice | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          zone,
          zoneName,
          carryValue,
          round,
          buffs,
        }),
      });

      const data = await response.json();

      if (data.success && data.data.advice) {
        return data.data.advice;
      } else {
        setError(data.error || '建议生成失败');
        return null;
      }
    } catch (err) {
      setError('网络错误');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getAdvice, loading, error };
}

// AI 战报生成 Hook
export function useAIReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(async (
    token: string,
    result: {
      success: boolean;
      finalValue: number;
      lostValue?: number;
      deathCause?: string;
    },
    events: Array<{
      round: number;
      zone: string;
      eventTitle: string;
      outcome: string;
      valueChange: number;
    }>,
    totalRounds: number,
    zonesExplored: string[],
    highlights: string[]
  ): Promise<AIBattleReport | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          result,
          events,
          totalRounds,
          zonesExplored,
          highlights,
        }),
      });

      const data = await response.json();

      if (data.success && data.data.report) {
        return data.data.report;
      } else {
        setError(data.error || '战报生成失败');
        return null;
      }
    } catch (err) {
      setError('网络错误');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateReport, loading, error };
}

// 玩家风格标签显示组件
export function PlayerStyleTag({ style }: { style: string }) {
  const styleConfig: Record<string, { icon: string; label: string; color: string }> = {
    aggressive: { icon: '🔥', label: '激进型', color: 'text-red-400' },
    conservative: { icon: '🛡️', label: '保守型', color: 'text-blue-400' },
    balanced: { icon: '⚖️', label: '均衡型', color: 'text-yellow-400' },
    unknown: { icon: '❓', label: '待评估', color: 'text-gray-400' },
  };

  const config = styleConfig[style] || styleConfig.unknown;

  return (
    <span className={`inline-flex items-center gap-1 ${config.color}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

// AI 战术判断显示组件
export function AITacticalDisplay({ 
  advice, 
  loading,
  onRequestAdvice 
}: { 
  advice: AITacticalAdvice | null;
  loading: boolean;
  onRequestAdvice: () => void;
}) {
  if (loading) {
    return (
      <div className="p-3 bg-[#1a2a3a]/50 border border-[#2a3a4a] animate-pulse">
        <div className="text-[#5a7a9a] text-sm">参谋分析中...</div>
      </div>
    );
  }

  if (!advice) {
    return (
      <button
        onClick={onRequestAdvice}
        className="w-full p-3 bg-[#1a2a3a]/50 hover:bg-[#2a3a4a] border border-[#3a4a5a] text-[#8ab8d8] text-sm transition-colors flex items-center justify-center gap-2"
      >
        <span>🤔</span>
        <span>询问参谋</span>
      </button>
    );
  }

  const getActionColor = (action: string) => {
    return action === 'extract' ? 'text-orange-400' : 'text-green-400';
  };

  return (
    <div className="p-3 bg-[#1a2a3a]/50 border border-[#2a3a4a]">
      <div className="text-[#8ab8d8] text-sm mb-2">{advice.advice}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[#5a7a9a]">建议:</span>
        <span className={getActionColor(advice.recommendation.action)}>
          {advice.recommendation.action === 'extract' ? '撤离' : '继续探索'}
        </span>
        <span className="text-[#5a7a9a]">({advice.recommendation.reason})</span>
      </div>
    </div>
  );
}

// AI 战报显示组件
export function AIBattleReportDisplay({ report }: { report: AIBattleReport }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-bold text-[#c8d8e8]">{report.title}</h3>
      </div>
      
      <div className="text-[#a8b8c8] text-sm leading-relaxed whitespace-pre-line">
        {report.narrative}
      </div>
      
      {report.highlights && report.highlights.length > 0 && (
        <div className="border-t border-[#2a3a4a] pt-3">
          <div className="text-xs text-[#5a7a9a] mb-2">高光时刻</div>
          <div className="space-y-1">
            {report.highlights.map((h, i) => (
              <div key={i} className="text-sm text-[#8ab8d8]">
                🔥 第{h.round}回合: {h.description}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="border-t border-[#2a3a4a] pt-3">
        <div className="text-xs text-[#5a7a9a] mb-1">参谋点评</div>
        <div className="text-sm text-[#a8b8c8] italic">"{report.advisorComment}"</div>
      </div>
    </div>
  );
}

// AI 事件显示组件
export function AIEventDisplay({ 
  event, 
  onChoice,
  loading 
}: { 
  event: AIEvent;
  onChoice: (choiceId: string) => void;
  loading: boolean;
}) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-[#c8d8e8] mb-2">{event.title}</h3>
        <p className="text-[#a8b8c8] text-sm leading-relaxed">{event.description}</p>
      </div>
      
      <div className="space-y-2">
        {event.choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => onChoice(choice.id)}
            disabled={loading}
            className="w-full p-3 bg-[#1a2a3a]/50 hover:bg-[#2a3a4a] border border-[#3a4a5a] text-left transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[#c8d8e8]">{choice.id}. {choice.text}</span>
              <span className={`text-xs ${getRiskColor(choice.riskLevel)}`}>
                {choice.riskHint}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
