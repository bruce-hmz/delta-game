'use client';

import { useState } from 'react';

// 战报数据类型
interface BattleReport {
  title: string;
  narrative: string;
  highlights: Array<{
    round: number;
    type: string;
    description: string;
  }>;
  advisorComment: string;
}

interface ReportData {
  success: boolean;
  finalValue: number;
  totalRounds: number;
  zonesExplored: string[];
  events: Array<{
    round: number;
    zone: string;
    eventTitle: string;
    outcome: string;
    valueChange: number;
  }>;
  aiReport?: BattleReport;
  playerStyle: 'aggressive' | 'conservative' | 'balanced' | 'unknown';
  playerName: string;
  startTime?: number;
  endTime?: number;
  exposure?: number;
  maxExposure?: number;
  deathCause?: string;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportData | null;
  onShare?: () => void;
  shareLoading?: boolean;
  shareResult?: { type: string; text: string } | null;
}

// 风格标签
const STYLE_LABELS = {
  aggressive: { text: '激进型', color: 'text-red-400', icon: '🔥' },
  conservative: { text: '保守型', color: 'text-blue-400', icon: '🛡️' },
  balanced: { text: '均衡型', color: 'text-green-400', icon: '⚖️' },
  unknown: { text: '未知', color: 'text-gray-400', icon: '❓' },
};

// 区域颜色
const ZONE_COLORS: Record<string, string> = {
  '废弃居民区': 'bg-green-900/50 text-green-400 border-green-700',
  '军事仓库': 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
  '黑区实验室': 'bg-red-900/50 text-red-400 border-red-700',
};

// 高光类型图标
const HIGHLIGHT_ICONS: Record<string, string> = {
  big_find: '💎',
  close_call: '😰',
  smart_choice: '🧠',
  red_drop: '🔥',
};

