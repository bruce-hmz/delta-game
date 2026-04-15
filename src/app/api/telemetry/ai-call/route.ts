import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabase && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

export async function POST(request: NextRequest) {
  try {
    const db = getSupabase();
    const body = await request.json();
    
    // 验证必填字段
    if (!body.callId || !body.callType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // 插入调用日志
    const { error } = await db!.from('ai_call_logs').insert({
      call_id: body.callId,
      player_id: body.playerId || null,
      player_name: body.playerName || null,
      call_type: body.callType,
      context: body.context || {},
      success: body.success ?? true,
      error_message: body.errorMessage || null,
      response_time_ms: body.responseTimeMs || 0,
      tokens_used: body.tokensUsed || 0,
      cache_hit: body.cacheHit ?? false,
      model: body.model || 'doubao',
      quality_score: body.qualityScore || null,
    });
    
    if (error) {
      console.error('Failed to log AI call:', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }
    
    // 更新每日统计
    const today = new Date().toISOString().split('T')[0];
    await updateDailyStats(body.callType, body);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AI call logging error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}

// 更新每日统计
async function updateDailyStats(callType: string, data: any) {
  const db = getSupabase();
  if (!db) return;
  
  const today = new Date().toISOString().split('T')[0];
  
  // 构建更新字段
  const updateFields: Record<string, any> = {
    stat_date: today,
    total_response_time_ms: data.responseTimeMs || 0,
    total_tokens: data.tokensUsed || 0,
    updated_at: new Date().toISOString(),
  };
  
  // 根据调用类型增加计数
  switch (callType) {
    case 'event':
      updateFields.event_calls = 1;
      break;
    case 'advice':
      updateFields.advice_calls = 1;
      break;
    case 'report':
      updateFields.report_calls = 1;
      break;
    case 'memory':
      updateFields.memory_calls = 1;
      break;
  }
  
  if (!data.success) {
    updateFields.error_count = 1;
  }
  
  if (data.cacheHit) {
    updateFields.total_cache_hits = 1;
  }
  
  // 更新或插入统计记录（全局）
  const { error } = await db
    .from('ai_stats_daily')
    .upsert(updateFields, { onConflict: 'stat_date,player_id' });
  
  if (error) {
    console.error('Failed to update daily stats:', error);
  }
}
