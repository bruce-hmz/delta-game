// 移动装备 API - 支持装备槽/背包/保险箱之间移动物品

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData, updatePlayerData } from '@/lib/game/auth-service';
import { EQUIPMENT_SLOTS, BACKPACK_SIZE, SAFEBOX_SIZE, InventoryItem } from '@/lib/game/types';

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
    const { from, fromIndex, to, toIndex } = body as { 
      from: 'equipment' | 'backpack' | 'safebox';
      fromIndex: number;
      to: 'equipment' | 'backpack' | 'safebox';
      toIndex?: number; // 可选，如果不指定则自动找空位
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
    
    // 获取源位置的物品
    let sourceArray: InventoryItem[];
    let sourceName: string;
    
    if (from === 'equipment') {
      sourceArray = player.equipmentSlots;
      sourceName = '装备槽';
    } else if (from === 'backpack') {
      sourceArray = player.inventory;
      sourceName = '背包';
    } else {
      sourceArray = player.safeBox;
      sourceName = '保险箱';
    }
    
    if (fromIndex < 0 || fromIndex >= sourceArray.length) {
      return NextResponse.json(
        { success: false, error: '无效的源位置' },
        { status: 400 }
      );
    }
    
    const itemToMove = sourceArray[fromIndex];
    if (!itemToMove || itemToMove.type !== 'equipment') {
      return NextResponse.json(
        { success: false, error: '该位置没有可移动的装备' },
        { status: 400 }
      );
    }
    
    const itemName = (itemToMove.item as any).name;
    
    // 获取目标位置的数组
    let targetArray: InventoryItem[];
    let targetMaxSize: number;
    let targetName: string;
    
    if (to === 'equipment') {
      targetArray = player.equipmentSlots;
      targetMaxSize = EQUIPMENT_SLOTS;
      targetName = '装备槽';
    } else if (to === 'backpack') {
      targetArray = player.inventory;
      targetMaxSize = BACKPACK_SIZE;
      targetName = '背包';
    } else {
      targetArray = player.safeBox;
      targetMaxSize = SAFEBOX_SIZE;
      targetName = '保险箱';
    }
    
    // 如果指定了目标位置
    if (toIndex !== undefined && toIndex !== null) {
      if (toIndex < 0 || toIndex >= targetMaxSize) {
        return NextResponse.json(
          { success: false, error: '无效的目标位置' },
          { status: 400 }
        );
      }
      
      // 如果目标位置有物品，则交换
      const existingItem = targetArray[toIndex];
      if (existingItem) {
        // 交换位置
        targetArray[toIndex] = itemToMove;
        sourceArray[fromIndex] = existingItem;
      } else {
        // 移动到空位
        targetArray[toIndex] = itemToMove;
        sourceArray.splice(fromIndex, 1);
      }
    } else {
      // 自动找空位
      // 确保目标数组有足够的长度
      while (targetArray.length < targetMaxSize) {
        targetArray.push({} as InventoryItem);
      }
      
      // 找到第一个空位
      let emptyIndex = -1;
      for (let i = 0; i < targetMaxSize; i++) {
        if (!targetArray[i] || !targetArray[i].type) {
          emptyIndex = i;
          break;
        }
      }
      
      if (emptyIndex === -1) {
        return NextResponse.json(
          { success: false, error: `${targetName}已满，无法移动`, needChoice: true },
          { status: 400 }
        );
      }
      
      // 移动到空位
      targetArray[emptyIndex] = itemToMove;
      sourceArray.splice(fromIndex, 1);
    }
    
    // 清理源数组中的空位
    if (from === 'equipment') {
      // 装备槽保持索引，不移除空位
    } else if (from === 'backpack') {
      // 背包需要压缩
      player.inventory = player.inventory.filter(item => item && item.type);
    } else {
      // 保险箱保持索引
    }
    
    // 清理目标数组末尾的空位
    if (to === 'backpack') {
      player.inventory = player.inventory.filter(item => item && item.type);
    }
    
    await updatePlayerData(userId, player);
    
    return NextResponse.json({
      success: true,
      data: {
        player,
        message: `已将 ${itemName} 从${sourceName}移动到${targetName}`,
      },
    });
  } catch (error) {
    console.error('Move error:', error);
    return NextResponse.json(
      { success: false, error: '移动失败' },
      { status: 500 }
    );
  }
}
