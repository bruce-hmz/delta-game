// 探索区域 API - 集成事件系统

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData, updatePlayerData, addBroadcast } from '@/lib/game/auth-service';
import { getBroadcasts } from '@/lib/game/supabase-service';
import { 
  exploreZone, 
  smartAddItem, 
  handleDeath, 
  calculateInventoryValue, 
  dropEquipment 
} from '@/lib/game/utils';
import { ZoneType, InventoryItem, Equipment } from '@/lib/game/types';
import { 
  selectRandomEvent, 
  calculateLoadLevel, 
  getExposureLimit,
  processEventChoice,
  generateReportLine,
  MAX_EXPOSURE,
  generateAIAdvice,
  AIAdviceContext,
  EventResult
} from '@/lib/game/event-system';
import { 
  generateNarrativeDescription, 
  generateOptionNarrative,
  NarrativeContext 
} from '@/lib/game/narrative-service';
import { HeaderUtils } from 'coze-coding-dev-sdk';

// Buff效果接口
interface BuffEffects {
  deathRateReduction: number;
  redDropBoost: number;
  deathProtection: number;
  combatBoost: number;
  extractBoost: number;
  guaranteedRed?: boolean;
}

// 探索API请求
interface ExploreRequest {
  zone: ZoneType;
  buffEffects?: BuffEffects;
  actionType?: 'stealth' | 'search' | 'assault';
  eventChoice?: { eventId: string; optionId: string };
}

// 检查是否触发事件
function shouldTriggerEvent(exposure: number): boolean {
  // 暴露度越高，事件触发概率越高
  const baseChance = 0.3; // 基础30%
  const exposureBonus = exposure * 0.05; // 每级+5%
  return Math.random() < (baseChance + exposureBonus);
}