export default function ReportModal({
  isOpen,
  onClose,
  report,
  onShare,
  shareLoading,
  shareResult,
}: ReportModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'stats'>('overview');

  if (!isOpen || !report) return null;

  const styleInfo = STYLE_LABELS[report.playerStyle] || STYLE_LABELS.unknown;

  // 计算统计数据
  const stats = {
    totalEvents: report.events.length,
    positiveEvents: report.events.filter(e => e.valueChange > 0).length,
    negativeEvents: report.events.filter(e => e.valueChange < 0).length,
    totalGain: report.events.filter(e => e.valueChange > 0).reduce((sum, e) => sum + e.valueChange, 0),
    totalLoss: report.events.filter(e => e.valueChange < 0).reduce((sum, e) => sum + Math.abs(e.valueChange), 0),
    avgGainPerRound: report.events.length > 0 
      ? Math.round(report.events.reduce((sum, e) => sum + e.valueChange, 0) / report.events.length) 
      : 0,
    zonesCount: report.zonesExplored.reduce((acc, z) => {
      acc[z] = (acc[z] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  // 生成收益曲线数据
  const valueHistory = report.events.reduce((acc, e, i) => {
    const prev = acc[i - 1]?.value || 0;
    acc.push({ round: e.round, value: prev + e.valueChange });
    return acc;
  }, [] as Array<{ round: number; value: number }>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      
      {/* 弹窗主体 */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a1018] border border-[#2a3a4a] rounded-lg">
        {/* 头部 */}
        <div className="sticky top-0 bg-[#0a1018] border-b border-[#2a3a4a] p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{report.success ? '🏆' : '💀'}</span>
              <div>
                <div className="text-lg font-bold text-[#e8e8f8]">
                  {report.aiReport?.title || (report.success ? '成功撤离' : '任务失败')}
                </div>
                <div className="text-xs text-[#5a6a7a]">
                  {report.playerName} · 第 {report.totalRounds} 回合
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#1a2a3a] rounded transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* 结果摘要 */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className={`p-3 rounded border ${
              report.success 
                ? 'bg-green-900/30 border-green-700' 
                : 'bg-red-900/30 border-red-700'
            }`}>
              <div className="text-xs text-[#5a6a7a]">最终收益</div>
              <div className={`text-xl font-bold ${report.success ? 'text-green-400' : 'text-red-400'}`}>
                {report.finalValue.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded border border-[#2a3a4a] bg-[#0a1520]">
              <div className="text-xs text-[#5a6a7a]">探索区域</div>
              <div className="text-xl font-bold text-[#c8d8e8]">
                {report.zonesExplored.length}
              </div>
            </div>
            <div className="p-3 rounded border border-[#2a3a4a] bg-[#0a1520]">
              <div className="text-xs text-[#5a6a7a]">玩家风格</div>
              <div className={`text-xl font-bold ${styleInfo.color}`}>
                {styleInfo.icon} {styleInfo.text}
              </div>
            </div>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="flex border-b border-[#2a3a4a]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-[#5a6a7a] hover:text-[#8a9aaa]'
            }`}
          >
            📊 战报总览
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'timeline'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-[#5a6a7a] hover:text-[#8a9aaa]'
            }`}
          >
            📜 行动时间线
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'stats'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-[#5a6a7a] hover:text-[#8a9aaa]'
            }`}
          >
            📈 数据分析
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-4">
          {/* 战报总览 */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* AI 叙事 */}
              {report.aiReport?.narrative && (
                <div className="p-4 bg-gradient-to-r from-[#1a1a2a] to-[#0a1520] border border-[#2a3a4a] rounded">
                  <div className="text-sm text-[#c8d8e8] leading-relaxed whitespace-pre-line">
                    {report.aiReport.narrative}
                  </div>
                </div>
              )}

              {/* 高光时刻 */}
              {report.aiReport?.highlights && report.aiReport.highlights.length > 0 && (
                <div>
                  <div className="text-sm font-bold text-yellow-400 mb-2">✨ 高光时刻</div>
                  <div className="space-y-2">
                    {report.aiReport.highlights.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 bg-[#0a1520] border border-[#1a2a3a] rounded"
                      >
                        <span className="text-lg">{HIGHLIGHT_ICONS[h.type] || '📌'}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-400">回合 {h.round}</span>
                            <span className="text-xs text-[#3a4a5a]">|</span>
                            <span className="text-xs text-[#5a6a7a]">{h.type}</span>
                          </div>
                          <div className="text-sm text-[#a8b8c8] mt-1">{h.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 参谋评价 */}
              {report.aiReport?.advisorComment && (
                <div className="p-4 bg-[#0a1520] border border-[#2a3a4a] rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🤖</span>
                    <span className="text-sm font-bold text-[#6a8aaa]">参谋评价</span>
                  </div>
                  <div className="text-sm text-[#8ab8d8]">{report.aiReport.advisorComment}</div>
                </div>
              )}

              {/* 死亡原因 */}
              {!report.success && report.deathCause && (
                <div className="p-4 bg-red-900/20 border border-red-800/30 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💀</span>
                    <span className="text-sm font-bold text-red-400">任务失败原因</span>
                  </div>
                  <div className="text-sm text-red-300">{report.deathCause}</div>
                </div>
              )}
            </div>
          )}

          {/* 行动时间线 */}
          {activeTab === 'timeline' && (
            <div className="space-y-2">
              {report.events.length === 0 ? (
                <div className="text-center text-[#5a6a7a] py-8">暂无事件记录</div>
              ) : (
                report.events.map((event, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded border ${
                      event.valueChange > 0
                        ? 'bg-green-900/10 border-green-900/30'
                        : event.valueChange < 0
                        ? 'bg-red-900/10 border-red-900/30'
                        : 'bg-[#0a1520] border-[#1a2a3a]'
                    }`}
                  >
                    {/* 回合标记 */}
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-[#1a2a3a] rounded-full">
                      <span className="text-xs text-[#6a7a8a]">{event.round}</span>
                    </div>
                    
                    {/* 事件内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          ZONE_COLORS[event.zone] || 'bg-gray-900/50 text-gray-400'
                        }`}>
                          {event.zone}
                        </span>
                        <span className="text-sm text-[#c8d8e8]">{event.eventTitle}</span>
                      </div>
                      <div className="text-xs text-[#5a6a7a]">{event.outcome}</div>
                    </div>
                    
                    {/* 价值变化 */}
                    <div className={`text-sm font-bold ${
                      event.valueChange > 0 ? 'text-green-400' : event.valueChange < 0 ? 'text-red-400' : 'text-[#5a6a7a]'
                    }`}>
                      {event.valueChange > 0 ? '+' : ''}{event.valueChange.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 数据分析 */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* 收益统计 */}
              <div>
                <div className="text-sm font-bold text-[#8a9aaa] mb-3">📊 收益统计</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-[#0a1520] border border-[#1a2a3a] rounded">
                    <div className="text-xs text-[#5a6a7a]">总收益事件</div>
                    <div className="text-lg font-bold text-green-400">{stats.positiveEvents} 次</div>
                    <div className="text-xs text-green-600">+{stats.totalGain.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-[#0a1520] border border-[#1a2a3a] rounded">
                    <div className="text-xs text-[#5a6a7a]">总损失事件</div>
                    <div className="text-lg font-bold text-red-400">{stats.negativeEvents} 次</div>
                    <div className="text-xs text-red-600">-{stats.totalLoss.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-[#0a1520] border border-[#1a2a3a] rounded">
                    <div className="text-xs text-[#5a6a7a]">平均每回合收益</div>
                    <div className={`text-lg font-bold ${stats.avgGainPerRound >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stats.avgGainPerRound >= 0 ? '+' : ''}{stats.avgGainPerRound.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-[#0a1520] border border-[#1a2a3a] rounded">
                    <div className="text-xs text-[#5a6a7a]">事件总数</div>
                    <div className="text-lg font-bold text-[#c8d8e8]">{stats.totalEvents} 次</div>
                  </div>
                </div>
              </div>

              {/* 区域探索分布 */}
              <div>
                <div className="text-sm font-bold text-[#8a9aaa] mb-3">🗺️ 区域探索分布</div>
                <div className="space-y-2">
                  {Object.entries(stats.zonesCount).map(([zone, count]) => (
                    <div key={zone} className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded ${
                        ZONE_COLORS[zone] || 'bg-gray-900/50 text-gray-400'
                      }`}>
                        {zone}
                      </span>
                      <div className="flex-1 h-2 bg-[#1a2a3a] rounded overflow-hidden">
                        <div
                          className="h-full bg-purple-500/60 rounded"
                          style={{ width: `${(count / report.events.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-[#5a6a7a]">{count} 次</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 收益曲线（简化版） */}
              <div>
                <div className="text-sm font-bold text-[#8a9aaa] mb-3">📈 收益曲线</div>
                <div className="p-4 bg-[#0a1520] border border-[#1a2a3a] rounded">
                  {valueHistory.length === 0 ? (
                    <div className="text-center text-[#5a6a7a] py-4">暂无数据</div>
                  ) : (
                    <div className="h-32 flex items-end gap-1">
                      {valueHistory.map((point, i) => {
                        const maxVal = Math.max(...valueHistory.map(p => Math.abs(p.value)));
                        const height = maxVal > 0 ? Math.abs(point.value) / maxVal * 100 : 0;
                        return (
                          <div
                            key={i}
                            className="flex-1 flex flex-col items-center justify-end"
                            title={`回合 ${point.round}: ${point.value >= 0 ? '+' : ''}${point.value.toLocaleString()}`}
                          >
                            <div
                              className={`w-full rounded-t ${
                                point.value >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'
                              }`}
                              style={{ height: `${Math.max(height, 5)}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 风险分析 */}
              {(report.exposure !== undefined || report.maxExposure !== undefined) && (
                <div>
                  <div className="text-sm font-bold text-[#8a9aaa] mb-3">⚠️ 风险分析</div>
                  <div className="p-4 bg-[#0a1520] border border-[#1a2a3a] rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#5a6a7a]">最终暴露度</span>
                      <span className={`text-sm font-bold ${
                        (report.exposure || 0) >= 7 ? 'text-red-400' : (report.exposure || 0) >= 4 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {report.exposure || 0} / {report.maxExposure || 10}
                      </span>
                    </div>
                    <div className="h-2 bg-[#1a2a3a] rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${
                          (report.exposure || 0) >= 7 ? 'bg-red-500' : (report.exposure || 0) >= 4 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${((report.exposure || 0) / (report.maxExposure || 10)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="sticky bottom-0 bg-[#0a1018] border-t border-[#2a3a4a] p-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-[#1a2a3a] hover:bg-[#2a3a4a] border border-[#3a4a5a] text-[#8ab8d8] text-sm transition-colors"
            >
              关闭
            </button>
            {onShare && (
              <button
                onClick={onShare}
                disabled={shareLoading}
                className="flex-1 py-3 bg-gradient-to-r from-purple-900/50 to-purple-800/50 hover:from-purple-800/50 hover:to-purple-700/50 border border-purple-700 text-purple-300 text-sm transition-colors disabled:opacity-50"
              >
                {shareLoading ? '📤 分享中...' : '📊 分享战报'}
              </button>
            )}
          </div>
          {shareResult && (
            <div className="mt-3 p-2 bg-green-900/20 border border-green-700/50 rounded">
              <div className="text-xs text-green-400 text-center">✓ {shareResult.text}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
