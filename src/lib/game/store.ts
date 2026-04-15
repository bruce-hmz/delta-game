// 游戏状态管理器（内存存储）

import { PlayerState, Leaderboard, LeaderboardEntry, GameEvent } from './types';
import { createNewPlayer, calculateTotalWealth } from './utils';

// 全局游戏状态
class GameStore {
  private players: Map<string, PlayerState> = new Map();
  private leaderboards: Leaderboard = {
    wealth: [],
    redDrops: [],
    maxProfit: [],
  };
  private broadcasts: string[] = [];
  private redDropCount: Map<string, number> = new Map();
  
  private static instance: GameStore;
  
  private constructor() {}
  
  static getInstance(): GameStore {
    if (!GameStore.instance) {
      GameStore.instance = new GameStore();
    }
    return GameStore.instance;
  }
  
  // 创建或获取玩家
  getOrCreatePlayer(name: string): PlayerState {
    let player = Array.from(this.players.values()).find(p => p.name === name);
    
    if (!player) {
      player = createNewPlayer(name);
      this.players.set(player.id, player);
    }
    
    return player;
  }
  
  // 获取玩家
  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }
  
  // 更新玩家
  updatePlayer(player: PlayerState): void {
    this.players.set(player.id, player);
  }
  
  // 重置玩家（重新开始）
  resetPlayer(id: string, name: string): PlayerState {
    const player = createNewPlayer(name);
    player.id = id;
    this.players.set(id, player);
    
    // 保留开红计数
    const redCount = this.redDropCount.get(id) || 0;
    this.redDropCount.set(id, redCount);
    
    return player;
  }
  
  // 添加广播消息
  addBroadcast(message: string): void {
    this.broadcasts.unshift(message);
    // 只保留最近10条
    if (this.broadcasts.length > 10) {
      this.broadcasts.pop();
    }
  }
  
  // 获取广播消息
  getBroadcasts(): string[] {
    return this.broadcasts;
  }
  
  // 增加开红次数
  incrementRedDrops(playerId: string): void {
    const count = this.redDropCount.get(playerId) || 0;
    this.redDropCount.set(playerId, count + 1);
  }
  
  // 获取开红次数
  getRedDropCount(playerId: string): number {
    return this.redDropCount.get(playerId) || 0;
  }
  
  // 更新排行榜
  updateLeaderboards(player: PlayerState, extractValue: number): void {
    const timestamp = Date.now();
    
    // 更新财富榜
    const wealth = calculateTotalWealth(player);
    this.updateLeaderboard('wealth', {
      rank: 0,
      playerName: player.name,
      value: wealth,
      timestamp,
    });
    
    // 更新开红次数榜
    const redCount = this.getRedDropCount(player.id);
    this.updateLeaderboard('redDrops', {
      rank: 0,
      playerName: player.name,
      value: redCount,
      timestamp,
    });
    
    // 更新单局最高收益榜
    if (extractValue > 0) {
      this.updateLeaderboard('maxProfit', {
        rank: 0,
        playerName: player.name,
        value: extractValue,
        timestamp,
      });
    }
  }
  
  // 更新单个排行榜
  private updateLeaderboard(
    type: 'wealth' | 'redDrops' | 'maxProfit',
    entry: LeaderboardEntry
  ): void {
    const board = this.leaderboards[type];
    
    // 移除同名旧记录
    const filtered = board.filter(e => e.playerName !== entry.playerName);
    
    // 添加新记录
    filtered.push(entry);
    
    // 排序
    filtered.sort((a, b) => b.value - a.value);
    
    // 只保留前10名
    this.leaderboards[type] = filtered.slice(0, 10).map((e, i) => ({
      ...e,
      rank: i + 1,
    }));
  }
  
  // 获取排行榜
  getLeaderboards(): Leaderboard {
    return this.leaderboards;
  }
  
  // 获取玩家排名
  getPlayerRank(playerName: string): { wealth: number; redDrops: number; maxProfit: number } {
    const wealthRank = this.leaderboards.wealth.findIndex(e => e.playerName === playerName);
    const redDropsRank = this.leaderboards.redDrops.findIndex(e => e.playerName === playerName);
    const maxProfitRank = this.leaderboards.maxProfit.findIndex(e => e.playerName === playerName);
    
    return {
      wealth: wealthRank >= 0 ? wealthRank + 1 : -1,
      redDrops: redDropsRank >= 0 ? redDropsRank + 1 : -1,
      maxProfit: maxProfitRank >= 0 ? maxProfitRank + 1 : -1,
    };
  }
  
  // 获取所有在线玩家（模拟）
  getOnlinePlayers(): number {
    return Math.floor(Math.random() * 50) + 20; // 模拟20-70人在线
  }
  
  // 生成模拟玩家（用于排行榜初始化）
  initializeMockPlayers(): void {
    const mockNames = [
      '夜猫子', '欧皇', '赌神', '老司机', '萌新', 
      '大佬', '菜鸟', '大神', '小号', '路人'
    ];
    
    mockNames.forEach(name => {
      const player = createNewPlayer(name);
      player.money = Math.floor(Math.random() * 50000) + 5000;
      this.players.set(player.id, player);
      
      // 模拟开红次数
      this.redDropCount.set(player.id, Math.floor(Math.random() * 20));
      
      // 更新排行榜
      this.updateLeaderboards(player, Math.floor(Math.random() * 10000));
    });
  }
}

// 导出单例
export const gameStore = GameStore.getInstance();

// 初始化模拟玩家
if (typeof window === 'undefined') {
  gameStore.initializeMockPlayers();
}
