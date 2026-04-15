// 撤离结算 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken, getPlayerData, updatePlayerData, addLeaderboardRecord, getLeaderboardData } from '@/lib/game/auth-service';
import { extract, handleDeath, DeathResult, calculateInventoryValue, calculateAllItemsValue } from '@/lib/game/utils';
import { generateBattleReport, AIBattleReportOutput } from '@/lib/ai';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Buff效果接口
interface BuffEffects {
  deathRateReduction: number;
  redDropBoost: number;
  deathProtection: number;
  combatBoost: number;
  extractBoost: number;
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
    
    // 解析请求体（可选）
    let buffEffects: BuffEffects | undefined;
    try {
      const body = await request.json();
      buffEffects = body?.buffEffects;
    } catch {
      // body 为空时使用默认值
    }
    
    // 获取玩家
    let player = await getPlayerData(userId);
    
    console.log('[Extract] getPlayerData result:', player ? `id=${player.id}, isAlive=${player.isAlive}` : 'null');
    
    if (!player) {
      console.error('[Extract] Player not found for userId:', userId);
      return NextResponse.json(
        { success: false, error: '用户不存在，请先初始化', requireInit: true },
        { status: 404 }
      );
    }
    
    if (!player.isAlive) {
      console.error('[Extract] Player is dead:', player.isAlive);
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
    
    // 应用buff效果
    if (buffEffects?.extractBoost) {
      player.extractRateBonus = buffEffects.extractBoost;
    }
    
    // 计算当前所有物品价值（装备槽 + 背包）
    const currentAllValue = calculateAllItemsValue(player);
    const currentInventoryValue = calculateInventoryValue(player);
    
    // 执行撤离
    const result = extract(player);
    
    if (result.success) {
      // 撤离成功：装备槽和背包物品都计入收益
      const totalValue = currentAllValue;
      
      player.money += totalValue;
      player.totalExtractValue = (player.totalExtractValue || 0) + totalValue;
      
      // 更新最高收益
      if (totalValue > (player.maxProfit || 0)) {
        player.maxProfit = totalValue;
      }
      
      // 更新游戏局数
      player.totalGames = (player.totalGames || 0) + 1;
      
      // 清空装备槽和背包，保留保险箱
      player.equipmentSlots = [];
      player.inventory = [];
      player.failStreak = 0;
      player.noDropStreak = 0;
      
      result.totalValue = totalValue;
      result.message = `【撤离点已确认】\n🚁 接应直升机抵达...\n✅ 撤离成功！\n\n你成功带出了价值 ${totalValue.toLocaleString()} 的物资！\n本次行动圆满结束。`;
      
      // 更新排行榜
      await addLeaderboardRecord(userId, player, totalValue);
    } else {
      // 撤离失败：执行死亡逻辑（高风险丢失）
      const deathResult = handleDeath(player);
      player.failStreak++;
      
      // 生成失败提示消息
      let failMessage = `【撤离失败】\n⚠️ 撤离点遭遇伏击！\n💀 敌方火力压制...\n`;
      
      if (deathResult.deathProtectionTriggered) {
        failMessage += `\n🛡️ 死亡保护触发！装备已保留。`;
        failMessage += `\n\n背包物资丢失。`;
      } else {
        // 显示丢失率
        failMessage += '\n\n💀【失败结算】';
        failMessage += '\n━━━━ 丢失率 ━━━━';
        failMessage += '\n装备槽: 蓝85% 紫60% 红70% 金50%';
        failMessage += '\n背包: 蓝90% 紫65% 红70% 金50%';
        failMessage += '\n资产: 扣除70%';
        
        // 显示装备丢失
        if (deathResult.equipmentLost.length > 0) {
          failMessage += `\n\n⚔️ 装备丢失: ${deathResult.equipmentLost.join(' ')}`;
        }
        if (deathResult.equipmentKept.length > 0) {
          failMessage += `\n🛡️ 装备保留: ${deathResult.equipmentKept.join(' ')}`;
        }
        if (deathResult.backpackLost.length > 0) {
          failMessage += `\n🎒 背包丢失: ${deathResult.backpackLost.join(' ')}`;
        }
        if (deathResult.backpackKept.length > 0) {
          failMessage += `\n✅ 背包保留: ${deathResult.backpackKept.join(' ')}`;
        }
        
        // 显示掉落装备
        if (deathResult.droppedItems.length > 0) {
          failMessage += `\n\n📦 本次掉落: ${deathResult.droppedItems.join(' ')}`;
        }
        
        // 显示资产扣除
        failMessage += `\n\n💰 资产: ${deathResult.moneyBefore} → ${deathResult.moneyAfter} (-${deathResult.moneyLost})`;
      }
      
      result.message = failMessage;
      result.deathResult = deathResult;
    }
    
    // 🤖 AI 生成战报
    let aiReport: AIBattleReportOutput | null = null;
    try {
      // 计算玩家风格
      const playerStyle = player.winStreak > 3 ? 'aggressive' : 
                         player.failStreak > 2 ? 'conservative' : 'balanced';
      
      aiReport = await generateBattleReport({
        result: {
          success: result.success,
          finalValue: result.success ? (result.totalValue || 0) : 0,
          lostValue: !result.success ? currentAllValue : undefined,
          deathCause: !result.success ? '撤离失败遭遇伏击' : undefined,
        },
        events: [], // 可以从玩家历史获取
        playerStyle: playerStyle,
        playerName: player.name,
        totalRounds: player.currentRound || 1,
        zonesExplored: ['废弃居民区'], // 可以从历史获取
        highlights: result.success ? ['成功撤离'] : ['撤离失败'],
      }, customHeaders);  // 传入 headers
      
      // 把AI战报添加到结果中
      if (aiReport) {
        result.aiReport = aiReport;
      }
    } catch (error) {
      console.error('AI report generation failed:', error);
      // 失败时继续用原有消息，不影响游戏流程
    }
    
    // 更新玩家数据
    await updatePlayerData(userId, player);
    
    // 更新游戏会话记录
    try {
      const client = getSupabaseClient();
      console.log('[Extract] Updating session for userId:', userId);
      
      // 查找最新的未结束 session
      const { data: sessions, error: queryError } = await client
        .from('game_sessions')
        .select('id, start_time')
        .eq('player_id', userId)
        .is('end_time', null)
        .order('created_at', { ascending: false })
        .limit(1);
      
      console.log('[Extract] Sessions query result:', { sessions, queryError });
      
      if (sessions && sessions.length > 0) {
        const session = sessions[0];
        const startTime = new Date(session.start_time).getTime();
        const duration = Math.floor((Date.now() - startTime) / 1000);
        
        console.log('[Extract] Updating session:', session.id, 'duration:', duration);
        
        const { error: updateError } = await client.from('game_sessions')
          .update({
            end_time: new Date().toISOString(),
            duration_seconds: duration,
            final_value: result.success ? result.totalValue : 0,
            extracted: result.success,
            died: !result.success,
          })
          .eq('id', session.id);
        
        console.log('[Extract] Session update error:', updateError);
      } else {
        console.log('[Extract] No active session found');
      }
    } catch (error) {
      console.error('[Extract] Failed to update session:', error);
    }
    
    // 获取最新排行榜
    const leaderboard = await getLeaderboardData();
    
    return NextResponse.json({
      success: true,
      data: {
        player,
        result: {
          ...result,
          currentInventoryValue,
          currentAllValue,
        },
        leaderboard,
      },
    });
  } catch (error) {
    console.error('Extract error:', error);
    // 检查具体是哪个环节出错
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { success: false, error: '撤离失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
