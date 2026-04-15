// 战报分享服务

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ShareReport, ShareReportInput } from '@/lib/ai/types';

// 生成随机分享码
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 保存战报并生成分享码
export async function createShareReport(input: ShareReportInput): Promise<{ shareCode: string; shareUrl: string }> {
  const client = getSupabaseClient();
  
  // 生成唯一分享码
  let shareCode = generateShareCode();
  let attempts = 0;
  const maxAttempts = 10;
  
  // 确保分享码唯一
  while (attempts < maxAttempts) {
    const { data: existing } = await client
      .from('shared_reports')
      .select('share_code')
      .eq('share_code', shareCode)
      .limit(1);
    
    if (!existing || existing.length === 0) break;
    shareCode = generateShareCode();
    attempts++;
  }
  
  // 保存到数据库
  const { data: result, error } = await client
    .from('shared_reports')
    .insert({
      share_code: shareCode,
      player_name: input.playerName,
      result: input.result,
      final_value: input.finalValue,
      total_rounds: input.totalRounds,
      player_style: input.playerStyle,
      zones_explored: input.zonesExplored,
      ai_report: input.aiReport,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Create share report error:', error);
    throw new Error('Failed to create share report');
  }
  
  const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'localhost:5000';
  const shareUrl = `https://${domain}/share/${shareCode}`;
  
  return {
    shareCode,
    shareUrl,
  };
}

// 根据分享码获取战报
export async function getShareReport(shareCode: string): Promise<ShareReport | null> {
  const client = getSupabaseClient();
  
  const { data: report, error } = await client
    .from('shared_reports')
    .select('*')
    .eq('share_code', shareCode.toUpperCase())
    .single();
  
  if (error || !report) return null;
  
  // 增加浏览次数
  await client
    .from('shared_reports')
    .update({ view_count: (report.view_count || 0) + 1 })
    .eq('id', report.id);
  
  return {
    id: report.id,
    playerName: report.player_name,
    result: report.result,
    finalValue: report.final_value,
    totalRounds: report.total_rounds,
    aiReport: report.ai_report,
    playerStyle: report.player_style,
    zonesExplored: report.zones_explored || [],
    timestamp: new Date(report.created_at).getTime(),
  };
}

// 获取热门分享战报
export async function getHotSharedReports(limit: number = 10): Promise<ShareReport[]> {
  const client = getSupabaseClient();
  
  const { data: reports, error } = await client
    .from('shared_reports')
    .select('*')
    .order('view_count', { ascending: false })
    .limit(limit);
  
  if (error || !reports) return [];
  
  return reports.map((report: any) => ({
    id: report.id,
    playerName: report.player_name,
    result: report.result,
    finalValue: report.final_value,
    totalRounds: report.total_rounds,
    aiReport: report.ai_report,
    playerStyle: report.player_style,
    zonesExplored: report.zones_explored || [],
    timestamp: new Date(report.created_at).getTime(),
  }));
}
