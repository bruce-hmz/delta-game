// 物品选择 API（当装备槽/背包/保险箱全满时）

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData, updatePlayerData } from '@/lib/game/auth-service';
import { InventoryItem, Equipment, SAFEBOX_SIZE, BACKPACK_SIZE, EQUIPMENT_SLOTS } from '@/lib/game/types';

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
    const { action, replaceIndex, item } = body as { 
      action: 'equip_replace' | 'backpack_replace' | 'safebox_replace' | 'discard';
      replaceIndex?: number;
      item: Equipment;
    };
    
    const player = await getPlayerData(userId);
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }
    
    // 初始化装备槽
    if (!player.equipmentSlots) {
      player.equipmentSlots = [];
    }
    if (!player.safeBox) {
      player.safeBox = [];
    }
    
    const inventoryItem: InventoryItem = { type: 'equipment', item };
    
    // 处理不同选择
    switch (action) {
      case 'discard':
        // 直接丢弃，不做任何操作
        return NextResponse.json({
          success: true,
          data: {
            player,
            message: '你选择了丢弃装备',
          },
        });
        
      case 'equip_replace':
        // 替换装备槽
        if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < player.equipmentSlots.length) {
          // 替换指定位置的物品（原物品丢弃）
          player.equipmentSlots[replaceIndex] = inventoryItem;
          await updatePlayerData(userId, player);
          return NextResponse.json({
            success: true,
            data: {
              player,
              message: `已替换装备槽第 ${replaceIndex + 1} 个位置的装备`,
            },
          });
        } else if (player.equipmentSlots.length < EQUIPMENT_SLOTS) {
          // 还有空位，直接添加
          player.equipmentSlots.push(inventoryItem);
          await updatePlayerData(userId, player);
          return NextResponse.json({
            success: true,
            data: {
              player,
              message: '装备已放入装备槽',
            },
          });
        } else {
          return NextResponse.json(
            { success: false, error: '请选择要替换的装备位置' },
            { status: 400 }
          );
        }
        
      case 'backpack_replace':
        // 替换背包
        if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < player.inventory.length) {
          player.inventory[replaceIndex] = inventoryItem;
          await updatePlayerData(userId, player);
          return NextResponse.json({
            success: true,
            data: {
              player,
              message: `已替换背包第 ${replaceIndex + 1} 个位置的物品`,
            },
          });
        } else if (player.inventory.length < BACKPACK_SIZE) {
          player.inventory.push(inventoryItem);
          await updatePlayerData(userId, player);
          return NextResponse.json({
            success: true,
            data: {
              player,
              message: '物品已放入背包',
            },
          });
        } else {
          return NextResponse.json(
            { success: false, error: '请选择要替换的物品位置' },
            { status: 400 }
          );
        }
        
      case 'safebox_replace':
        // 放入保险箱
        if (player.safeBox.length < SAFEBOX_SIZE) {
          player.safeBox.push(inventoryItem);
          await updatePlayerData(userId, player);
          return NextResponse.json({
            success: true,
            data: {
              player,
              message: '物品已放入保险箱（撤离失败时保留）',
            },
          });
        } else {
          return NextResponse.json(
            { success: false, error: '保险箱已满' },
            { status: 400 }
          );
        }
        
      default:
        return NextResponse.json(
          { success: false, error: '无效的操作' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Item choice error:', error);
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    );
  }
}
