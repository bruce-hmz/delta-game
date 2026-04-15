// 商店购买 API - 购买的道具作为装备放入装备槽系统

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData, updatePlayerData } from '@/lib/game/auth-service';
import { smartAddItem } from '@/lib/game/utils';
import { Equipment, InventoryItem, BACKPACK_SIZE, SAFEBOX_SIZE } from '@/lib/game/types';

// 生成唯一ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// 商店物品定义 - 生成 Equipment 对象
const SHOP_ITEMS: {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  quality: 'blue' | 'purple';
  // 生成装备的函数
  generateEquipment: () => Equipment;
}[] = [
  {
    id: 'night_vision',
    name: '夜视镜',
    description: '降低死亡概率15%，更容易发现敌人',
    price: 200,
    icon: '🔭',
    quality: 'blue',
    generateEquipment: () => ({
      id: generateId(),
      name: '🔭 夜视镜',
      quality: 'blue',
      affixes: [
        {
          type: 'death_protection',
          value: 15,
          description: '死亡保护(15%概率不死)',
        },
      ],
      baseValue: 100,
      totalValue: 200,
      description: '先进的夜视设备，能在黑暗中提前发现危险',
    }),
  },
  {
    id: 'lucky_charm',
    name: '幸运护符',
    description: '红装掉率提升10%',
    price: 300,
    icon: '🍀',
    quality: 'purple',
    generateEquipment: () => ({
      id: generateId(),
      name: '🍀 幸运护符',
      quality: 'purple',
      affixes: [
        {
          type: 'drop_rate',
          value: 10,
          description: '开红概率+10%',
        },
      ],
      baseValue: 200,
      totalValue: 300,
      description: '据说能带来好运的神秘护符',
    }),
  },
  {
    id: 'tactical_armor',
    name: '战术护甲',
    description: '减少10%死亡概率',
    price: 500,
    icon: '🛡️',
    quality: 'purple',
    generateEquipment: () => ({
      id: generateId(),
      name: '🛡️ 战术护甲',
      quality: 'purple',
      affixes: [
        {
          type: 'death_protection',
          value: 10,
          description: '死亡保护(10%概率不死)',
        },
        {
          type: 'combat_rate',
          value: 10,
          description: '战斗胜率+10%',
        },
      ],
      baseValue: 300,
      totalValue: 500,
      description: '轻便但坚固的战术护甲，提供全方位保护',
    }),
  },
  {
    id: 'combat_helmet',
    name: '战斗头盔',
    description: '战斗胜率+15%',
    price: 350,
    icon: '⛑️',
    quality: 'purple',
    generateEquipment: () => ({
      id: generateId(),
      name: '⛑️ 战斗头盔',
      quality: 'purple',
      affixes: [
        {
          type: 'combat_rate',
          value: 15,
          description: '战斗胜率+15%',
        },
      ],
      baseValue: 200,
      totalValue: 350,
      description: '军用级战斗头盔，提升战场生存能力',
    }),
  },
  {
    id: 'extract_device',
    name: '撤离信标',
    description: '撤离成功率+15%',
    price: 400,
    icon: '📡',
    quality: 'purple',
    generateEquipment: () => ({
      id: generateId(),
      name: '📡 撤离信标',
      quality: 'purple',
      affixes: [
        {
          type: 'extract_rate',
          value: 15,
          description: '撤离成功率+15%',
        },
      ],
      baseValue: 250,
      totalValue: 400,
      description: '便携式撤离信标，能呼叫更可靠的撤离支援',
    }),
  },
  {
    id: 'expansion_bag',
    name: '扩容背包',
    description: '背包容量+2',
    price: 250,
    icon: '🎒',
    quality: 'blue',
    generateEquipment: () => ({
      id: generateId(),
      name: '🎒 扩容背包',
      quality: 'blue',
      affixes: [
        {
          type: 'bag_size',
          value: 2,
          description: '背包容量+2',
        },
      ],
      baseValue: 150,
      totalValue: 250,
      description: '改装过的战术背包，能携带更多战利品',
    }),
  },
  {
    id: 'value_scanner',
    name: '价值扫描仪',
    description: '装备价值+20%',
    price: 300,
    icon: '💎',
    quality: 'purple',
    generateEquipment: () => ({
      id: generateId(),
      name: '💎 价值扫描仪',
      quality: 'purple',
      affixes: [
        {
          type: 'value_bonus',
          value: 20,
          description: '装备价值+20%',
        },
      ],
      baseValue: 200,
      totalValue: 300,
      description: '能识别物品真实价值的扫描设备',
    }),
  },
];

