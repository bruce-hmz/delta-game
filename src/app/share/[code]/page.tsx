'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// 分享战报类型
interface ShareReport {
  id: string;
  playerName: string;
  result: 'success' | 'fail';
  finalValue: number;
  totalRounds: number;
  aiReport: {
    title: string;
    narrative: string;
    highlights: Array<{
      round: number;
      type: string;
      description: string;
    }>;
    advisorComment: string;
  };
  playerStyle: 'aggressive' | 'conservative' | 'balanced' | 'unknown';
  zonesExplored: string[];
  timestamp: number;
}

export default function SharePage() {
  const params = useParams();
  const code = params.code as string;
  const [report, setReport] = useState<ShareReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/share/${code}`);
        const data = await res.json();
        if (data.success && data.data) {
          setReport(data.data);
        } else {
          setError(data.error || '战报不存在');
        }
      } catch (e) {
        setError('加载失败');
      } finally {
        setLoading(false);
      }
    }

    if (code) {
      fetchReport();
    }
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a10] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📊</div>
          <div className="text-[#8ab8d8]">加载战报中...</div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#050a10] flex items-center justify-center">
        <div className="text-center p-8 bg-[#1a1a2a] border border-[#3a4a5a]">
          <div className="text-4xl mb-4">🔍</div>
          <div className="text-red-400 text-lg mb-2">战报不存在</div>
          <div className="text-[#5a6a7a] text-sm">该战报可能已过期或已被删除</div>
          <a 
            href="/" 
            className="mt-4 inline-block px-4 py-2 bg-[#2a3a4a] hover:bg-[#3a4a5a] border border-[#3a4a5a] text-[#8ab8d8]"
          >
            返回首页
          </a>
        </div>
      </div>
    );
  }

  const styleEmoji = report.playerStyle === 'aggressive' ? '🔥' : 
                     report.playerStyle === 'conservative' ? '🛡️' : 
                     report.playerStyle === 'balanced' ? '⚖️' : '❓';
  const styleText = report.playerStyle === 'aggressive' ? '激进型' : 
                    report.playerStyle === 'conservative' ? '保守型' : 
                    report.playerStyle === 'balanced' ? '均衡型' : '未知';

  return (
    <div className="min-h-screen bg-[#050a10]">
      {/* 顶部标题 */}
      <div className="bg-gradient-to-r from-[#1a1a2a] to-[#2a2a3a] border-b border-[#3a4a5a] p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <span className="text-lg font-bold text-[#c8d8e8]">三角洲行动 | AI 战报</span>
          </div>
        </div>
      </div>

      {/* 战报内容 */}
      <div className="max-w-lg mx-auto p-4">
        {/* 结果卡片 */}
        <div className={`p-4 rounded-lg mb-4 ${report.result === 'success' ? 'bg-gradient-to-r from-[#1a3a2a] to-[#1a2a3a] border border-green-500/50' : 'bg-gradient-to-r from-[#3a1a1a] to-[#2a2a3a] border border-red-500/50'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-2xl ${report.result === 'success' ? 'animate-bounce' : ''}`}>
                {report.result === 'success' ? '🎉' : '💀'}
              </span>
              <span className={`text-lg font-bold ${report.result === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {report.result === 'success' ? '成功撤离' : '任务失败'}
              </span>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs ${report.result === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {report.result === 'success' ? '+' : '-'}{report.finalValue.toLocaleString()}
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-[#8a9aaa]">
            <div className="flex items-center gap-1">
              <span>👤</span>
              <span>{report.playerName}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{styleEmoji}</span>
              <span>{styleText}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>🔄</span>
              <span>{report.totalRounds}回合</span>
            </div>
          </div>
        </div>

        {/* AI 战报 */}
        <div className="p-4 bg-gradient-to-r from-[#2a1a2a] to-[#1a2a3a] border border-[#4a3a5a] rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤖</span>
            <span className="text-sm font-bold text-purple-400">AI 战报</span>
          </div>
          
          <div className="text-base font-bold text-[#c8d8e8] mb-2">
            📖 {report.aiReport.title}
          </div>
          
          <div className="text-sm text-[#8a9aaa] whitespace-pre-line mb-4">
            {report.aiReport.narrative}
          </div>

          {report.aiReport.highlights && report.aiReport.highlights.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-bold text-yellow-400 mb-2">✨ 高光时刻</div>
              <div className="space-y-2">
                {report.aiReport.highlights.map((h, i) => (
                  <div key={i} className="text-sm text-[#a8b8c8]">
                    <span className="text-amber-400">回合{h.round}:</span>
                    <span className="ml-2">{h.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.aiReport.advisorComment && (
            <div className="p-3 bg-[#0a1520] border border-[#2a3a4a]">
              <div className="text-xs text-[#5a6a7a] mb-1">💬 参谋评价</div>
              <div className="text-sm text-[#8ab8d8]">{report.aiReport.advisorComment}</div>
            </div>
          )}
        </div>

        {/* 行动按钮 */}
        <div className="mt-4 flex gap-2">
          <a 
            href="/" 
            className="flex-1 py-3 bg-gradient-to-r from-[#1a4a3a] to-[#2a5a4a] hover:from-[#2a5a4a] hover:to-[#3a6a5a] border border-[#4a8a6a] text-[#a8e8b8] font-bold text-center"
          >
            🎮 我也要玩
          </a>
          <button 
            onClick={() => {
              const text = `📊 【三角洲行动 | AI 战报】
━━━━━━━━━━━━━━━━━━━━
玩家: ${report.playerName} ${styleEmoji} ${styleText}
结果: ${report.result === 'success' ? '✅ 成功撤离' : '❌ 任务失败'}
━━━━━━━━━━━━━━━━━━━━

📖 ${report.aiReport.title}

${report.aiReport.narrative}

━━━━━━━━━━━━━━━
三角洲行动 | 搜打撤`;
              navigator.clipboard.writeText(text);
              alert('已复制到剪贴板');
            }}
            className="flex-1 py-3 bg-[#1a2a3a] hover:bg-[#2a3a4a] border border-[#3a4a5a] text-[#8ab8d8] font-bold"
          >
            📋 复制战报
          </button>
        </div>

        {/* 底部 */}
        <div className="mt-6 text-center text-xs text-[#5a6a7a]">
          <div>三角洲行动 | 搜打撤</div>
          <div className="mt-1">
            {new Date(report.timestamp).toLocaleDateString('zh-CN')}
          </div>
        </div>
      </div>
    </div>
  );
}