export async function POST(request: NextRequest) {
  try {
    // 提取请求头用于 AI 调用
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 从 Header 获取 token
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少身份凭证', needAuth: true },
        { status: 401 }
      );
    }
    
    const body: ExploreRequest = await request.json();
    const { zone, buffEffects, actionType = 'search', eventChoice } = body;
    
    // 获取玩家
    let player = await getPlayerData(userId);
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: '用户不存在，请先初始化', requireInit: true },
        { status: 404 }
      );
    }
    
    if (!player.isAlive) {
      return NextResponse.json(
        { success: false, error: '玩家已死亡，请重新开始' },
        { status: 400 }
      );
    }
    
    // 初始化装备槽（兼容旧数据）
    if (!player.equipmentSlots) {
      player.equipmentSlots = [];
    }
    if (!player.safeBox) {
      player.safeBox = [];
    }
    
    // 初始化暴露度
    if (typeof player.exposure !== 'number') {
      player.exposure = 0;
    }
    
    // 应用buff效果到玩家状态
    if (buffEffects) {
      player.bonusDropRate = buffEffects.redDropBoost || 0;
      player.combatWinRateBonus = buffEffects.combatBoost || 0;
      player.extractRateBonus = buffEffects.extractBoost || 0;
    }
    
    // 检查是否有"必出红装"buff
    if (buffEffects?.guaranteedRed) {
      const quality = Math.random() < 0.3 ? 'gold' : 'red';
      const { equipment } = dropEquipment(zone, player);
      equipment.quality = quality;
      equipment.totalValue = quality === 'gold' ? equipment.totalValue * 2 : equipment.totalValue;
      equipment.name = (quality === 'gold' ? '💰 ' : '🔥 ') + equipment.name.replace(/^[^\s]+\s/, '');
      
      const result: any = {
        success: true,
        isRedDrop: true,
        message: `【潜入${zone === 'normal' ? '废弃居民区' : zone === 'dangerous' ? '军事仓库' : '黑区实验室'}】\n📍 深入搜索...\n🎫 黄金通行证生效！\n\n你获得了 ${equipment.name}！`,
        loot: equipment,
        redDropAnnouncement: {
          selfMessages: ['🎫 黄金通行证生效！', quality === 'gold' ? '🌟！！！金色传说！！！' : '🔥！！！开红成功！！！'],
          identityMessage: '👉 你的投资得到了回报！',
        },
      };
      
      const item: InventoryItem = { type: 'equipment', item: equipment };
      const addResult = smartAddItem(player, item);
      
      if (!addResult.success) {
        result.needChoice = true;
        result.choices = [
          { id: 'equip', label: '装备', description: `替换装备槽物品 (${player.equipmentSlots!.length}/10)` },
          { id: 'backpack', label: '背包', description: `替换背包物品 (${player.inventory.length}/5)` },
          { id: 'safebox', label: '保险箱', description: `放入保险箱 (${player.safeBox!.length}/10)` },
          { id: 'discard', label: '丢弃', description: '放弃这件装备' },
        ];
        result.pendingItem = equipment;
      }
      
      player.winStreak++;
      player.noDropStreak = 0;
      player.currentRound++;
      player.redDropCount = (player.redDropCount || 0) + 1;
      
      addBroadcast({
        type: 'red_drop',
        message: `🔔 ${player.name} 使用黄金通行证获得了 ${equipment.name}！`,
      });
      
      await updatePlayerData(userId, player);
      
      return NextResponse.json({
        success: true,
        data: {
          player,
          result: {
            ...result,
            inventoryValue: calculateInventoryValue(player),
            exposure: player.exposure,
            loadLevel: calculateLoadLevel(calculateInventoryValue(player)),
          },
          broadcasts: getBroadcasts(),
        },
      });
    }
    
    // ===== 处理事件选择 =====
    if (eventChoice) {
      return handleEventChoiceResult(player, eventChoice, zone, actionType, userId);
    }
    
    // ===== 正常探索流程 =====
    // 执行探索
    const result = exploreZone(zone, player);
    
    // 应用死亡概率降低效果
    if (buffEffects?.deathRateReduction && !result.success && result.combat) {
      const survivalChance = buffEffects.deathRateReduction;
      if (Math.random() < survivalChance) {
        result.success = true;
        result.message = '【遭遇敌人】\n⚠️ 夜视镜生效！你提前发现了敌人并成功规避。';
        result.combat = undefined;
      }
    }
    
    // 更新玩家状态
    if (result.success) {
      player.winStreak++;
      
      // 暴露度变化
      const baseExposure = actionType === 'stealth' ? 0 : actionType === 'assault' ? 2 : 1;
      player.exposure = Math.min(MAX_EXPOSURE, player.exposure + baseExposure);
      
      if (result.loot) {
        const item: InventoryItem = { type: 'equipment', item: result.loot };
        const addResult = smartAddItem(player, item);
        
        if (!addResult.success) {
          result.needChoice = true;
          result.choices = [
            { id: 'equip', label: '装备', description: `替换装备槽物品 (${player.equipmentSlots!.length}/10)` },
            { id: 'backpack', label: '背包', description: `替换背包物品 (${player.inventory.length}/5)` },
            { id: 'safebox', label: '保险箱', description: `放入保险箱 (${player.safeBox!.length}/10)` },
            { id: 'discard', label: '丢弃', description: '放弃这件装备' },
          ];
          result.pendingItem = result.loot;
          result.message += '\n\n⚠️ 存储空间已满！请选择：';
        }
        
        if (result.isRedDrop) {
          player.noDropStreak = 0;
          player.failStreak = 0;
          player.redDropCount = (player.redDropCount || 0) + 1;
          
          if (result.broadcast) {
            addBroadcast({
              type: 'red_drop',
              message: result.broadcast,
            });
          }
        } else {
          player.noDropStreak++;
        }
      }
    } else {
      // 死亡逻辑
      const deathResult = handleDeath(player);
      player.failStreak++;
      player.winStreak = 0;
      player.noDropStreak++;
      
      // 暴露度清零
      player.exposure = 0;
      
      let deathMessage = result.message + '\n\n💀【死亡结算】';
      
      if (deathResult.deathProtectionTriggered) {
        deathMessage += '\n🛡️ 死亡保护触发！装备已保留。';
      } else {
        deathMessage += '\n━━━━ 丢失率 ━━━━';
        deathMessage += '\n装备槽: 蓝85% 紫60% 红70% 金50%';
        deathMessage += '\n背包: 蓝90% 紫65% 红70% 金50%';
        deathMessage += '\n资产: 扣除70%';
        
        if (deathResult.equipmentLost.length > 0) {
          deathMessage += `\n\n⚔️ 装备丢失: ${deathResult.equipmentLost.join(' ')}`;
        }
        if (deathResult.equipmentKept.length > 0) {
          deathMessage += `\n🛡️ 装备保留: ${deathResult.equipmentKept.join(' ')}`;
        }
        if (deathResult.backpackLost.length > 0) {
          deathMessage += `\n🎒 背包丢失: ${deathResult.backpackLost.join(' ')}`;
        }
        if (deathResult.backpackKept.length > 0) {
          deathMessage += `\n✅ 背包保留: ${deathResult.backpackKept.join(' ')}`;
        }
        
        deathMessage += `\n\n💰 资产: ${deathResult.moneyBefore} → ${deathResult.moneyAfter} (-${deathResult.moneyLost})`;
      }
      
      result.message = deathMessage;
      result.deathResult = deathResult;
    }
    
    player.currentRound++;
    
    // 计算风险星级
    const inventoryValue = calculateInventoryValue(player);
    const baseZoneRisk = zone === 'normal' ? 1 : zone === 'dangerous' ? 2 : 3;
    const valueRisk = inventoryValue > 10000 ? 2 : inventoryValue > 5000 ? 1 : 0;
    const roundRisk = player.currentRound > 8 ? 1 : player.currentRound > 5 ? 0 : -1;
    player.riskStars = Math.max(1, Math.min(5, baseZoneRisk + valueRisk + roundRisk));
    
    // ===== 检查是否触发事件 =====
    if (player.isAlive && shouldTriggerEvent(player.exposure)) {
      const gameEvent = selectRandomEvent(player.exposure, zone);
      
      if (gameEvent) {
        // 返回事件给前端选择
        const loadLevel = calculateLoadLevel(inventoryValue);
        
        // 构建叙事化上下文
        const narrativeContext: NarrativeContext = {
          exposure: player.exposure,
          loadLevel,
          carryValue: inventoryValue,
          playerStyle: player.styleTag || 'unknown',
          round: player.currentRound,
          currentZone: zone,
        };
        
        // 生成叙事化描述
        const narrativeDescription = generateNarrativeDescription(gameEvent, narrativeContext);
        
        // 为选项生成叙事化描述
        const narrativeOptions = gameEvent.options.map(option => ({
          ...option,
          narrativeAction: generateOptionNarrative(option, gameEvent, narrativeContext),
        }));
        
        await updatePlayerData(userId, player);
        
        return NextResponse.json({
          success: true,
          data: {
            player,
            result: {
              ...result,
              inventoryValue,
              exposure: player.exposure,
              loadLevel,
              // 触发事件
              triggerEvent: true,
              event: {
                ...gameEvent,
                narrativeDescription,
                options: narrativeOptions,
              },
              eventActionType: actionType,
            },
            broadcasts: getBroadcasts(),
          },
        });
      }
    }
    
    // ===== 生成AI建议 =====
    const loadLevel = calculateLoadLevel(inventoryValue);
    const aiAdvice = generateAIAdvice({
      carryValue: inventoryValue,
      exposure: player.exposure,
      loadLevel,
      exposureLimit: getExposureLimit(loadLevel),
      riskStars: player.riskStars || 1,
      styleTag: player.styleTag || 'unknown',
      currentZone: zone === 'normal' ? '废弃居民区' : zone === 'dangerous' ? '军事仓库' : '黑区实验室',
    });
    
    await updatePlayerData(userId, player);
    
    return NextResponse.json({
      success: true,
      data: {
        player,
        result: {
          ...result,
          inventoryValue,
          exposure: player.exposure,
          loadLevel,
          aiAdvice,
        },
        broadcasts: getBroadcasts(),
      },
    });
  } catch (error) {
    console.error('Explore error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 处理事件选择结果
async function handleEventChoiceResult(
  player: any,
  eventChoice: { eventId: string; optionId: string },
  zone: ZoneType,
  actionType: 'stealth' | 'search' | 'assault',
  userId: string
) {
  // 查找事件
  const { GAME_EVENTS, calculateLoadLevel, getExposureLimit, generateAIAdvice, generateReportLine, MAX_EXPOSURE } = await import('@/lib/game/event-system');
  
  const gameEvent = GAME_EVENTS.find(e => e.id === eventChoice.eventId);
  
  if (!gameEvent) {
    return NextResponse.json(
      { success: false, error: '事件不存在' },
      { status: 400 }
    );
  }
  
  // 处理事件结果
  const eventResult = processEventChoice(gameEvent, eventChoice.optionId, player, actionType);
  
  // 更新玩家状态
  if (eventResult.success) {
    player.winStreak++;
    
    // 暴露度变化
    player.exposure = Math.max(0, Math.min(MAX_EXPOSURE, player.exposure + eventResult.exposureChange));
    
    if (eventResult.loot) {
      const item: InventoryItem = { type: 'equipment', item: eventResult.loot };
      const addResult = smartAddItem(player, item);
      
      if (!addResult.success) {
        // 需要选择存储位置
        await updatePlayerData(userId, player);
        
        return NextResponse.json({
          success: true,
          data: {
            player,
            result: {
              success: true,
              message: eventResult.message + '\n\n⚠️ 存储空间已满！请选择：',
              inventoryValue: calculateInventoryValue(player),
              exposure: player.exposure,
              loadLevel: calculateLoadLevel(calculateInventoryValue(player)),
              needChoice: true,
              choices: [
                { id: 'equip', label: '装备', description: `替换装备槽物品 (${player.equipmentSlots!.length}/10)` },
                { id: 'backpack', label: '背包', description: `替换背包物品 (${player.inventory.length}/5)` },
                { id: 'safebox', label: '保险箱', description: `放入保险箱 (${player.safeBox!.length}/10)` },
                { id: 'discard', label: '丢弃', description: '放弃这件装备' },
              ],
              pendingItem: eventResult.loot,
            },
            broadcasts: getBroadcasts(),
          },
        });
      }
      
      if (eventResult.isRedDrop && eventResult.broadcast) {
        addBroadcast({
          type: 'red_drop',
          message: eventResult.broadcast,
        });
      }
    }
  } else {
    // 失败
    player.failStreak++;
    player.winStreak = 0;
    
    if (eventResult.isDeath) {
      // 死亡
      const deathResult = eventResult.deathResult;
      player.exposure = 0;
      
      let deathMessage = eventResult.message + '\n\n💀【死亡结算】';
      
      if (deathResult?.deathProtectionTriggered) {
        deathMessage += '\n🛡️ 死亡保护触发！装备已保留。';
      } else {
        deathMessage += '\n━━━━ 损失报告 ━━━━';
        if (deathResult?.equipmentLost?.length && deathResult.equipmentLost.length > 0) {
          deathMessage += `\n⚔️ 装备丢失: ${deathResult.equipmentLost.join(' ')}`;
        }
        if (deathResult?.backpackLost?.length && deathResult.backpackLost.length > 0) {
          deathMessage += `\n🎒 背包丢失: ${deathResult.backpackLost.join(' ')}`;
        }
        deathMessage += `\n💰 资产: ${deathResult?.moneyBefore} → ${deathResult?.moneyAfter} (-${deathResult?.moneyLost})`;
      }
      
      eventResult.message = deathMessage;
    } else {
      // 未死亡但失败，暴露度仍然增加
      player.exposure = Math.max(0, Math.min(MAX_EXPOSURE, player.exposure + eventResult.exposureChange));
    }
  }
  
  player.currentRound++;
  
  // 计算风险星级
  const inventoryValue = calculateInventoryValue(player);
  const baseZoneRisk = zone === 'normal' ? 1 : zone === 'dangerous' ? 2 : 3;
  const valueRisk = inventoryValue > 10000 ? 2 : inventoryValue > 5000 ? 1 : 0;
  const roundRisk = player.currentRound > 8 ? 1 : player.currentRound > 5 ? 0 : -1;
  player.riskStars = Math.max(1, Math.min(5, baseZoneRisk + valueRisk + roundRisk));
  
  // 生成战报记录
  const reportLine = generateReportLine(gameEvent, eventChoice.optionId, player.currentRound);
  
  // 生成AI建议
  const loadLevel = calculateLoadLevel(inventoryValue);
  const aiAdvice = generateAIAdvice({
    carryValue: inventoryValue,
    exposure: player.exposure,
    loadLevel,
    exposureLimit: getExposureLimit(loadLevel),
    riskStars: player.riskStars,
    styleTag: player.styleTag || 'unknown',
    currentZone: zone === 'normal' ? '废弃居民区' : zone === 'dangerous' ? '军事仓库' : '黑区实验室',
    currentEvent: gameEvent,
  });
  
  await updatePlayerData(userId, player);
  
  return NextResponse.json({
    success: true,
    data: {
      player,
      result: {
        success: !eventResult.isDeath,
        message: eventResult.message,
        loot: eventResult.loot,
        isRedDrop: eventResult.isRedDrop,
        isDeath: eventResult.isDeath,
        deathResult: eventResult.deathResult,
        inventoryValue,
        exposure: player.exposure,
        loadLevel,
        aiAdvice,
        reportLine,
        eventReport: {
          eventName: gameEvent.name,
          optionChosen: gameEvent.options.find(o => o.id === eventChoice.optionId)?.text,
          success: eventResult.success,
        },
      },
      broadcasts: getBroadcasts(),
    },
  });
}