export async function POST(request: NextRequest) {
  try {
    // 从 Header 获取 token
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少身份凭证', needAuth: true },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { itemId, choice, replaceIndex } = body as { 
      itemId: string; 
      choice?: 'equip_replace' | 'backpack_replace' | 'safebox_replace' | 'discard';
      replaceIndex?: number;
    };
    
    // 获取玩家
    const player = await getPlayerData(userId);
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: '用户不存在，请先初始化', requireInit: true },
        { status: 404 }
      );
    }
    
    // 初始化装备槽和保险箱
    if (!player.equipmentSlots) player.equipmentSlots = [];
    if (!player.safeBox) player.safeBox = [];
    
    // 查找物品
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    
    if (!item) {
      return NextResponse.json(
        { success: false, error: '物品不存在' },
        { status: 404 }
      );
    }
    
    // 检查金币是否足够
    if (player.money < item.price) {
      return NextResponse.json(
        { success: false, error: `金币不足！需要 ${item.price} 金币，当前 ${player.money} 金币` },
        { status: 400 }
      );
    }
    
    // 生成装备
    const equipment = item.generateEquipment();
    const inventoryItem: InventoryItem = { type: 'equipment', item: equipment };
    
    // 尝试添加物品
    const addResult = smartAddItem(player, inventoryItem);
    
    if (!addResult.success) {
      // 全满了，检查是否有选择
      if (!choice) {
        // 返回需要选择
        return NextResponse.json({
          success: true,
          data: {
            player,
            message: `${item.icon} ${item.name} 需要选择存放位置`,
            needChoice: true,
            choices: [
              { id: 'equip_replace', label: '替换装备槽', description: `选择一个装备槽位替换 (${player.equipmentSlots!.length}/10)` },
              { id: 'backpack_replace', label: '替换背包', description: `选择一个背包位置替换 (${player.inventory.length}/${BACKPACK_SIZE})` },
              { id: 'safebox_replace', label: '放入保险箱', description: `替换保险箱位置 (${player.safeBox!.length}/${SAFEBOX_SIZE})` },
              { id: 'discard', label: '放弃购买', description: '取消此次购买' },
            ],
            pendingItem: equipment,
          },
        });
      }
      
      // 处理选择
      if (choice === 'discard') {
        return NextResponse.json({
          success: true,
          data: {
            player,
            message: '已取消购买',
          },
        });
      }
      
      // 执行替换
      if (choice === 'equip_replace' && replaceIndex !== undefined) {
        if (replaceIndex >= 0 && replaceIndex < player.equipmentSlots!.length) {
          player.equipmentSlots![replaceIndex] = inventoryItem;
        } else if (replaceIndex >= player.equipmentSlots!.length && replaceIndex < 10) {
          // 空槽位
          player.equipmentSlots!.push(inventoryItem);
        }
      } else if (choice === 'backpack_replace' && replaceIndex !== undefined) {
        if (replaceIndex >= 0 && replaceIndex < player.inventory.length) {
          player.inventory[replaceIndex] = inventoryItem;
        } else if (player.inventory.length < BACKPACK_SIZE) {
          player.inventory.push(inventoryItem);
        }
      } else if (choice === 'safebox_replace') {
        // 找保险箱空位或替换
        if (player.safeBox!.length < SAFEBOX_SIZE) {
          player.safeBox!.push(inventoryItem);
        } else if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < SAFEBOX_SIZE) {
          player.safeBox![replaceIndex] = inventoryItem;
        }
      }
    }
    
    // 扣除金币
    player.money -= item.price;
    
    // 更新玩家数据
    await updatePlayerData(userId, player);
    
    return NextResponse.json({
      success: true,
      data: {
        player,
        message: `成功购买 ${item.icon} ${item.name}！${addResult.success ? addResult.message : ''}`,
      },
    });
  } catch (error) {
    console.error('Shop purchase error:', error);
    return NextResponse.json(
      { success: false, error: '购买失败' },
      { status: 500 }
    );
  }
}

// 获取商店物品列表
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      items: SHOP_ITEMS.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        icon: item.icon,
        quality: item.quality,
      })),
    },
  });
}
