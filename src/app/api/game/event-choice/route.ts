// 事件选择 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData, updatePlayerData, addBroadcast } from '@/lib/game/auth-service';
import { getBroadcasts } from '@/lib/game/supabase-service';
import { 
  exploreZone, 
  smartAddItem, 
  checkItemOptions,
  handleDeath, 
  calculateInventoryValue, 
  dropEquipment 
} from '@/lib/game/utils';
import { ZoneType, InventoryItem, Equipment } from '@/lib/game/types';

// Buff效果接口
interface BuffEffects {
  deathRateReduction: number;
  redDropBoost: number;
  deathProtection: number;
  combatBoost: number;
  extractBoost: number;
}

// 事件选择结果接口
interface EventChoiceResult {
  success: boolean;
  message: string;
  loot?: Equipment;
  isRedDrop?: boolean;
  broadcast?: string;
  needChoice?: boolean;
  choices?: any[];
  pendingItem?: Equipment;
  deathResult?: any;
}

// 根据选择类型和ID生成结果
function generateEventChoiceResult(
  eventType: string,
  choiceId: string,
  zone: ZoneType,
  player: any,
  buffEffects?: BuffEffects
): EventChoiceResult {
  const riskLevel = choiceId.includes('safe') ? 0.1 : choiceId.includes('medium') ? 0.3 : 0.6;
  const rewardMultiplier = choiceId.includes('safe') ? 0.5 : choiceId.includes('medium') ? 1.0 : 1.5;
  
  // 基础成功率
  const successChance = 1 - riskLevel;
  
  if (Math.random() < successChance) {
    // 成功
    const result: EventChoiceResult = {
      success: true,
      message: '',
    };
    
    // 根据选择类型生成不同的成功消息
    switch (eventType) {
      case 'combat':
        if (choiceId.includes('aggressive')) {
          result.message = '【激战】\n💥 你选择了正面硬刚！\n经过激烈交火，你成功击败了敌人，并缴获了他们的装备！';
        } else if (choiceId.includes('stealth')) {
          result.message = '【潜行】\n🥷 你选择了悄悄接近...\n在敌人毫无防备时，你成功偷袭并搜刮了战利品！';
        } else {
          result.message = '【战术撤退】\n🏃 你选择了战略转移...\n成功脱离危险，并在撤退路线上发现了一些物资。';
        }
        break;
      case 'trade':
        if (choiceId.includes('accept')) {
          result.message = '【交易】\n🤝 你选择了接受交易...\n对方给了你一个合理的报价，你获得了装备。';
        } else if (choiceId.includes('negotiate')) {
          result.message = '【谈判】\n💬 你选择了讨价还价...\n经过一番博弈，你用更低的价格换到了更好的装备！';
        } else {
          result.message = '【拒绝】\n🚫 你选择了拒绝并离开...\n但你注意到对方在离开时不小心掉落了一些东西。';
        }
        break;
      case 'discovery':
        if (choiceId.includes('search')) {
          result.message = '【深入探索】\n🔍 你选择了仔细搜索...\n在隐蔽角落发现了一个补给箱！';
        } else if (choiceId.includes('mark')) {
          result.message = '【标记】\n📍 你选择了标记并离开...\n记录下位置后继续前进，稍后可以考虑折返。';
        } else {
          result.message = '【绕过】\n🚶 你选择了安全绕过...\n虽然没有收获，但你安全地保存了已有物资。';
        }
        break;
      case 'npc':
        if (choiceId.includes('help')) {
          result.message = '【帮助】\n🤝 你选择了帮助 NPC...\n他们感激地分享了情报和一个补给包！';
        } else if (choiceId.includes('exploit')) {
          result.message = '【利用】\n😈 你选择了利用 NPC...\n成功获取了他们的物资，但留下了隐患。';
        } else {
          result.message = '【忽视】\n🚶 你选择了直接离开...\n不惹麻烦，保持低调。';
        }
        break;
      case 'trap':
        if (choiceId.includes('trigger')) {
          result.message = '【触发陷阱】\n💥 陷阱触发了！\n但你反应迅速，在混乱中抢到了散落的物资！';
        } else if (choiceId.includes('disarm')) {
          result.message = '【拆除陷阱】\n🔧 你成功拆除了陷阱...\n在陷阱中发现了隐藏的宝物！';
        } else {
          result.message = '【规避】\n🛡️ 你选择了小心规避...\n安全绕过了陷阱，并在附近发现了一些遗留物资。';
        }
        break;
      case 'treasure':
        if (choiceId.includes('quick')) {
          result.message = '【立即获取】\n💰 你迅速拿走了宝物！\n时间紧迫，但至少有所收获。';
        } else if (choiceId.includes('careful')) {
          result.message = '【谨慎检查】\n🔍 你仔细检查了周围...\n发现了陷阱机关，成功解除后获得了完整的宝物！';
        } else {
          result.message = '【放弃】\n🚫 你选择了放弃...\n安全第一，继续前进。';
        }
        break;
      default:
        result.message = '【选择结果】\n你做出了选择，并获得了一些物资。';
    }
    
    // 生成装备
    if (choiceId.includes('safe') || Math.random() < 0.6) {
      const { equipment } = dropEquipment(zone, player);
      const adjustedValue = Math.floor(equipment.totalValue * rewardMultiplier);
      equipment.totalValue = adjustedValue;
      result.loot = equipment;
      result.isRedDrop = equipment.quality === 'red' || equipment.quality === 'gold';
      
      if (result.isRedDrop) {
        result.message += '\n\n🔥 发现稀有装备！';
        result.broadcast = `🔔 ${player.name} 在事件选择中获得了一件 ${equipment.name}！`;
      }
    }
    
    return result;
  } else {
    // 失败
    const result: EventChoiceResult = {
      success: false,
      message: '',
    };
    
    switch (eventType) {
      case 'combat':
        result.message = '【激战】\n💀 战斗失败！你被敌人击败。';
        break;
      case 'trade':
        result.message = '【交易】\n⚠️ 交易失败，你被对方欺骗了！';
        break;
      case 'discovery':
        result.message = '【探索】\n⚠️ 探索失败，触发了警报！';
        break;
      case 'npc':
        result.message = '【NPC】\n⚠️ NPC 背叛了你！';
        break;
      case 'trap':
        result.message = '【陷阱】\n💥 陷阱爆炸，你受到了伤害！';
        break;
      case 'treasure':
        result.message = '【宝藏】\n⚠️ 宝藏是陷阱，你损失惨重！';
        break;
      default:
        result.message = '【选择失败】\n你的选择导致了不好的结果。';
    }
    
    return result;
  }
}

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
    const { choiceId, eventType, currentZone, buffEffects } = body;
    
    if (!choiceId || !eventType) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    // 获取玩家
    let player = await getPlayerData(userId);
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }
    
    if (!player.isAlive) {
      return NextResponse.json(
        { success: false, error: '玩家已死亡，请重新开始' },
        { status: 400 }
      );
    }
    
    // 初始化装备槽
    if (!player.equipmentSlots) {
      player.equipmentSlots = [];
    }
    if (!player.safeBox) {
      player.safeBox = [];
    }
    
    // 确定区域类型
    let zone: ZoneType = 'normal';
    if (currentZone === '军事仓库') zone = 'dangerous';
    if (currentZone === '黑区实验室') zone = 'boss';
    
    // 生成事件选择结果
    const choiceResult = generateEventChoiceResult(
      eventType,
      choiceId,
      zone,
      player,
      buffEffects
    );
    
    // 更新玩家状态
    if (choiceResult.success) {
      player.winStreak++;
      player.noDropStreak = 0;
      
      if (choiceResult.loot) {
        const item: InventoryItem = { type: 'equipment', item: choiceResult.loot };
        const addResult = smartAddItem(player, item);
        
        if (!addResult.success) {
          choiceResult.needChoice = true;
          choiceResult.choices = [
            { id: 'equip', label: '装备', description: `替换装备槽物品 (${player.equipmentSlots!.length}/10)` },
            { id: 'backpack', label: '背包', description: `替换背包物品 (${player.inventory.length}/5)` },
            { id: 'safebox', label: '保险箱', description: `放入保险箱 (${player.safeBox!.length}/10)` },
            { id: 'discard', label: '丢弃', description: '放弃这件装备' },
          ];
          choiceResult.pendingItem = choiceResult.loot;
          choiceResult.message += '\n\n⚠️ 存储空间已满，请选择：';
        }
        
        if (choiceResult.isRedDrop) {
          player.redDropCount = (player.redDropCount || 0) + 1;
          if (choiceResult.broadcast) {
            addBroadcast({
              type: 'red_drop',
              message: choiceResult.broadcast,
            });
          }
        }
      }
    } else {
      // 失败，可能导致死亡
      const deathResult = handleDeath(player);
      player.failStreak++;
      player.winStreak = 0;
      player.noDropStreak++;
      
      let deathMessage = choiceResult.message + '\n\n💀【事件失败】';
      
      if (deathResult.deathProtectionTriggered) {
        deathMessage += '\n🛡️ 死亡保护触发！装备已保留。';
      } else {
        deathMessage += '\n━━━━ 损失报告 ━━━━';
        deathMessage += '\n装备槽: 蓝85% 紫60% 红70% 金50%';
        deathMessage += '\n背包: 蓝90% 紫65% 红70% 金50%';
        deathMessage += '\n资产: 扣除70%';
        
        if (deathResult.equipmentLost.length > 0) {
          deathMessage += `\n\n⚔️ 装备丢失: ${deathResult.equipmentLost.join(' ')}`;
        }
        if (deathResult.backpackLost.length > 0) {
          deathMessage += `\n🎒 背包丢失: ${deathResult.backpackLost.join(' ')}`;
        }
        deathMessage += `\n\n💰 资产: ${deathResult.moneyBefore} → ${deathResult.moneyAfter} (-${deathResult.moneyLost})`;
      }
      
      choiceResult.message = deathMessage;
      choiceResult.deathResult = deathResult;
    }
    
    player.currentRound++;
    
    // 更新信任度（基于玩家选择）
    player.aiAdviceTotal = (player.aiAdviceTotal || 0) + 1;
    // 安全选项被视为采纳 AI 建议
    if (choiceId.includes('safe') || choiceId.includes('retreat') || choiceId.includes('ignore') || choiceId.includes('bypass')) {
      player.aiAdviceAccepted = (player.aiAdviceAccepted || 0) + 1;
    }
    // 更新信任度分数
    if (player.aiAdviceTotal > 0) {
      player.trustScore = Math.round((player.aiAdviceAccepted || 0) / player.aiAdviceTotal * 100);
    }
    
    await updatePlayerData(userId, player);
    
    return NextResponse.json({
      success: true,
      data: {
        player,
        result: {
          ...choiceResult,
          inventoryValue: calculateInventoryValue(player),
        },
        broadcasts: getBroadcasts(),
      },
    });
  } catch (error) {
    console.error('Event choice error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
