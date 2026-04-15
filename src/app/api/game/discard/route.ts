// 丢弃装备 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData, updatePlayerData } from '@/lib/game/auth-service';
import { EQUIPMENT_SLOTS, BACKPACK_SIZE, SAFEBOX_SIZE } from '@/lib/game/types';

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少身份凭证' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { from, index } = body as { 
      from: 'equipment' | 'backpack' | 'safebox';
      index: number;
    };
    
    const player = await getPlayerData(userId);
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }
    
    // 初始化
    if (!player.equipmentSlots) player.equipmentSlots = [];
    if (!player.safeBox) player.safeBox = [];
    
    let discardedItem = null;
    let itemName = '';
    
    if (from === 'equipment') {
      if (index < 0 || index >= player.equipmentSlots.length) {
        return NextResponse.json(
          { success: false, error: '无效的装备位置' },
          { status: 400 }
        );
      }
      discardedItem = player.equipmentSlots.splice(index, 1)[0];
      if (discardedItem.type === 'equipment') {
        itemName = (discardedItem.item as any).name;
      }
    } else if (from === 'backpack') {
      if (index < 0 || index >= player.inventory.length) {
        return NextResponse.json(
          { success: false, error: '无效的背包位置' },
          { status: 400 }
        );
      }
      discardedItem = player.inventory.splice(index, 1)[0];
      if (discardedItem.type === 'equipment') {
        itemName = (discardedItem.item as any).name;
      }
    } else if (from === 'safebox') {
      if (index < 0 || index >= player.safeBox.length) {
        return NextResponse.json(
          { success: false, error: '无效的保险箱位置' },
          { status: 400 }
        );
      }
      discardedItem = player.safeBox.splice(index, 1)[0];
      if (discardedItem.type === 'equipment') {
        itemName = (discardedItem.item as any).name;
      }
    }
    
    await updatePlayerData(userId, player);
    
    return NextResponse.json({
      success: true,
      data: {
        player,
        message: `已丢弃 ${itemName}`,
      },
    });
  } catch (error) {
    console.error('Discard error:', error);
    return NextResponse.json(
      { success: false, error: '丢弃失败' },
      { status: 500 }
    );
  }
}
