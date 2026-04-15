// 获取分享战报 API

import { NextRequest, NextResponse } from 'next/server';
import { getShareReport } from '@/lib/game/share-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    
    const report = await getShareReport(code);
    
    if (!report) {
      return NextResponse.json(
        { success: false, error: '战报不存在或已过期' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Get shared report error:', error);
    return NextResponse.json(
      { success: false, error: '获取战报失败' },
      { status: 500 }
    );
  }
}
