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
    
    // 记录分享
    const { error } = await db!.from('share_stats').insert({
      player_id: body.playerId || null,
      player_name: body.playerName || null,
      share_result: body.shareResult || 'success',
      final_value: body.finalValue || 0,
      player_style: body.playerStyle || null,
    });
    
    if (error) {
      console.error('Failed to log share:', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Share logging error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
