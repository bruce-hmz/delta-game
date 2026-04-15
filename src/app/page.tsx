'use client';

import { useState, useEffect, useCallback } from 'react';
import { logShare } from '@/lib/game/telemetry-service';
import { calculateLoadLevel, LOAD_THRESHOLDS, MAX_EXPOSURE } from '@/lib/game/event-system';
import ReportModal from '@/components/ReportModal';

// ==================== 类型定义 ====================
interface Affix {
  type: string;
  value: number;
  description: string;
}

interface Equipment {
  id: string;
  name: string;
  quality: 'white' | 'blue' | 'purple' | 'red' | 'gold';
  affixes: Affix[];
  baseValue: number;
  totalValue: number;
  description: string;
}

interface InventoryItem {
  type: 'equipment' | 'resource';
  item: Equipment | { name: string; value: number };
}

interface PlayerState {
  id: string;
  name: string;
  money: number;
  equipmentSlots?: InventoryItem[];
  inventory: InventoryItem[];
  safeBox: InventoryItem[];
  currentRound: number;
  totalExtractValue: number;
  failStreak: number;
  winStreak: number;
  noDropStreak: number;
  isAlive: boolean;
  items?: any[];
  killCount?: number;
  redDropCount?: number;
  maxProfit?: number;
  totalGames?: number;
  firstGame?: boolean;
  successfulExtracts?: number;
  // AI 相关字段
  styleTag?: 'aggressive' | 'conservative' | 'balanced' | 'unknown';
  styleScore?: { riskTaking: number; patience: number; efficiency: number };
  recentHighlights?: string[];
  // 信任度系统
  trustLevel?: number;
  trustScore?: number;
  aiAdviceAccepted?: number;
  aiAdviceTotal?: number;
  riskStars?: number;
  // 行动分叉系统
  exposure?: number;                // 暴露度 0-10
  loadLevel?: 'light' | 'normal' | 'heavy' | 'overloaded';
}
interface AITacticalAdvice {
  advice: string;
  recommendation: {
    action: 'explore' | 'extract';
    confidence: number;
    reason: string;
  };
  personality: 'cautious' | 'encouraging' | 'analytical';
}

// AI 事件类型
interface AIEvent {
  title: string;
  description: string;
  choices: Array<{
    id: string;
    text: string;
    riskHint: string;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  eventType: 'discovery' | 'encounter' | 'trap' | 'npc' | 'ambush' | 'treasure';
  tensionLevel: 1 | 2 | 3 | 4 | 5;
}

// AI 战报类型
interface AIBattleReport {
  title: string;
  narrative: string;
  highlights: Array<{
    round: number;
    type: 'big_find' | 'close_call' | 'smart_choice' | 'red_drop';
    description: string;
  }>;
  advisorComment: string;
}

interface ShopItem {
  id: string;
  name: string;
  quality: 'blue' | 'purple';
  price: number;
  icon: string;
  description: string;
}

// ==================== 常量定义 ====================
const ZONE_INFO = {
  normal: { name: '废弃居民区', icon: '🏘️', risk: '低风险', color: 'from-slate-700 to-slate-600', deathRate: 5 },
  dangerous: { name: '军事仓库', icon: '⚠️', risk: '中风险', color: 'from-amber-900 to-amber-800', deathRate: 15 },
  boss: { name: '黑区实验室', icon: '💀', risk: '高风险', color: 'from-red-900 to-red-800', deathRate: 30 },
};

const QUALITY_SYMBOLS: Record<string, string> = {
  white: '',
  blue: '🔷',
  purple: '🟣',
  red: '🔥',
  gold: '💰',
};

const QUALITY_NAMES: Record<string, string> = {
  white: '普通',
  blue: '精良',
  purple: '稀有',
  red: '史诗',
  gold: '传说',
};

function getBuffEffectsFromSlots(player: PlayerState | null) {
  const effects = { deathRateReduction: 0, redDropBoost: 0, combatBoost: 0, extractBoost: 0 };
  if (!player || !player.equipmentSlots) return effects;
  
  for (const item of player.equipmentSlots) {
    if (item.type === 'equipment') {
      const equip = item.item as Equipment;
      for (const affix of equip.affixes) {
        if (affix.type === 'death_protection') effects.deathRateReduction = Math.min(effects.deathRateReduction + affix.value / 100, 0.5);
        if (affix.type === 'drop_rate') effects.redDropBoost = Math.min(effects.redDropBoost + affix.value / 100, 0.3);
        if (affix.type === 'extract_rate') effects.extractBoost = Math.min(effects.extractBoost + affix.value / 100, 0.5);
        if (affix.type === 'combat_rate') effects.combatBoost += affix.value / 100;
      }
    }
  }
  return effects;
}

function generateTempCodename(): string {
  const prefixes = ['新兵', '猎手', '暗影', '幽灵', '猎鹰', '战狼', '铁骑', '暴风'];
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${Math.floor(Math.random() * 9000) + 1000}`;
}

// ==================== 主组件 ====================
export default function GamePage() {
  // 认证状态
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 游戏状态
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [lastResult, setLastResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentZone, setCurrentZone] = useState<string>('待命中');
  const [gameSessionId, setGameSessionId] = useState<string | null>(null);
  const [eventsCount, setEventsCount] = useState(0);
  
  // UI状态
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // 邮箱验证码登录状态
  const [loginEmail, setLoginEmail] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [loginMode, setLoginMode] = useState<'nickname' | 'email'>('nickname');
  
  const [showShop, setShowShop] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [showStorage, setShowStorage] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [showMembership, setShowMembership] = useState(false);
  const [membershipInfo, setMembershipInfo] = useState<any>(null);
  const [subscriptionTiers, setSubscriptionTiers] = useState<any[]>([]);
  
  // 物品选择状态
  const [pendingItem, setPendingItem] = useState<Equipment | null>(null);
  const [pendingChoices, setPendingChoices] = useState<{ id: string; label: string; description: string }[]>([]);
  const [showItemChoice, setShowItemChoice] = useState(false);
  
  // 物品操作状态
  const [itemAction, setItemAction] = useState<{ from: 'equipment' | 'backpack' | 'safebox'; index: number; itemName: string; item?: Equipment } | null>(null);
  
  // 事件选择分支状态
  const [eventChoice, setEventChoice] = useState<{
    type: string;
    context: string;
    choices: Array<{ id: string; text: string; riskHint: string; riskLevel: 'low' | 'medium' | 'high' | 'extreme'; rewardHint?: string }>;
  } | null>(null);
  
  // 信任度和风险星级
  const calculateRiskStars = () => {
    if (!player) return 1;
    const itemValue = calculateAllItemsValue();
    const baseZone = currentZone === '废弃居民区' ? 1 : currentZone === '军事仓库' ? 2 : 3;
    const round = player.currentRound || 1;
    
    // 基础风险 = 区域风险 + 携带价值风险 + 回合风险
    let risk = baseZone + (itemValue > 10000 ? 2 : itemValue > 5000 ? 1 : 0) + (round > 8 ? 1 : round > 5 ? 0 : -1);
    return Math.max(1, Math.min(5, risk));
  };
  
  const calculateTrustLevel = () => {
    if (!player) return 1;
    const trustScore = player.trustScore || 50;
    if (trustScore >= 80) return 5;
    if (trustScore >= 60) return 4;
    if (trustScore >= 40) return 3;
    if (trustScore >= 20) return 2;
    return 1;
  };
  
  // 绑定邮箱状态
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [linkingEmail, setLinkingEmail] = useState(false);
  const [emailLinked, setEmailLinked] = useState(false);
  
  // 首局引导状态
  const [showFirstGameHint, setShowFirstGameHint] = useState(false);
  const [showExtractHint, setShowExtractHint] = useState(false);
  const [showAccountBindHint, setShowAccountBindHint] = useState(false);
  
  // AI 功能状态
  const [aiAdvice, setAiAdvice] = useState<AITacticalAdvice | null>(null);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const [showAiAdvice, setShowAiAdvice] = useState(false);

  // 分享相关状态
  const [shareLoading, setShareLoading] = useState(false);
  const [shareResult, setShareResult] = useState<{ type: 'copy' | 'link'; text?: string; url?: string } | null>(null);

  // 行动选择弹窗状态
  const [showActionSelect, setShowActionSelect] = useState(false);
  const [pendingExploreZone, setPendingExploreZone] = useState<'normal' | 'dangerous' | 'boss' | null>(null);
  
  // 当前游戏事件
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [currentEventActionType, setCurrentEventActionType] = useState<'stealth' | 'search' | 'assault'>('search');
  const [eventExpanded, setEventExpanded] = useState(true); // 移动端事件区折叠状态
  
  // 战报详情弹窗状态
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  
  // 事件历史记录（用于战报）
  const [eventHistory, setEventHistory] = useState<Array<{
    round: number;
    zone: string;
    eventTitle: string;
    outcome: string;
    valueChange: number;
  }>>([]);

  // 初始化认证
  useEffect(() => {
    async function initAuth() {
      try {
        const storedToken = localStorage.getItem('delta_ops_token');
        if (storedToken) {
          setAccessToken(storedToken);
          const res = await fetch('/api/auth/init', { headers: { Authorization: `Bearer ${storedToken}` } });
          const data = await res.json();
          if (data.success && data.data.exists) {
            setUserExists(true);
            setPlayer(data.data.player);
            setBroadcasts(data.data.broadcasts || []);
            // 检查邮箱绑定状态
            if (data.data.player?.bind_email) {
              setEmailLinked(true);
              setEmail(data.data.player.bind_email);
            }
            if (data.data.player?.totalGames === 0 && data.data.player?.isAlive) setShowFirstGameHint(true);
          } else if (data.needAuth) {
            localStorage.removeItem('delta_ops_token');
            await performLogin();
          } else {
            setUserExists(false);
          }
        } else {
          await performLogin();
        }
      } catch (error) {
        console.error('Init auth error:', error);
        setAuthError('初始化失败，请刷新页面');
      } finally {
        setIsLoading(false);
      }
    }
    
    async function performLogin() {
      try {
        const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const data = await res.json();
        if (data.success && data.data.accessToken) {
          localStorage.setItem('delta_ops_token', data.data.accessToken);
          setAccessToken(data.data.accessToken);
          setUserExists(false);
        } else {
          setAuthError(data.error || '认证失败');
        }
      } catch (error) {
        console.error('Login error:', error);
        setAuthError('网络错误，请刷新页面');
      }
    }
    initAuth();
  }, []);

  const handleSetNickname = useCallback(async () => {
    if (!accessToken || !nickname.trim()) return;
    setLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ nickname: nickname.trim(), password: password.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setUserExists(true);
        setPlayer(data.data.player);
        setBroadcasts(data.data.broadcasts || []);
        setShowFirstGameHint(true);
      } else if (data.needLogin) {
        setShowLogin(true);
        setAuthError(data.error);
      } else {
        setAuthError(data.error || '设置昵称失败');
      }
    } catch (error) {
      setAuthError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [accessToken, nickname, password]);

  const handleGuestStart = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ nickname: generateTempCodename(), isGuest: true }),
      });
      const data = await res.json();
      if (data.success) {
        setUserExists(true);
        setPlayer(data.data.player);
        setBroadcasts(data.data.broadcasts || []);
        setShowFirstGameHint(true);
      } else {
        setAuthError(data.error || '开始游戏失败');
      }
    } catch (error) {
      setAuthError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const handleLogin = useCallback(async () => {
    if (!nickname.trim() || !password.trim()) return;
    setLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('delta_ops_token', data.data.accessToken);
        setAccessToken(data.data.accessToken);
        setUserExists(true);
        setPlayer(data.data.player);
        setShowLogin(false);
      } else {
        setAuthError(data.error || '登录失败');
      }
    } catch (error) {
      setAuthError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [nickname, password]);

  // 发送邮箱验证码
  const handleSendOtp = useCallback(async () => {
    if (!loginEmail.trim()) {
      setAuthError('请输入邮箱地址');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(loginEmail.trim())) {
      setAuthError('邮箱格式不正确');
      return;
    }
    
    setLoading(true);
    setAuthError('');
    
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim() }),
      });
      const data = await res.json();
      
      if (data.success) {
        setOtpSent(true);
        setOtpCountdown(60);
        // 开始倒计时
        const timer = setInterval(() => {
          setOtpCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setAuthError(data.error || '发送失败');
      }
    } catch (error) {
      setAuthError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [loginEmail]);

  // 验证码登录
  const handleOtpLogin = useCallback(async () => {
    if (!loginEmail.trim() || !loginOtp.trim()) {
      setAuthError('请输入邮箱和验证码');
      return;
    }
    
    setLoading(true);
    setAuthError('');
    
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), otp: loginOtp.trim() }),
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('delta_ops_token', data.data.accessToken);
        setAccessToken(data.data.accessToken);
        setUserExists(true);
        setPlayer(data.data.player);
        setShowLogin(false);
        setLoginEmail('');
        setLoginOtp('');
        setOtpSent(false);
        
        if (data.data.isNewUser) {
          setLastResult({ success: true, message: '🎉 欢迎新玩家！账号已创建成功' });
        }
      } else {
        setAuthError(data.error || '登录失败');
      }
    } catch (error) {
      setAuthError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [loginEmail, loginOtp]);

  // Google 登录
  const handleGoogleLogin = useCallback(async () => {
    setLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/google');
      const data = await res.json();
      if (data.success && data.data.authUrl) {
        // 跳转到 Google 授权页面
        window.location.href = data.data.authUrl;
      } else {
        setAuthError(data.error || '获取登录链接失败');
        setLoading(false);
      }
    } catch (error) {
      setAuthError('网络错误，请重试');
      setLoading(false);
    }
  }, []);

  // 处理 OAuth 回调
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userId = urlParams.get('userId');
    const auth = urlParams.get('auth');
    const name = urlParams.get('name');
    
    if (token && userId) {
      localStorage.setItem('delta_ops_token', token);
      setAccessToken(token);
      setUserExists(true);
      
      // 清理 URL 参数
      window.history.replaceState({}, '', '/');
      
      // 显示登录成功消息
      if (auth === 'registered') {
        setLastResult({ success: true, message: `🎉 欢迎新玩家 ${name || ''}！账号已创建成功` });
      } else if (auth === 'linked') {
        setLastResult({ success: true, message: '✅ Google 账号已关联到现有账号' });
      }
    }
  }, []);

  const startGame = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      // 创建游戏会话
      const sessionRes = await fetch('/api/stats/session/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const sessionData = await sessionRes.json();
      if (sessionData.success) {
        setGameSessionId(sessionData.data.sessionId);
      }
      
      const res = await fetch('/api/game/start', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        setBroadcasts(data.data.broadcasts || []);
        setLastResult(null);
        setCurrentZone('待命中');
        setEventsCount(0);
      } else {
        setLastResult({ success: false, message: data.error || '开始游戏失败' });
      }
    } catch (error) {
      console.error('Start game error:', error);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const exploreZone = useCallback(async (zone: 'normal' | 'dangerous' | 'boss', actionType: 'stealth' | 'search' | 'assault' = 'search') => {
    if (!player || !accessToken) return;
    setLoading(true);
    setShowActionSelect(false);
    setCurrentZone(ZONE_INFO[zone].name);
    setShowFirstGameHint(false);
    setShowExtractHint(false);
    setCurrentEvent(null);
    try {
      const res = await fetch('/api/game/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ zone, buffEffects: getBuffEffectsFromSlots(player), actionType }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        setBroadcasts(data.data.broadcasts || []);
        setLastResult(data.data.result);
        setEventsCount(prev => prev + 1);
        
        // 检查是否死亡
        if (data.data.player && !data.data.player.isAlive && gameSessionId) {
          await fetch('/api/stats/session/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              sessionId: gameSessionId,
              finalValue: 0,
              extracted: false,
              died: true,
              zone: ZONE_INFO[zone].name,
              eventsCount: eventsCount + 1,
            }),
          });
          setGameSessionId(null);
        }
        
        // 记录事件历史（用于战报）
        if (data.data.result.success !== undefined) {
          const valueChange = data.data.result.loot?.totalValue || 0;
          setEventHistory(prev => [...prev, {
            round: data.data.player.currentRound,
            zone: ZONE_INFO[zone].name,
            eventTitle: data.data.result.loot 
              ? `发现${QUALITY_NAMES[data.data.result.loot.quality] || '普通'}装备`
              : data.data.result.success ? '安全搜索' : '遭遇危险',
            outcome: data.data.result.success ? '成功' : '失败',
            valueChange: data.data.result.success ? valueChange : -Math.floor(valueChange * 0.3),
          }]);
        }
        
        // 检查是否触发事件
        if (data.data.result.triggerEvent && data.data.result.event) {
          setCurrentEvent(data.data.result.event);
          setCurrentEventActionType(data.data.result.eventActionType || 'search');
          setShowActionSelect(true);
          return; // 不关闭加载状态，等待事件选择
        }
        
        if (data.data.result.loot && player?.totalGames === 0) setShowExtractHint(true);
        if (data.data.result.needChoice && data.data.result.pendingItem) {
          setPendingItem(data.data.result.pendingItem);
          setPendingChoices(data.data.result.choices || []);
          setShowItemChoice(true);
        }
      } else {
        setLastResult({ success: false, message: data.error || '探索失败' });
      }
    } catch (error) {
      console.error('Explore error:', error);
    } finally {
      setLoading(false);
    }
  }, [player, accessToken, gameSessionId, eventsCount]);

  // 原地搜索（留在当前区域再次搜索）
  const stayAndSearch = useCallback(async () => {
    if (!player || !accessToken) return;
    
    // 确定当前区域类型
    let zone: 'normal' | 'dangerous' | 'boss' = 'normal';
    if (currentZone === '军事仓库') zone = 'dangerous';
    if (currentZone === '黑区实验室') zone = 'boss';
    
    setLoading(true);
    setCurrentEvent(null);
    try {
      const res = await fetch('/api/game/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ zone, buffEffects: getBuffEffectsFromSlots(player), actionType: 'search', isStaySearch: true }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        setBroadcasts(data.data.broadcasts || []);
        setLastResult(data.data.result);
        
        // 检查是否触发事件
        if (data.data.result.triggerEvent && data.data.result.event) {
          setCurrentEvent(data.data.result.event);
          setCurrentEventActionType(data.data.result.eventActionType || 'search');
          setShowActionSelect(true);
          return;
        }
        
        // 处理物品选择
        if (data.data.result.needChoice && data.data.result.pendingItem) {
          setPendingItem(data.data.result.pendingItem);
          setPendingChoices(data.data.result.choices || []);
          setShowItemChoice(true);
        }
      } else {
        setLastResult({ success: false, message: data.error || '探索失败' });
      }
    } catch (error) {
      console.error('Stay search error:', error);
    } finally {
      setLoading(false);
    }
  }, [player, accessToken, currentZone]);

  // 处理事件选择（新版）
  const handleEventChoice = useCallback(async (optionId: string) => {
    if (!player || !accessToken || !currentEvent) return;
    
    setLoading(true);
    setShowActionSelect(false);
    try {
      const res = await fetch('/api/game/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          zone: pendingExploreZone || 'normal',
          buffEffects: getBuffEffectsFromSlots(player),
          actionType: currentEventActionType,
          eventChoice: { eventId: currentEvent.id, optionId },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        setBroadcasts(data.data.broadcasts || []);
        setLastResult(data.data.result);
        setCurrentEvent(null);
      } else {
        setLastResult({ success: false, message: data.error || '选择失败' });
      }
    } catch (error) {
      console.error('Event choice error:', error);
    } finally {
      setLoading(false);
    }
  }, [player, accessToken, currentEvent, currentEventActionType, pendingExploreZone]);

  const extract = useCallback(async () => {
    if (!player || !accessToken) return;
    setLoading(true);
    setShowExtractHint(false);
    try {
      const res = await fetch('/api/game/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ buffEffects: getBuffEffectsFromSlots(player) }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        setLastResult(data.data.result);
        setCurrentZone('撤离点');
        if (data.data.result.success && player?.successfulExtracts === 0) setShowAccountBindHint(true);
        if (data.data.leaderboard) setLeaderboard(data.data.leaderboard);
        
        // 结束游戏会话
        if (gameSessionId) {
          await fetch('/api/stats/session/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              sessionId: gameSessionId,
              finalValue: data.data.result.totalValue || 0,
              extracted: data.data.result.success,
              died: false,
              zone: currentZone,
              eventsCount,
            }),
          });
          setGameSessionId(null);
        }
      } else {
        setLastResult({ success: false, message: data.error || '撤离失败' });
      }
    } catch (error) {
      console.error('Extract error:', error);
    } finally {
      setLoading(false);
    }
  }, [player, accessToken, gameSessionId, currentZone, eventsCount]);

  // AI 战术建议
  const getAIAdvice = useCallback(async () => {
    if (!player || !accessToken) return;
    setAiAdviceLoading(true);
    try {
      const buffs = getBuffEffectsFromSlots(player);
      const carryValue = calculateAllItemsValue();
      
      const res = await fetch('/api/ai/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          zone: currentZone === '待命中' ? 'normal' : currentZone === '废弃居民区' ? 'normal' : currentZone === '军事仓库' ? 'dangerous' : 'boss',
          zoneName: currentZone,
          carryValue,
          round: player.currentRound,
          buffs,
        }),
      });
      const data = await res.json();
      if (data.success && data.data.advice) {
        setAiAdvice(data.data.advice);
        setShowAiAdvice(true);
      }
    } catch (error) {
      console.error('AI advice error:', error);
    } finally {
      setAiAdviceLoading(false);
    }
  }, [player, accessToken, currentZone]);

  // 打开战报详情弹窗
  const openReportModal = useCallback(() => {
    if (!player || !lastResult) return;
    
    // 准备战报数据
    const reportData = {
      success: lastResult.success,
      finalValue: lastResult.totalValue || lastResult.currentAllValue || 0,
      totalRounds: player.currentRound || 1,
      zonesExplored: [...new Set(eventHistory.map(e => e.zone))],
      events: eventHistory,
      aiReport: lastResult.aiReport,
      playerStyle: player.styleTag || 'unknown',
      playerName: player.name,
      exposure: player.exposure,
      maxExposure: MAX_EXPOSURE,
      deathCause: lastResult.deathResult ? '撤离失败' : undefined,
    };
    
    setReportData(reportData);
    setShowReportModal(true);
  }, [player, lastResult, eventHistory]);

  // 分享战报
  const handleShareReport = useCallback(async () => {
    if (!player || !lastResult?.aiReport) return;
    
    setShareLoading(true);
    setShareResult(null);
    
    try {
      // 生成战报文本并复制到剪贴板
      const reportText = formatReportText(lastResult.aiReport, player, lastResult.success);
      await navigator.clipboard.writeText(reportText);
      setShareResult({ type: 'copy', text: '战报已复制到剪贴板' });
      
      // 埋点：记录分享
      await logShare({
        playerId: player.id,
        playerName: player.name,
        shareResult: 'success',
        finalValue: lastResult.totalValue || lastResult.currentAllValue || 0,
        playerStyle: player.styleTag,
      });
      
      // 3秒后自动隐藏提示
      setTimeout(() => setShareResult(null), 3000);
    } catch (error) {
      console.error('Share error:', error);
      // 埋点：记录失败
      await logShare({
        playerId: player.id,
        playerName: player.name,
        shareResult: 'fail',
        finalValue: 0,
        playerStyle: player.styleTag,
      });
    } finally {
      setShareLoading(false);
    }
  }, [player, lastResult]);

  // 格式化战报文本
  const formatReportText = (aiReport: any, player: PlayerState, success: boolean): string => {
    const styleEmoji = player.styleTag === 'aggressive' ? '🔥' : player.styleTag === 'conservative' ? '🛡️' : '⚖️';
    const styleText = player.styleTag === 'aggressive' ? '激进型' : player.styleTag === 'conservative' ? '保守型' : player.styleTag === 'balanced' ? '均衡型' : '待评估';
    const GAME_URL = 'https://delta-game.coze.site';
    
    let text = `📊 【三角洲行动 | AI 战报】\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👤 玩家: ${player.name} ${styleEmoji} ${styleText}\n`;
    text += `🎯 结果: ${success ? '✅ 成功撤离' : '❌ 任务失败'}\n`;
    text += `💰 收益: ${(lastResult?.totalValue || lastResult?.currentAllValue || 0).toLocaleString()}\n`;
    text += `🧠 AI 已记住你的风格\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📖 ${aiReport.title}\n\n`;
    text += `${aiReport.narrative}\n\n`;
    
    if (aiReport.highlights?.length > 0) {
      text += `✨ 高光时刻:\n`;
      aiReport.highlights.forEach((h: any) => {
        text += `  • 回合${h.round}: ${h.description}\n`;
      });
      text += `\n`;
    }
    
    if (aiReport.advisorComment) {
      text += `💬 AI 参谋评价: ${aiReport.advisorComment}\n`;
    }
    
    text += `\n━━━━━━━━━━━━━━━\n`;
    text += `🧠 三角洲行动 | AI 战术模拟\n`;
    text += `你的专属 AI 撤离指挥官\n`;
    text += `🔗 ${GAME_URL}\n`;
    return text;
  };

  const handleItemChoice = useCallback(async (action: 'equip_replace' | 'backpack_replace' | 'safebox_replace' | 'discard', replaceIndex?: number) => {
    if (!accessToken || !pendingItem) return;
    setLoading(true);
    try {
      const res = await fetch('/api/game/item-choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action, replaceIndex, item: pendingItem }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        setLastResult((prev: any) => ({ ...prev, message: (prev?.message || '') + '\n\n' + data.data.message, needChoice: false }));
        setShowItemChoice(false);
        setPendingItem(null);
        setPendingChoices([]);
      } else {
        setLastResult({ success: false, message: data.error || '选择失败' });
      }
    } catch (error) {
      console.error('Item choice error:', error);
    } finally {
      setLoading(false);
    }
  }, [accessToken, pendingItem]);

  const handleDiscard = useCallback(async () => {
    if (!accessToken || !itemAction) return;
    setLoading(true);
    try {
      const res = await fetch('/api/game/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ from: itemAction.from, index: itemAction.index }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        setLastResult((prev: any) => ({ ...prev, message: data.data.message }));
      } else {
        setLastResult({ success: false, message: data.error || '丢弃失败' });
      }
    } catch (error) {
      console.error('Discard error:', error);
    } finally {
      setLoading(false);
      setItemAction(null);
    }
  }, [accessToken, itemAction]);

  const handleMove = useCallback(async (to: 'equipment' | 'backpack' | 'safebox') => {
    if (!accessToken || !itemAction) return;
    setLoading(true);
    try {
      const res = await fetch('/api/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ from: itemAction.from, fromIndex: itemAction.index, to }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        setLastResult((prev: any) => ({ ...prev, message: data.data.message }));
      } else {
        setLastResult({ success: false, message: data.error || '移动失败' });
      }
    } catch (error) {
      console.error('Move error:', error);
    } finally {
      setLoading(false);
      setItemAction(null);
    }
  }, [accessToken, itemAction]);

  const resetGame = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    
    // 结束游戏会话（如果是死亡）
    if (gameSessionId && player && !player.isAlive) {
      await fetch('/api/stats/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          sessionId: gameSessionId,
          finalValue: 0,
          extracted: false,
          died: true,
          zone: currentZone,
          eventsCount,
        }),
      });
      setGameSessionId(null);
    }
    
    try {
      const res = await fetch('/api/game/reset', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        setLastResult(null);
        setCurrentZone('待命中');
        setEventsCount(0);
      }
    } catch (error) {
      console.error('Reset error:', error);
    } finally {
      setLoading(false);
    }
  }, [accessToken, gameSessionId, player, currentZone, eventsCount]);

  // 绑定邮箱
  const handleLinkEmail = useCallback(async () => {
    if (!accessToken || !email.trim() || !emailPassword.trim()) return;
    setLinkingEmail(true);
    try {
      const res = await fetch('/api/auth/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ email: email.trim(), password: emailPassword.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailLinked(true);
        setEmail(data.data.email);
        setShowAccountBindHint(false);
        setLastResult({ success: true, message: `【账号升级成功】\n📧 ${data.data.message}\n\n现在可以使用邮箱登录，游戏数据将永久保存！` });
        setShowSettings(false);
        setEmailPassword('');
      } else {
        setLastResult({ success: false, message: `【绑定失败】\n${data.error}` });
      }
    } catch (error) {
      setLastResult({ success: false, message: '【绑定失败】\n网络错误，请重试' });
    } finally {
      setLinkingEmail(false);
    }
  }, [accessToken, email, emailPassword]);
  

  useEffect(() => {
    if (showShop) {
      fetch('/api/shop/purchase').then(res => res.json()).then(data => { if (data.success) setShopItems(data.data.items); });
    }
  }, [showShop]);

  const purchaseItem = useCallback(async (itemId: string, choice?: string, replaceIndex?: number) => {
    if (!accessToken || !player) return;
    setLoading(true);
    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ itemId, choice, replaceIndex }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        if (data.data.needChoice) {
          setPendingItem(data.data.pendingItem);
          setPendingChoices(data.data.choices || []);
          setShowItemChoice(true);
        } else {
          setLastResult({ success: true, message: `【购买成功】\n${data.data.message}` });
          setShowShop(false);
        }
      } else {
        setLastResult({ success: false, message: `【购买失败】\n${data.error}` });
      }
    } catch (error) {
      console.error('Purchase error:', error);
    } finally {
      setLoading(false);
    }
  }, [accessToken, player]);

  useEffect(() => {
    if (showLeaderboard) {
      fetch('/api/game/leaderboard').then(res => res.json()).then(data => { if (data.success) setLeaderboard(data.data.rankings || []); });
    }
    if (showAchievements && accessToken) {
      fetch('/api/achievements', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(res => res.json()).then(data => { if (data.success) setAchievements(data.data || []); });
    }
    if (showChallenges && accessToken) {
      fetch('/api/challenges', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(res => res.json()).then(data => { if (data.success) setChallenges(data.data || []); });
    }
    if (showMembership) {
      fetch('/api/subscription?tiers=true').then(res => res.json()).then(data => { if (data.success) setSubscriptionTiers(data.data || []); });
      if (accessToken) {
        fetch('/api/subscription?type=benefits', { headers: { Authorization: `Bearer ${accessToken}` } })
          .then(res => res.json()).then(data => { if (data.success) setMembershipInfo(data.data); });
      }
    }
  }, [showLeaderboard, showAchievements, showChallenges, showMembership, accessToken]);

  const calculateAllItemsValue = () => {
    if (!player) return 0;
    let total = 0;
    (player.equipmentSlots || []).forEach(item => { if (item.type === 'equipment') total += (item.item as Equipment).totalValue; });
    player.inventory.forEach(item => { if (item.type === 'equipment') total += (item.item as Equipment).totalValue; });
    return total;
  };

  const getQualityClass = (quality: string) => ({ white: 'text-gray-300', blue: 'text-blue-400', purple: 'text-purple-400', red: 'text-red-400 font-bold', gold: 'text-yellow-400 font-bold' }[quality] || 'text-gray-300');
  const getQualityBorderClass = (quality: string) => ({ white: 'border-gray-500', blue: 'border-blue-500', purple: 'border-purple-500', red: 'border-red-500', gold: 'border-yellow-500' }[quality] || 'border-gray-500');

  const getTacticalAdvice = () => {
    if (!player || !player.isAlive) return null;
    
    // 如果有 AI 建议，优先显示
    if (aiAdvice) {
      const color = aiAdvice.recommendation.action === 'extract' ? 'text-orange-400' : 'text-green-400';
      const bg = aiAdvice.recommendation.action === 'extract' ? 'bg-orange-900/20' : 'bg-green-900/20';
      return { message: aiAdvice.advice, color, bg };
    }
    
    // 默认规则建议
    const itemValue = calculateAllItemsValue();
    const styleTag = player.styleTag || 'unknown';
    const riskStars = calculateRiskStars();
    
    // 撤退阈值提醒
    const extractThreshold = 5000;
    const highValueThreshold = 10000;
    
    // 根据玩家风格调整建议
    if (styleTag === 'aggressive') {
      if (itemValue < 5000) return { message: '🔥 激进风格：继续深入高风险区追求大红！', color: 'text-red-400', bg: 'bg-red-900/20' };
      if (itemValue < 10000) return { message: '🔥 高价值在手！可以再博一把或稳妥撤离', color: 'text-orange-400', bg: 'bg-orange-900/20' };
      return { message: '💀 极高价值！你的风格喜欢冒险，但这次建议撤离！', color: 'text-red-400', bg: 'bg-red-900/20' };
    }
    
    if (styleTag === 'conservative') {
      if (itemValue < 2000) return { message: '🛡️ 稳健风格：低风险区积累，适时撤离', color: 'text-green-400', bg: 'bg-green-900/20' };
      if (itemValue < 5000) return { message: '🛡️ 收益不错，建议考虑落袋为安', color: 'text-yellow-400', bg: 'bg-yellow-900/20' };
      return { message: '🛡️ 高价值！稳健风格建议立即撤离变现', color: 'text-orange-400', bg: 'bg-orange-900/20' };
    }
    
    // 默认（均衡或未知风格）
    if (itemValue === 0 && player.currentRound === 1) return { message: '🎯 首要目标：探索低风险区获取物资', color: 'text-blue-400', bg: 'bg-blue-900/20' };
    if (itemValue < 2000) return { message: '✅ 当前风险可控，可继续探索或稳妥撤离', color: 'text-green-400', bg: 'bg-green-900/20' };
    if (itemValue < 5000) return { message: '⚠️ 携带价值较高，建议考虑撤离变现', color: 'text-yellow-400', bg: 'bg-yellow-900/20' };
    if (itemValue < 10000) {
      // 撤退阈值提醒
      if (riskStars >= 4) {
        return { message: `🔥 高风险(${riskStars}星)高价值！贪婪可能导致全损，强烈建议立即撤离！`, color: 'text-red-400', bg: 'bg-red-900/20' };
      }
      return { message: '🔥 高价值目标！贪婪可能导致全损，强烈建议撤离', color: 'text-orange-400', bg: 'bg-orange-900/20' };
    }
    return { message: '💀 极高价值！一次失败将损失惨重，立即撤离！', color: 'text-red-400', bg: 'bg-red-900/20' };
  };
  
  // 获取风格标签显示
  const getStyleTagDisplay = () => {
    if (!player?.styleTag) return null;
    const config: Record<string, { icon: string; label: string; color: string }> = {
      aggressive: { icon: '🔥', label: '激进型', color: 'text-red-400' },
      conservative: { icon: '🛡️', label: '保守型', color: 'text-blue-400' },
      balanced: { icon: '⚖️', label: '均衡型', color: 'text-yellow-400' },
      unknown: { icon: '❓', label: '待评估', color: 'text-gray-400' },
    };
    return config[player.styleTag] || config.unknown;
  };

  // ==================== 渲染 ====================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050a10] flex flex-col items-center justify-center p-4">
        <div className="text-4xl mb-4 animate-pulse">⚔️</div>
        <div className="text-[#5a7a9a] text-sm">正在连接战区...</div>
      </div>
    );
  }

  // 首屏落地页
  if (accessToken && userExists === false && !showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1520] via-[#050a10] to-[#0a1018] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-lg text-center">
            <div className="mb-8">
              <div className="text-5xl sm:text-6xl mb-4 animate-pulse">🧠</div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#c8d8e8] tracking-wider mb-2">你的 AI 战术指挥官</h1>
              <div className="text-sm sm:text-base text-[#5a7a9a] tracking-widest">每一次决策，AI 帮你分析利弊</div>
            </div>
            
            {/* AI 卖点卡片 - 强化版 */}
            <div className="mb-6 space-y-3">
              <div className="p-4 bg-[#0a1520]/80 border border-[#1a2a3a] text-left">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🧠</span>
                  <div>
                    <div className="text-sm font-bold text-[#a8d8ff] mb-2">AI 决策参谋</div>
                    <div className="text-xs text-[#5a7a9a] leading-relaxed">
                      每次行动前，AI 实时分析：当前价值多少？风险星级几颗？现在去还是再等等？
                      <div className="mt-2 text-cyan-400">「AI 说该撤了，你敢不敢听？」</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-[#0a1520]/80 border border-[#1a2a3a] text-left">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <div className="text-sm font-bold text-[#a8d8ff] mb-2">事件由你选</div>
                    <div className="text-xs text-[#5a7a9a] leading-relaxed">
                      不是随机结果，是 AI 生成的选择：交易、打还是跑？每局不同，每次都是你的决策。
                      <div className="mt-2 text-yellow-400">「不是游戏，是你的专属剧本」</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-[#0a1520]/80 border border-[#1a2a3a] text-left">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <div className="text-sm font-bold text-[#a8d8ff] mb-2">你的风格，AI 会记住</div>
                    <div className="text-xs text-[#5a7a9a] leading-relaxed">
                      激进型？保守型？采纳 AI 建议的正确率？玩得越多，AI 越懂你。
                      <div className="mt-2 text-purple-400">「你的专属 AI 战术档案」</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6 p-3 bg-[#0a1520]/60 border border-[#1a2a3a]">
              <p className="text-[#8ab8d8] text-sm leading-relaxed">
                选区域前，<span className="text-cyan-400">AI 给你风险评估</span>。
                <br />探索中，<span className="text-yellow-400">遭遇事件由你选择</span>。
                <br />游戏后，<span className="text-purple-400">AI 生成你的专属战报</span>。
              </p>
            </div>
            
            <button onClick={handleGuestStart} disabled={loading} className="w-full py-4 sm:py-5 mb-4 bg-gradient-to-r from-[#1a3a5a] to-[#2a5a7a] hover:from-[#2a5a7a] hover:to-[#3a7a9a] border-2 border-[#4a8aba] text-[#a8d8f8] font-bold text-lg sm:text-xl tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30">
              {loading ? '连接 AI 参谋...' : '🚀 让 AI 参谋接管我的撤离'}
            </button>
            
            <button onClick={() => setShowLogin(true)} className="w-full py-3 mb-6 bg-[#1a2a3a]/50 hover:bg-[#2a3a4a] border border-[#3a4a5a] text-[#8ab8d8] text-sm tracking-wider transition-colors">
              📋 查看 AI 战报示例
            </button>
            
            <div className="text-xs text-[#5a7a9a] mb-6">💡 AI 已准备好为你服务，首次进入生成战术档案</div>
            
            {broadcasts.length > 0 && (
              <div className="p-3 bg-[#1a2a3a]/30 border border-[#2a3a4a] animate-pulse">
                <div className="text-xs text-yellow-400 mb-1">📢 战区动态</div>
                <div className="text-sm text-[#8ab8d8] truncate">{broadcasts[0]?.message}</div>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t border-[#1a2a3a] bg-[#0a1018]/80">
          <div className="max-w-lg mx-auto">
            <div className="text-center text-xs text-[#5a7a9a] mb-3">🎯 风险区域</div>
            <div className="grid grid-cols-3 gap-4 text-center text-xs">
              <div><div className="text-green-400 text-lg mb-1">🏘️</div><div className="text-[#5a7a9a]">废弃居民区</div><div className="text-[#8ab8d8]">情报站 · 低风险</div></div>
              <div><div className="text-amber-400 text-lg mb-1">⚠️</div><div className="text-[#5a7a9a]">军事仓库</div><div className="text-[#8ab8d8]">战术区 · 中风险</div></div>
              <div><div className="text-red-400 text-lg mb-1">💀</div><div className="text-[#5a7a9a]">黑区实验室</div><div className="text-[#8ab8d8]">禁区 · 高风险</div></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 登录界面
  if (showLogin) {
    return (
      <div className="min-h-screen bg-[#050a10] flex items-center justify-center p-4">
        <div className="w-full max-w-md border border-[#1a2a3a] bg-[#0a1018]/95 backdrop-blur-sm">
          <div className="border-b border-[#1a2a3a] p-4 sm:p-6 text-center">
            <div className="text-4xl sm:text-5xl mb-3">🔑</div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#c8d8e8] tracking-wider">账号登录</h1>
          </div>
          
          {/* 登录方式切换 */}
          <div className="flex border-b border-[#1a2a3a]">
            <button 
              onClick={() => { setLoginMode('nickname'); setAuthError(''); }}
              className={`flex-1 py-2 text-sm ${loginMode === 'nickname' ? 'text-[#8ab8d8] border-b-2 border-[#4a8aba]' : 'text-[#5a6a7a]'}`}
            >
              昵称+密码
            </button>
            <button 
              onClick={() => { setLoginMode('email'); setAuthError(''); }}
              className={`flex-1 py-2 text-sm ${loginMode === 'email' ? 'text-[#8ab8d8] border-b-2 border-[#4a8aba]' : 'text-[#5a6a7a]'}`}
            >
              邮箱验证码
            </button>
          </div>
          
          <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            {/* 昵称+密码登录 */}
            {loginMode === 'nickname' && (
              <>
                <input type="text" placeholder="输入昵称..." value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full px-4 py-3 bg-[#050a10] border border-[#2a3a4a] text-[#c8d8e8] placeholder-[#3a4a5a] focus:outline-none focus:border-[#4a6a8a]" />
                <input type="password" placeholder="输入密码..." value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full px-4 py-3 bg-[#050a10] border border-[#2a3a4a] text-[#c8d8e8] placeholder-[#3a4a5a] focus:outline-none focus:border-[#4a6a8a]" />
                {authError && <div className="text-red-400 text-xs text-center py-2">{authError}</div>}
                <button onClick={handleLogin} disabled={!nickname.trim() || !password.trim() || loading} className="w-full py-3 bg-[#1a3050] hover:bg-[#2a4060] border border-[#3a5a7a] text-[#8ab8d8] font-bold tracking-wider disabled:opacity-50 transition-colors">{loading ? '登录中...' : '登录'}</button>
              </>
            )}
            
            {/* 邮箱验证码登录 */}
            {loginMode === 'email' && (
              <>
                <div className="flex gap-2">
                  <input 
                    type="email" 
                    placeholder="输入邮箱地址..." 
                    value={loginEmail} 
                    onChange={(e) => setLoginEmail(e.target.value)} 
                    className="flex-1 px-4 py-3 bg-[#050a10] border border-[#2a3a4a] text-[#c8d8e8] placeholder-[#3a4a5a] focus:outline-none focus:border-[#4a6a8a]" 
                  />
                  <button 
                    onClick={handleSendOtp} 
                    disabled={!loginEmail.trim() || otpCountdown > 0 || loading} 
                    className="px-4 py-3 bg-[#2a4a6a] hover:bg-[#3a5a7a] border border-[#4a6a8a] text-[#8ab8d8] text-sm whitespace-nowrap disabled:opacity-50 transition-colors"
                  >
                    {otpCountdown > 0 ? `${otpCountdown}s` : '获取验证码'}
                  </button>
                </div>
                <input 
                  type="text" 
                  placeholder="输入验证码..." 
                  value={loginOtp} 
                  onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                  onKeyDown={(e) => e.key === 'Enter' && handleOtpLogin()}
                  className="w-full px-4 py-3 bg-[#050a10] border border-[#2a3a4a] text-[#c8d8e8] placeholder-[#3a4a5a] focus:outline-none focus:border-[#4a6a8a] tracking-widest text-center text-xl" 
                  maxLength={6}
                />
                {otpSent && <div className="text-green-400 text-xs text-center py-1">✓ 验证码已发送到邮箱，请查收</div>}
                {authError && <div className="text-red-400 text-xs text-center py-2">{authError}</div>}
                <button onClick={handleOtpLogin} disabled={!loginEmail.trim() || !loginOtp.trim() || loading} className="w-full py-3 bg-[#1a3050] hover:bg-[#2a4060] border border-[#3a5a7a] text-[#8ab8d8] font-bold tracking-wider disabled:opacity-50 transition-colors">{loading ? '验证中...' : '登录 / 注册'}</button>
              </>
            )}
            
            {/* 分隔线 */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-[#2a3a4a]"></div>
              <span className="text-xs text-[#5a6a7a]">或</span>
              <div className="flex-1 h-px bg-[#2a3a4a]"></div>
            </div>
            
            {/* Google 登录按钮 */}
            <button onClick={handleGoogleLogin} disabled={loading} className="w-full py-3 bg-[#fff] hover:bg-[#f0f0f0] border border-[#ddd] text-[#333] font-medium tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              使用 Google 登录
            </button>
            
            <button onClick={() => { 
              setShowLogin(false); 
              setAuthError(''); 
              setPassword(''); 
              setLoginEmail(''); 
              setLoginOtp(''); 
              setOtpSent(false);
              setOtpCountdown(0);
            }} className="w-full py-2 bg-[#2a3a4a] hover:bg-[#3a4a5a] border border-[#4a5a6a] text-[#8ab8d8] text-sm">← 返回</button>
          </div>
        </div>
      </div>
    );
  }

  // 认证失败
  if (!accessToken) {
    return (
      <div className="min-h-screen bg-[#050a10] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-400 mb-4">{authError || '认证失败'}</div>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-[#1a3050] border border-[#3a5a7a] text-[#8ab8d8]">重新连接</button>
        </div>
      </div>
    );
  }

  // 商店界面
  if (showShop) {
    return (
      <div className="min-h-screen bg-[#050a10] p-4">
        <div className="max-w-2xl mx-auto border border-[#1a2a3a] bg-[#0a1018]/95">
          <div className="border-b border-[#1a2a3a] p-4 flex items-center justify-between sticky top-0 bg-[#0a1018] z-10">
            <div><div className="text-lg font-bold text-[#c8d8e8] tracking-wider">🏪 商店</div><div className="text-sm text-yellow-400 mt-1">💰 {player?.money || 0}</div></div>
            <button onClick={() => setShowShop(false)} className="px-4 py-2 bg-[#1a2a3a] hover:bg-[#2a3a4a] text-[#8ab8d8] border border-[#3a4a5a]">返回</button>
          </div>
          <div className="divide-y divide-[#1a2a3a]">
            {shopItems.map((item, index) => (
              <div key={item.id} className="p-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm text-[#8ab8d8] mb-1">{index + 1}️⃣ {item.icon} {item.name}<span className={`text-xs ml-2 ${item.quality === 'purple' ? 'text-purple-400' : 'text-blue-400'}`}>({item.quality === 'purple' ? '稀有' : '精良'})</span></div>
                  <div className="text-xs text-green-400">{item.description}</div>
                </div>
                <div className="text-right ml-4"><div className="text-yellow-400 font-bold mb-2">{item.price}</div><button onClick={() => purchaseItem(item.id)} disabled={(player?.money || 0) < item.price || loading} className="px-3 py-1 text-xs bg-[#1a4a3a] hover:bg-[#2a5a4a] border border-[#3a6a5a] text-[#8ad8a8] disabled:opacity-50">购买</button></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 排行榜界面
  if (showLeaderboard) {
    return (
      <div className="min-h-screen bg-[#050a10] p-4">
        <div className="max-w-2xl mx-auto border border-[#1a2a3a] bg-[#0a1018]/95">
          <div className="border-b border-[#1a2a3a] p-4 flex items-center justify-between sticky top-0 bg-[#0a1018]">
            <div className="text-lg font-bold text-[#c8d8e8] tracking-wider">🏆 排行榜</div>
            <button onClick={() => setShowLeaderboard(false)} className="px-4 py-2 bg-[#1a2a3a] hover:bg-[#2a3a4a] text-[#8ab8d8] border border-[#3a4a5a]">返回</button>
          </div>
          {player && <div className="p-4 border-b border-[#1a2a3a] bg-[#1a2a4a]/20 text-sm text-[#8ab8d8]">📊 你的数据：<span className="text-yellow-400 ml-2">资产 {player.money}</span><span className="text-red-400 ml-2">开红 {player.redDropCount || 0}次</span><span className="text-purple-400 ml-2">最高 {player.maxProfit || 0}</span></div>}
          <div className="divide-y divide-[#1a2a3a]">
            {leaderboard.length > 0 ? leaderboard.map((item: any, index: number) => (
              <div key={index} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3"><span className={`w-8 text-center font-bold ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-[#5a7a9a]'}`}>{index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}`}</span><span className="text-[#c8d8e8]">{item.playerName}</span></div>
                <span className="text-yellow-400 font-bold">{item.totalValue?.toLocaleString()}</span>
              </div>
            )) : <div className="p-6 text-center text-[#5a7a9a]">暂无数据</div>}
          </div>
        </div>
      </div>
    );
  }

  // 成就界面
  if (showAchievements) {
    const completedCount = achievements.filter((a: any) => a.status === 'completed').length;
    return (
      <div className="min-h-screen bg-[#050a10] p-4">
        <div className="max-w-2xl mx-auto border border-[#1a2a3a] bg-[#0a1018]/95">
          <div className="border-b border-[#1a2a3a] p-4 flex items-center justify-between sticky top-0 bg-[#0a1018]">
            <div className="text-lg font-bold text-[#c8d8e8] tracking-wider">🏅 成就</div>
            <button onClick={() => setShowAchievements(false)} className="px-4 py-2 bg-[#1a2a3a] hover:bg-[#2a3a4a] text-[#8ab8d8] border border-[#3a4a5a]">返回</button>
          </div>
          <div className="p-4 border-b border-[#1a2a3a] bg-[#1a2a4a]/20 text-sm text-[#8ab8d8]">
            📊 进度：<span className="text-yellow-400">{completedCount}</span> / {achievements.length} 已完成
          </div>
          <div className="divide-y divide-[#1a2a3a] max-h-[calc(100vh-200px)] overflow-y-auto">
            {achievements.length > 0 ? achievements.map((item: any, index: number) => (
              <div key={index} className={`p-3 ${item.status === 'completed' ? 'bg-[#0a1a10]' : item.status === 'in_progress' ? 'bg-[#1a1a10]' : 'bg-[#0a0a0a]'}`}>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{item.icon}</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[#c8d8e8]">{item.name}</div>
                    <div className="text-xs text-[#5a7a9a]">{item.description}</div>
                    {item.status === 'in_progress' && (
                      <div className="mt-2">
                        <div className="h-2 bg-[#1a2a3a] rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, (item.currentProgress / item.targetValue) * 100)}%` }} />
                        </div>
                        <div className="text-xs text-[#5a7a9a] mt-1">{item.currentProgress} / {item.targetValue}</div>
                      </div>
                    )}
                    {item.status === 'completed' && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-green-400">✓ 已完成</span>
                        {item.rewardClaimed ? (
                          <span className="text-xs text-[#5a7a9a]">已领取奖励</span>
                        ) : (
                          <button 
                            onClick={() => {
                              if (!accessToken) return;
                              fetch('/api/achievements/claim', { 
                                method: 'POST', 
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                                body: JSON.stringify({ code: item.code })
                              }).then(res => res.json()).then(data => {
                                if (data.success) {
                                  setAchievements(prev => prev.map((a: any) => a.code === item.code ? { ...a, rewardClaimed: true } : a));
                                  if (player) setPlayer({ ...player, money: player.money + (item.reward?.coins || 0) });
                                }
                              });
                            }}
                            className="px-2 py-1 bg-[#2a4a2a] hover:bg-[#3a5a3a] border border-[#4a6a4a] text-xs text-green-400"
                          >
                            领取 {item.reward?.coins || 0} 金币
                          </button>
                        )}
                      </div>
                    )}
                    {item.status === 'locked' && (
                      <div className="text-xs text-[#3a4a5a] mt-1">🔒 未解锁</div>
                    )}
                  </div>
                </div>
              </div>
            )) : <div className="p-6 text-center text-[#5a7a9a]">加载中...</div>}
          </div>
        </div>
      </div>
    );
  }

  // 每日挑战界面
  if (showChallenges) {
    const completedCount = challenges.filter((c: any) => c.status === 'completed').length;
    return (
      <div className="min-h-screen bg-[#050a10] p-4">
        <div className="max-w-2xl mx-auto border border-[#1a2a3a] bg-[#0a1018]/95">
          <div className="border-b border-[#1a2a3a] p-4 flex items-center justify-between sticky top-0 bg-[#0a1018]">
            <div className="text-lg font-bold text-[#c8d8e8] tracking-wider">🎯 每日挑战</div>
            <button onClick={() => setShowChallenges(false)} className="px-4 py-2 bg-[#1a2a3a] hover:bg-[#2a3a4a] text-[#8ab8d8] border border-[#3a4a5a]">返回</button>
          </div>
          <div className="p-4 border-b border-[#1a2a3a] bg-[#1a2a4a]/20 text-sm text-[#8ab8d8]">
            📅 今日：{new Date().toLocaleDateString('zh-CN')} | 进度：<span className="text-yellow-400">{completedCount}</span> / {challenges.length} 已完成
          </div>
          <div className="divide-y divide-[#1a2a3a] max-h-[calc(100vh-200px)] overflow-y-auto">
            {challenges.length > 0 ? challenges.map((item: any, index: number) => {
              const difficultyColors = { easy: 'text-green-400', normal: 'text-yellow-400', hard: 'text-orange-400', extreme: 'text-red-400' };
              return (
                <div key={index} className={`p-3 ${item.status === 'completed' ? 'bg-[#0a1a10]' : 'bg-[#0a0a0a]'}`}>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{item.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#c8d8e8]">{item.name}</span>
                        <span className={`text-xs ${difficultyColors[item.difficulty as keyof typeof difficultyColors] || 'text-gray-400'}`}>
                          [{item.difficulty?.toUpperCase()}]
                        </span>
                      </div>
                      <div className="text-xs text-[#5a7a9a]">{item.description}</div>
                      {item.status === 'active' && (
                        <div className="mt-2">
                          <div className="h-2 bg-[#1a2a3a] rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, (item.currentProgress / item.targetValue) * 100)}%` }} />
                          </div>
                          <div className="text-xs text-[#5a7a9a] mt-1">{item.currentProgress} / {item.targetValue}</div>
                        </div>
                      )}
                      {item.status === 'completed' && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-green-400">✓ 已完成</span>
                          {item.rewardClaimed ? (
                            <span className="text-xs text-[#5a7a9a]">已领取奖励</span>
                          ) : (
                            <button 
                              onClick={() => {
                                if (!accessToken) return;
                                fetch('/api/challenges', { 
                                  method: 'POST', 
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                                  body: JSON.stringify({ code: item.code })
                                }).then(res => res.json()).then(data => {
                                  if (data.success) {
                                    setChallenges(prev => prev.map((c: any) => c.code === item.code ? { ...c, rewardClaimed: true } : c));
                                    if (player) setPlayer({ ...player, money: player.money + (item.reward?.coins || 0) });
                                  }
                                });
                              }}
                              className="px-2 py-1 bg-[#2a4a2a] hover:bg-[#3a5a3a] border border-[#4a6a4a] text-xs text-green-400"
                            >
                              领取 {item.reward?.coins || 0} 金币
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }) : <div className="p-6 text-center text-[#5a7a9a]">加载中...</div>}
          </div>
        </div>
      </div>
    );
  }

  // 会员界面
  if (showMembership) {
    const currentTier = membershipInfo?.tierCode || 'free';
    return (
      <div className="min-h-screen bg-[#050a10] p-4">
        <div className="max-w-2xl mx-auto border border-[#1a2a3a] bg-[#0a1018]/95">
          <div className="border-b border-[#1a2a3a] p-4 flex items-center justify-between sticky top-0 bg-[#0a1018]">
            <div className="text-lg font-bold text-[#c8d8e8] tracking-wider">👑 会员中心</div>
            <button onClick={() => setShowMembership(false)} className="px-4 py-2 bg-[#1a2a3a] hover:bg-[#2a3a4a] text-[#8ab8d8] border border-[#3a4a5a]">返回</button>
          </div>
          
          {/* 当前会员状态 */}
          {membershipInfo && (
            <div className="p-4 border-b border-[#1a2a3a]" style={{ background: `linear-gradient(135deg, ${membershipInfo.tierColor}20, ${membershipInfo.tierColor}05)` }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">{membershipInfo.tierIcon}</span>
                <div>
                  <div className="text-lg font-bold" style={{ color: membershipInfo.tierColor }}>{membershipInfo.tierName}</div>
                  <div className="text-xs text-[#5a7a9a]">
                    {membershipInfo.isActive ? `有效期至：${membershipInfo.expireAt ? new Date(membershipInfo.expireAt).toLocaleDateString() : '永久'}` : '未激活'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {membershipInfo.benefits?.map((b: any, i: number) => (
                  <div key={i} className="bg-[#0a1520] p-2 border border-[#2a3a4a]">
                    <div className="text-xs text-[#5a7a9a]">{b.label}</div>
                    <div className="text-sm font-bold text-[#c8d8e8]">{b.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 会员等级选择 */}
          <div className="p-4">
            <div className="text-sm font-bold text-[#8ab8d8] mb-3">选择会员等级</div>
            <div className="space-y-3">
              {subscriptionTiers.map((tier: any) => {
                const isCurrent = currentTier === tier.code;
                const features = typeof tier.features === 'string' ? JSON.parse(tier.features) : tier.features;
                return (
                  <div key={tier.code} className={`p-4 border ${isCurrent ? 'border-yellow-500 bg-yellow-500/5' : 'border-[#2a3a4a] bg-[#0a1520]'} relative`}>
                    {isCurrent && <span className="absolute -top-2 right-2 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold">当前</span>}
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{tier.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: tier.color }}>{tier.name}</span>
                          {tier.price === 0 ? (
                            <span className="text-xs text-[#5a7a9a]">免费</span>
                          ) : (
                            <span className="text-sm text-yellow-400">¥{(tier.price / 100).toFixed(0)}</span>
                          )}
                        </div>
                        <div className="text-xs text-[#5a7a9a] mt-1">{tier.description}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {features.aiAdviceLimit === -1 && <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs">AI无限</span>}
                          {features.extractProtection > 0 && <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs">撤离保护{features.extractProtection}次</span>}
                          {features.vipBadge && <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs">VIP徽章</span>}
                          {features.exclusiveEvents && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs">专属活动</span>}
                          <span className="px-2 py-0.5 bg-[#2a3a4a] text-[#8ab8d8] text-xs">仓库{features.storageSlots}</span>
                        </div>
                        {!isCurrent && tier.price > 0 && (
                          <button
                            onClick={() => {
                              if (!accessToken) {
                                alert('请先登录');
                                return;
                              }
                              // 模拟购买流程
                              fetch('/api/subscription/purchase', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                                body: JSON.stringify({ action: 'upgrade', tierCode: tier.code, durationDays: tier.duration_days || 30 })
                              }).then(res => res.json()).then(data => {
                                if (data.success) {
                                  alert(`恭喜升级为${tier.name}！`);
                                  setShowMembership(false);
                                } else {
                                  alert(data.error || '购买失败');
                                }
                              });
                            }}
                            className="mt-3 w-full py-2 font-bold text-sm"
                            style={{ backgroundColor: tier.color, color: '#000' }}
                          >
                            立即开通
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 攻略界面
  if (showGuide) {
    return (
      <div className="min-h-screen bg-[#050a10] p-2 sm:p-4">
        <div className="max-w-2xl mx-auto border border-[#1a2a3a] bg-[#0a1018]/95">
          <div className="border-b border-[#1a2a3a] p-3 sm:p-4 flex items-center justify-between sticky top-0 bg-[#0a1018]">
            <div className="text-base sm:text-lg font-bold text-[#c8d8e8] tracking-wider">📖 新手攻略</div>
            <button onClick={() => setShowGuide(false)} className="px-3 sm:px-4 py-2 bg-[#1a2a3a] hover:bg-[#2a3a4a] text-[#8ab8d8] border border-[#3a4a5a] text-sm">返回游戏</button>
          </div>
          <div className="p-3 sm:p-4 space-y-4 text-sm text-[#a8b8c8] overflow-y-auto max-h-[calc(100vh-80px)]">
            <section><h2 className="text-base sm:text-lg font-bold text-yellow-400 mb-2">🎯 游戏目标</h2><p>探索不同风险区域，获取高价值装备，安全撤离变现，冲击排行榜！</p></section>
            <section className="border border-[#2a3a4a] p-3 bg-[#0a1520]">
              <h2 className="text-base font-bold text-[#8ab8d8] mb-2">📍 区域风险</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><span className="text-lg">🏘️</span><div><span className="text-[#c8d8e8]">废弃居民区</span><span className="text-green-400 ml-2">低风险</span><span className="text-[#5a7a9a] ml-2">死亡风险 5%</span></div></div>
                <div className="flex items-center gap-2"><span className="text-lg">⚠️</span><div><span className="text-[#c8d8e8]">军事仓库</span><span className="text-amber-400 ml-2">中风险</span><span className="text-[#5a7a9a] ml-2">死亡风险 15%</span></div></div>
                <div className="flex items-center gap-2"><span className="text-lg">💀</span><div><span className="text-[#c8d8e8]">黑区实验室</span><span className="text-red-400 ml-2">高风险</span><span className="text-[#5a7a9a] ml-2">死亡风险 30%</span></div></div>
              </div>
              <p className="text-xs text-[#5a7a9a] mt-2">💡 风险越高，开红概率越大，收益也越高！</p>
            </section>
            <section className="border border-green-900/50 p-3 bg-[#0a1a10]">
              <h2 className="text-base font-bold text-green-400 mb-2">🎮 新手建议</h2>
              <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm">
                <li>前期在<strong className="text-[#c8d8e8]">废弃居民区</strong>积累资金和装备</li>
                <li>获得<strong className="text-purple-400">紫装</strong>以上装备放入<strong className="text-green-400">装备槽</strong>生效</li>
                <li>贵重物品及时放入<strong className="text-yellow-400">保险箱</strong>保护</li>
                <li>携带价值超过 <strong className="text-yellow-400">5000</strong> 时考虑撤离</li>
              </ol>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // 设置界面
  if (showSettings) {
    return (
      <div className="min-h-screen bg-[#050a10] p-4">
        <div className="max-w-md mx-auto border border-[#1a2a3a] bg-[#0a1018]/95">
          <div className="border-b border-[#1a2a3a] p-4 flex items-center justify-between sticky top-0 bg-[#0a1018]">
            <div className="text-lg font-bold text-[#c8d8e8] tracking-wider">⚙️ 账号设置</div>
            <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-[#1a2a3a] hover:bg-[#2a3a4a] text-[#8ab8d8] border border-[#3a4a5a]">返回</button>
          </div>
          
          {/* 账号信息 */}
          <div className="p-4 border-b border-[#1a2a3a] bg-[#1a2a4a]/20">
            <div className="text-sm text-[#8ab8d8]">📋 当前账号：<span className="text-[#c8d8e8] ml-2">{player?.name}</span></div>
            <div className="text-xs text-[#5a7a9a] mt-2">
              账号类型：
              {emailLinked ? '📧 已绑定邮箱' : '🔒 匿名账号（数据仅存本地）'}
            </div>
            {emailLinked && email && (
              <div className="text-xs text-green-400 mt-1">✓ 邮箱: {email}</div>
            )}
          </div>
          
          {/* 已绑定状态 */}
          {emailLinked && (
            <div className="p-4 text-center">
              <div className="text-green-400 text-sm">✅ 账号已升级为正式账号</div>
              <div className="text-xs text-[#5a7a9a] mt-2">游戏数据已永久保存，可跨设备登录</div>
            </div>
          )}
          
          {/* 邮箱绑定 */}
          {!emailLinked && (
            <div className="p-4">
              <div className="text-sm text-[#c8d8e8] mb-3">🔐 升级为正式账号</div>
              <div className="text-xs text-[#5a7a9a] mb-4">绑定邮箱后，游戏数据将永久保存，可在其他设备登录</div>
              <div className="space-y-3">
                <input 
                  type="email" 
                  placeholder="邮箱地址..." 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full px-4 py-2 bg-[#050a10] border border-[#2a3a4a] text-[#c8d8e8] placeholder-[#3a4a5a] focus:outline-none focus:border-[#4a6a8a] text-sm" 
                />
                <input 
                  type="password" 
                  placeholder="设置密码（至少6位）..." 
                  value={emailPassword} 
                  onChange={(e) => setEmailPassword(e.target.value)} 
                  className="w-full px-4 py-2 bg-[#050a10] border border-[#2a3a4a] text-[#c8d8e8] placeholder-[#3a4a5a] focus:outline-none focus:border-[#4a6a8a] text-sm" 
                />
                <button 
                  onClick={handleLinkEmail} 
                  disabled={!email.trim() || emailPassword.length < 6 || linkingEmail} 
                  className="w-full py-2 bg-[#1a4a3a] hover:bg-[#2a5a4a] border border-[#3a6a5a] text-[#8ad8a8] font-bold tracking-wider disabled:opacity-50 transition-colors text-sm"
                >
                  {linkingEmail ? '处理中...' : '绑定邮箱'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 游戏主界面
  return (
    <div className="min-h-screen bg-[#050a10] flex flex-col">
      {/* 顶部状态栏 */}
      <div className="border-b border-[#1a2a3a] bg-[#0a1018] p-2 sm:p-3 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-sm font-bold text-[#c8d8e8]">⚔️ 三角洲行动</span>
            <a href="/game" className="px-2 py-0.5 text-xs bg-purple-900/50 text-purple-400 border border-purple-700 hover:bg-purple-900/80 transition-colors">🎮 视觉版</a>
            <span className={`px-2 py-0.5 text-xs ${player?.isAlive ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-red-900/50 text-red-400 border border-red-700'}`}>{player?.isAlive ? '存活' : '死亡'}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            <span className="text-yellow-400">💰 {player?.money.toLocaleString()}</span>
            <span className="text-[#5a7a9a] hidden sm:inline">回合 {player?.currentRound || 1}</span>
            {/* 暴露度 */}
            <span className="text-orange-400 hidden sm:inline" title="暴露度">
              ☁️ {(player as any)?.exposure || 0}/10
            </span>
            {/* 负重 */}
            <span className={`hidden sm:inline ${(player as any)?.loadLevel === 'overloaded' ? 'text-red-400' : (player as any)?.loadLevel === 'heavy' ? 'text-amber-400' : 'text-green-400'}`} title="负重等级">
              ⚖️ {(player as any)?.loadLevel === 'light' ? '轻装' : (player as any)?.loadLevel === 'heavy' ? '重装' : (player as any)?.loadLevel === 'overloaded' ? '超载' : '标准'}
            </span>
          </div>
        </div>
      </div>
      
      {/* 首局引导提示 */}
      {showFirstGameHint && player?.isAlive && (
        <div className="bg-blue-900/30 border-b border-blue-700 p-3 relative">
          <div className="text-center">
            <div className="text-sm font-bold text-blue-300 mb-1">🎯 首个目标：成功撤离 1 次</div>
            <div className="text-xs text-blue-200">前往「废弃居民区」获取物资，然后安全撤离变现</div>
          </div>
          <button onClick={() => setShowFirstGameHint(false)} className="absolute right-2 top-2 text-blue-300 hover:text-blue-100">✕</button>
        </div>
      )}
      
      {/* 撤离提示 */}
      {showExtractHint && player?.isAlive && (
        <div className="bg-yellow-900/30 border-b border-yellow-700 p-3">
          <div className="text-center">
            <div className="text-sm font-bold text-yellow-300">💡 已获得物资！</div>
            <div className="text-xs text-yellow-200">继续探索风险会上升，现在撤离更稳妥</div>
          </div>
        </div>
      )}
      
      {/* 账号绑定提示 */}
      {showAccountBindHint && (
        <div className="bg-purple-900/30 border-b border-purple-700 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-purple-300">🎉 首次撤离成功！</div>
              <div className="text-xs text-purple-200">绑定邮箱永久保存进度</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAccountBindHint(false)} className="px-3 py-1 bg-[#2a3a4a] text-[#8ab8d8] text-xs border border-[#3a4a5a]">稍后</button>
              <button onClick={() => { setShowSettings(true); setShowAccountBindHint(false); }} className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white text-xs border border-purple-500">立即绑定</button>
            </div>
          </div>
        </div>
      )}
      
      {/* 全服播报 */}
      {broadcasts.length > 0 && <div className="border-b border-[#1a2a3a] p-2 bg-[#1a2a4a]/20"><div className="text-xs text-yellow-400 animate-pulse truncate">📢 {broadcasts[0]?.message}</div></div>}
      
      {/* 主内容区 */}
      <div className="flex-1 p-2 sm:p-3 flex flex-col md:flex-row gap-2 sm:gap-3 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 order-1">
          <div className="border border-[#1a2a3a] bg-[#0a1018]/95 flex-1 flex flex-col overflow-hidden">
            
            {/* 当前状态 - 战术仪表盘 */}
            <div className="border-b border-[#1a2a3a] p-2 sm:p-3 bg-gradient-to-r from-[#050a10] to-[#0a1520]">
              {/* 主状态栏 */}
              <div className="flex items-center justify-between mb-2">
                {/* 回合数 */}
                <div className="flex items-center gap-2">
                  <span className="text-[#5a7a9a] text-xs">回合</span>
                  <span className="text-[#c8d8e8] font-bold">{player?.currentRound || 1}</span>
                </div>
                {/* 风险星级 */}
                <div className="flex items-center gap-1" title={`风险星级 ${calculateRiskStars()}/5`}>
                  <span className="text-[#5a7a9a] text-xs">风险</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(star => (
                      <span 
                        key={star} 
                        className={`text-xs ${
                          star <= calculateRiskStars() 
                            ? star >= 4 ? 'text-red-400' : star >= 3 ? 'text-orange-400' : 'text-yellow-400'
                            : 'text-[#2a3a4a]'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
                {/* 携带价值 */}
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400 font-bold text-sm">{calculateAllItemsValue().toLocaleString()}</span>
                  <span className="text-[#5a7a9a] text-xs">¥</span>
                </div>
              </div>
              
              {/* 暴露度 & 负重状态条 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 暴露度 */}
                <div className="flex items-center gap-2">
                  <span className="text-[#5a7a9a] text-xs whitespace-nowrap">暴露</span>
                  <div className="flex-1 flex items-center gap-1">
                    {/* 云朵递进 */}
                    <div className="flex gap-0.5">
                      {[...Array(10)].map((_, i) => {
                        const isFilled = i < (player?.exposure || 0);
                        const level = player?.exposure || 0;
                        return (
                          <span 
                            key={i} 
                            className={`text-xs transition-colors ${
                              isFilled 
                                ? level >= 7 ? 'text-red-400' : level >= 4 ? 'text-orange-400' : 'text-blue-400'
                                : 'text-[#2a3a4a]'
                            }`}
                          >
                            ☁️
                          </span>
                        );
                      })}
                    </div>
                    <span className={`text-xs font-bold ml-1 ${
                      (player?.exposure || 0) >= 7 ? 'text-red-400' : (player?.exposure || 0) >= 4 ? 'text-orange-400' : 'text-[#c8d8e8]'
                    }`}>
                      {player?.exposure || 0}
                    </span>
                  </div>
                </div>
                
                {/* 负重 */}
                <div className="flex items-center gap-2">
                  <span className="text-[#5a7a9a] text-xs whitespace-nowrap">负重</span>
                  <div className="flex-1 flex items-center gap-2">
                    {/* 分段条 */}
                    <div className="flex-1 h-1.5 bg-[#1a2a3a] rounded-full overflow-hidden flex">
                      <div 
                        className={`h-full transition-all ${
                          (player?.loadLevel || 'light') === 'overloaded' ? 'bg-red-500 w-full' :
                          (player?.loadLevel || 'light') === 'heavy' ? 'bg-orange-500 w-3/4' :
                          (player?.loadLevel || 'light') === 'normal' ? 'bg-yellow-500 w-1/2' :
                          'bg-green-500 w-1/4'
                        }`}
                      />
                    </div>
                    <span className={`text-xs font-bold whitespace-nowrap ${
                      (player?.loadLevel || 'light') === 'overloaded' ? 'text-red-400' :
                      (player?.loadLevel || 'light') === 'heavy' ? 'text-orange-400' :
                      (player?.loadLevel || 'light') === 'normal' ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {(player?.loadLevel || 'light') === 'overloaded' ? '超载' :
                       (player?.loadLevel || 'light') === 'heavy' ? '重载' :
                       (player?.loadLevel || 'light') === 'normal' ? '标准' : '轻装'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* 位置 & 装备槽 */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1a2a3a]">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-[#5a7a9a]">📍</span>
                  <span className="text-[#c8d8e8]">{currentZone}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-[#5a7a9a]">⚔️</span>
                    <span className="text-green-400">{player?.equipmentSlots?.length || 0}/10</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[#5a7a9a]">🎒</span>
                    <span className="text-blue-400">{player?.inventory?.length || 0}/5</span>
                  </div>
                </div>
              </div>
              
              {/* 高暴露警告 */}
              {(player?.exposure || 0) >= 7 && (
                <div className="mt-2 p-2 bg-red-900/30 border border-red-700/50 flex items-center gap-2">
                  <span className="text-red-400 animate-pulse">⚠️</span>
                  <span className="text-xs text-red-300">高暴露警告：遭遇敌人概率大幅提升</span>
                </div>
              )}
            </div>
            
            {/* AI 战术参谋区 */}
            {player?.isAlive && (
              <div className="border-b border-[#1a2a3a] p-2">
                {/* 默认状态：局势摘要 + 询问按钮 */}
                {!aiAdvice && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤖</span>
                      <div>
                        <div className="text-xs text-[#6a8aaa]">AI 战术参谋</div>
                        <div className={`text-xs ${getTacticalAdvice()?.color || 'text-[#8ab8d8]'}`}>
                          {getTacticalAdvice()?.message}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={getAIAdvice}
                      disabled={aiAdviceLoading}
                      className="px-3 py-1.5 bg-[#1a2a4a] hover:bg-[#2a3a5a] border border-[#3a4a6a] text-[#8ab8d8] text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {aiAdviceLoading ? (
                        <>🤔 分析中...</>
                      ) : (
                        <>💬 询问</>
                      )}
                    </button>
                  </div>
                )}
                
                {/* 展开状态：完整 AI 建议 */}
                {aiAdvice && (
                  <div className="space-y-2">
                    {/* 建议头部 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🤖</span>
                        <div>
                          <div className="text-xs text-[#6a8aaa]">AI 战术参谋</div>
                          <div className="text-xs text-[#c8d8e8]">
                            {aiAdvice.recommendation.action === 'extract' ? '🎯 建议撤离' : 
                             aiAdvice.recommendation.action === 'explore' ? '🔍 建议继续' : '⚠️ 谨慎行动'}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => { setAiAdvice(null); }}
                        className="px-2 py-1 text-xs text-[#5a6a7a] hover:text-[#8ab8d8] transition-colors"
                      >
                        收起
                      </button>
                    </div>
                    
                    {/* 建议内容 */}
                    <div className={`p-3 rounded-lg ${getTacticalAdvice()?.bg || 'bg-[#0a1520]'}`}>
                      {/* 结论 */}
                      <div className={`text-sm font-bold mb-2 ${getTacticalAdvice()?.color || 'text-[#8ab8d8]'}`}>
                        {aiAdvice.advice.split('\n')[0]}
                      </div>
                      
                      {/* 原因 */}
                      {aiAdvice.recommendation.reason && (
                        <div className="text-xs text-[#8ab8d8] leading-relaxed">
                          {aiAdvice.recommendation.reason}
                        </div>
                      )}
                      
                      {/* 置信度 */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-[#5a6a7a]">置信度:</span>
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-1 bg-[#1a2a3a] rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                aiAdvice.recommendation.confidence >= 70 ? 'bg-green-500' :
                                aiAdvice.recommendation.confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${aiAdvice.recommendation.confidence}%` }}
                            />
                          </div>
                          <span className={`text-xs ${
                            aiAdvice.recommendation.confidence >= 70 ? 'text-green-400' :
                            aiAdvice.recommendation.confidence >= 50 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {aiAdvice.recommendation.confidence}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 玩家风格标签 */}
                    {player?.styleTag && player.styleTag !== 'unknown' && (
                      <div className="flex items-center gap-2 text-xs text-[#5a7a9a]">
                        <span>🎯</span>
                        <span>你的风格: {getStyleTagDisplay()?.icon} {getStyleTagDisplay()?.label}</span>
                      </div>
                    )}
                    
                    {/* 再次询问按钮 */}
                    <button 
                      onClick={getAIAdvice}
                      disabled={aiAdviceLoading}
                      className="w-full py-2 bg-[#1a2a3a]/50 hover:bg-[#2a3a4a] border border-[#3a4a5a] text-[#8ab8d8] text-xs transition-colors disabled:opacity-50"
                    >
                      {aiAdviceLoading ? '🤔 重新分析中...' : '🔄 重新获取建议'}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* 本轮事件 */}
            {lastResult && (
              <div className="border-b border-[#1a2a3a] p-3 bg-[#050a10] overflow-y-auto flex-shrink-0 max-h-[40vh]">
                {/* AI 事件展示 */}
                {lastResult.aiEvent && (
                  <div className="mb-3 p-3 bg-gradient-to-r from-[#1a1a3a] to-[#1a2a3a] border border-[#3a4a6a]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">📖</span>
                      <span className="text-sm font-bold text-purple-400">AI 叙事</span>
                    </div>
                    <div className="text-sm font-bold text-[#c8d8e8] mb-1">{lastResult.aiEvent.title}</div>
                    <div className="text-xs text-[#8a9aaa] whitespace-pre-line">{lastResult.aiEvent.description}</div>
                    {/* 显示紧张度指示 */}
                    {lastResult.aiEvent.tensionLevel && (
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-xs text-[#5a6a7a]">紧张度:</span>
                        <span className={`text-xs ${lastResult.aiEvent.tensionLevel >= 4 ? 'text-red-400' : lastResult.aiEvent.tensionLevel >= 3 ? 'text-amber-400' : 'text-green-400'}`}>
                          {'⚠️'.repeat(lastResult.aiEvent.tensionLevel)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                {lastResult.isRedDrop && lastResult.redDropAnnouncement && (
                  <div className="mb-3 p-3 bg-gradient-to-r from-[#3a1828] to-[#3a2818] border border-[#6a2848] animate-pulse">
                    <div className="text-center">
                      {lastResult.redDropAnnouncement.selfMessages.map((msg: string, i: number) => (<div key={i} className="text-base font-bold text-yellow-400 mb-1">{msg}</div>))}
                      <div className="text-sm text-orange-300 mt-2">{lastResult.redDropAnnouncement.identityMessage}</div>
                    </div>
                  </div>
                )}
                <div className={`text-sm whitespace-pre-line ${lastResult.isRedDrop ? 'text-yellow-400' : lastResult.success !== false ? 'text-[#8ab8d8]' : 'text-red-400'}`}>{lastResult.message}</div>
                {lastResult.loot && (
                  <div className="mt-3 p-2 bg-[#0a1520] border border-[#2a3a4a]">
                    <div className={`text-sm font-bold ${getQualityClass(lastResult.loot.quality)}`}>{QUALITY_SYMBOLS[lastResult.loot.quality]}【{QUALITY_NAMES[lastResult.loot.quality]}·{lastResult.loot.name.replace(/^[^\s]+\s/, '')}】</div>
                    {lastResult.loot.affixes?.length > 0 && (<div className="mt-1 space-y-0.5">{lastResult.loot.affixes.map((affix: Affix, i: number) => (<div key={i} className="text-xs text-[#6aba8a]">• {affix.description}</div>))}</div>)}
                    <div className="text-xs text-yellow-400 mt-1">估值：{lastResult.loot.totalValue.toLocaleString()}</div>
                  </div>
                )}
                
                {/* AI 战报展示 */}
                {lastResult.aiReport && (
                  <div className="mt-3 p-3 bg-gradient-to-r from-[#2a1a2a] to-[#1a2a3a] border border-[#4a3a5a]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📊</span>
                        <span className="text-sm font-bold text-purple-400">AI 战报</span>
                        <span className="text-xs text-[#5a6a7a]">· 行动总结</span>
                      </div>
                      <button
                        onClick={openReportModal}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        查看详情 →
                      </button>
                    </div>
                    <div className="text-sm font-bold text-[#c8d8e8] mb-1">{lastResult.aiReport.title}</div>
                    <div className="text-xs text-[#8a9aaa] mb-2 line-clamp-3">{lastResult.aiReport.narrative}</div>
                    {lastResult.aiReport.highlights && lastResult.aiReport.highlights.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {lastResult.aiReport.highlights.slice(0, 3).map((h: any, i: number) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-[#0a1520] text-amber-400 rounded">
                            回合{h.round}
                          </span>
                        ))}
                        {lastResult.aiReport.highlights.length > 3 && (
                          <span className="text-xs text-[#5a6a7a]">+{lastResult.aiReport.highlights.length - 3}</span>
                        )}
                      </div>
                    )}
                    {/* 操作按钮 */}
                    <div className="mt-3 pt-3 border-t border-[#3a4a5a] flex gap-2">
                      <button
                        onClick={openReportModal}
                        className="flex-1 py-2 bg-[#1a2a3a] hover:bg-[#2a3a4a] border border-[#3a4a5a] text-[#8ab8d8] text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        📋 查看完整战报
                      </button>
                      <button
                        onClick={() => handleShareReport()}
                        disabled={shareLoading}
                        className="flex-1 py-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700 text-purple-300 text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                      >
                        {shareLoading ? '📤 复制中...' : '📊 分享战报'}
                      </button>
                    </div>
                    {shareResult && (
                      <div className="mt-2 p-2 bg-[#0a1520] border border-green-500/50">
                        <div className="text-xs text-green-400">✓ 战报已复制到剪贴板！</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* 物品选择弹窗 */}
            {showItemChoice && pendingItem && (
              <div className="border-b border-[#1a2a3a] p-3 bg-[#1a1a2a] flex-shrink-0">
                <div className="text-sm text-yellow-400 font-bold mb-2">📦【物品选择】</div>
                <div className="p-2 bg-[#0a1520] border border-yellow-500 mb-3">
                  <div className={`text-sm font-bold ${getQualityClass(pendingItem.quality)}`}>{QUALITY_SYMBOLS[pendingItem.quality]}【{QUALITY_NAMES[pendingItem.quality]}·{pendingItem.name.replace(/^[^\s]+\s/, '')}】</div>
                  {pendingItem.affixes?.length > 0 && (<div className="mt-1 space-y-0.5">{pendingItem.affixes.map((affix: Affix, i: number) => (<div key={i} className="text-xs text-[#6aba8a]">• {affix.description}</div>))}</div>)}
                  <div className="text-xs text-yellow-400 mt-1">估值：{pendingItem.totalValue.toLocaleString()}</div>
                </div>
                <div className="space-y-2">
                  {pendingChoices.find(c => c.id === 'equip_replace') && (
                    <div className="mb-2">
                      <div className="text-xs text-[#5a7a9a] mb-1">替换装备槽：</div>
                      <div className="grid grid-cols-5 gap-1">
                        {(player?.equipmentSlots || []).map((slot, i) => {
                          const equip = slot.type === 'equipment' ? slot.item as Equipment : null;
                          return (<button key={i} onClick={() => handleItemChoice('equip_replace', i)} disabled={loading} className={`p-1 bg-[#0a1520] border ${equip ? getQualityBorderClass(equip.quality) : 'border-[#2a3a4a]'} hover:bg-[#1a2530] text-center transition-colors`}>{equip ? (<><div className={`text-xs truncate ${getQualityClass(equip.quality)}`}>{equip.name.replace(/^[^\s]+\s/, '').slice(0, 3)}</div><div className="text-xs text-yellow-400">{equip.totalValue}</div></>) : <div className="text-xs text-[#3a4a5a]">#{i + 1}</div>}</button>);
                        })}
                      </div>
                    </div>
                  )}
                  {pendingChoices.find(c => c.id === 'safebox_replace') && <button onClick={() => handleItemChoice('safebox_replace')} disabled={loading} className="w-full py-2 bg-[#1a2a4a] hover:bg-[#2a3a5a] border border-[#3a4a6a] text-[#8ab8d8] text-sm">📦 放入保险箱</button>}
                  {pendingChoices.find(c => c.id === 'discard') && <button onClick={() => handleItemChoice('discard')} disabled={loading} className="w-full py-2 bg-[#3a2a2a] hover:bg-[#4a3a3a] border border-[#5a4a4a] text-red-400 text-sm">🗑️ 丢弃</button>}
                  <button onClick={() => { setShowItemChoice(false); setPendingItem(null); setPendingChoices([]); }} disabled={loading} className="w-full py-2 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-[#4a4a5a] text-[#8a8a9a] text-sm">取消</button>
                </div>
              </div>
            )}
            
            {/* 事件选择 - 移动端可折叠 */}
            {currentEvent && (
              <div className="border-b border-[#2a1a3a] bg-gradient-to-r from-[#1a1a2a] to-[#0a1520] flex-shrink-0">
                {/* 移动端折叠头部 */}
                <div 
                  className="md:hidden p-3 flex items-center justify-between cursor-pointer active:bg-[#1a1a2a]"
                  onClick={() => setEventExpanded(!eventExpanded)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg flex-shrink-0">
                      {currentEvent.category === 'resource' ? '📦' : 
                       currentEvent.category === 'combat' ? '⚔️' : 
                       currentEvent.category === 'trap' ? '💥' : 
                       currentEvent.category === 'encounter' ? '👤' : 
                       currentEvent.category === 'movement' ? '🚶' : '🚁'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[#e8e8f8] truncate">{currentEvent.name}</div>
                      <div className="text-xs text-purple-400">触发事件</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      currentEvent.options?.[0]?.riskLevel === 'low' ? 'bg-green-900/50 text-green-400' :
                      currentEvent.options?.[0]?.riskLevel === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>
                      {currentEvent.options?.length || 0}选项
                    </span>
                    <span className={`text-xs transition-transform duration-200 ${eventExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>
                
                {/* 桌面端头部 */}
                <div className="hidden md:flex items-center justify-between p-3 pb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {currentEvent.category === 'resource' ? '📦' : 
                       currentEvent.category === 'combat' ? '⚔️' : 
                       currentEvent.category === 'trap' ? '💥' : 
                       currentEvent.category === 'encounter' ? '👤' : 
                       currentEvent.category === 'movement' ? '🚶' : '🚁'}
                    </span>
                    <span className="text-sm font-bold text-purple-400">触发事件</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    currentEvent.category === 'resource' ? 'bg-green-900/50 text-green-400' :
                    currentEvent.category === 'combat' ? 'bg-red-900/50 text-red-400' :
                    currentEvent.category === 'trap' ? 'bg-orange-900/50 text-orange-400' :
                    currentEvent.category === 'encounter' ? 'bg-blue-900/50 text-blue-400' :
                    'bg-gray-900/50 text-gray-400'
                  }`}>
                    {currentEvent.category === 'resource' ? '📦 资源' : 
                     currentEvent.category === 'combat' ? '⚔️ 战斗' : 
                     currentEvent.category === 'trap' ? '💥 陷阱' : 
                     currentEvent.category === 'encounter' ? '👤 遭遇' : 
                     currentEvent.category === 'movement' ? '🚶 战术' : '🚁 撤离'}
                  </span>
                </div>
                
                {/* 事件内容 - 桌面端始终显示，移动端根据状态显示 */}
                <div className={`${eventExpanded ? 'block' : 'hidden'} md:block p-3 pt-0 md:pt-3`}>
                  {/* 事件标题和描述 - 桌面端 */}
                  <div className="hidden md:block">
                    <div className="text-sm font-bold text-[#e8e8f8] mb-1">{currentEvent.name}</div>
                    {/* 叙事化描述优先 */}
                    <div className="text-xs text-[#8a9aaa] mb-4 leading-relaxed whitespace-pre-line">
                      {currentEvent.narrativeDescription || currentEvent.description}
                    </div>
                  </div>
                  
                  {/* 当前状态提示 */}
                  {(player?.exposure || 0) >= 6 && (
                    <div className="mb-3 p-2 bg-red-900/20 border border-red-800/30 flex items-center gap-2">
                      <span className="text-red-400 text-sm">⚠️</span>
                      <span className="text-xs text-red-300">高暴露状态 ({player?.exposure}/10)，遭遇敌人概率大幅提升</span>
                    </div>
                  )}
                  
                  {/* 选项列表 */}
                  <div className="space-y-2">
                    {currentEvent.options.map((option: any) => {
                      const isHighRisk = option.riskLevel === 'high' || (player?.exposure || 0) >= 7;
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleEventChoice(option.id)}
                          disabled={loading}
                          className={`w-full p-3 text-left border transition-all disabled:opacity-50 rounded-lg ${
                            option.riskLevel === 'low' ? 'bg-[#0a1a0a] hover:bg-[#1a2a1a] border-green-800 hover:border-green-600' :
                            option.riskLevel === 'medium' ? 'bg-[#1a1a0a] hover:bg-[#2a2a1a] border-yellow-800 hover:border-yellow-600' :
                            isHighRisk ? 'bg-[#1a0a0a] hover:bg-[#2a1a1a] border-red-800 hover:border-red-600' :
                            'bg-[#1a1a1a] hover:bg-[#2a2a2a] border-orange-800 hover:border-orange-600'
                          }`}
                        >
                          {/* 选项主体 */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="text-sm text-[#e8e8f8] font-medium">{option.text}</div>
                              {/* 叙事化行动描述优先 */}
                              {(option.narrativeAction || option.action) && (
                                <div className="text-xs text-[#5a6a7a] mt-0.5">{option.narrativeAction || option.action}</div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {/* 成功率 */}
                              <div className={`text-sm font-bold ${
                                option.successRate >= 70 ? 'text-green-400' :
                                option.successRate >= 50 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {option.successRate}%
                              </div>
                              {/* 风险等级 */}
                              <div className={`text-xs px-1.5 py-0.5 rounded ${
                                option.riskLevel === 'low' ? 'bg-green-900/50 text-green-400' :
                                option.riskLevel === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                                'bg-red-900/50 text-red-400'
                              }`}>
                                {option.riskLevel === 'low' ? '🟢 低' : option.riskLevel === 'medium' ? '🟡 中' : '🔴 高'}
                              </div>
                            </div>
                          </div>
                          
                          {/* 后果提示 */}
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-3 text-xs">
                            {/* 暴露度变化 */}
                            <div className="flex items-center gap-1">
                              <span className="text-[#5a6a7a]">☁️</span>
                              <span className={option.exposureChange > 0 ? 'text-red-400' : option.exposureChange < 0 ? 'text-green-400' : 'text-[#5a6a7a]'}>
                                {option.exposureChange > 0 ? '+' : ''}{option.exposureChange}
                              </span>
                            </div>
                            {/* 收益变化 */}
                            <div className="flex items-center gap-1">
                              <span className="text-[#5a6a7a]">💎</span>
                              <span className={option.rewardChange > 0 ? 'text-green-400' : option.rewardChange < 0 ? 'text-red-400' : 'text-[#5a6a7a]'}>
                                {option.rewardChange > 0 ? '+' : ''}{option.rewardChange}%
                              </span>
                            </div>
                            {/* 负重变化 */}
                            {option.loadChange !== 'none' && (
                              <div className="flex items-center gap-1">
                                <span className="text-[#5a6a7a]">⚖️</span>
                                <span className={option.loadChange === 'increase' ? 'text-orange-400' : 'text-blue-400'}>
                                  {option.loadChange === 'increase' ? '+负重' : '-负重'}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* AI建议 */}
                  {currentEvent.aiAdvice && (
                    <div className="mt-3 p-3 bg-[#0a1520] border border-[#3a4a6a]">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-sm">🤖</span>
                        <span className="text-xs text-[#6a8aaa]">AI 参谋建议</span>
                      </div>
                      <div className="text-xs text-[#9ab8d8] leading-relaxed">{currentEvent.aiAdvice}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 物品操作弹窗 */}
            {itemAction && (
              <div className="border-b border-[#1a2a3a] p-3 bg-[#1a1a2a] flex-shrink-0">
                <div className="text-sm text-yellow-400 font-bold mb-2">📦【物品操作】</div>
                <div className="text-sm text-[#c8d8e8] mb-3"><span className="text-yellow-400">{itemAction.itemName}</span></div>
                <div className="space-y-2 mb-3">
                  {itemAction.from !== 'safebox' && <button onClick={() => handleMove('safebox')} disabled={loading} className="w-full py-2 bg-[#1a2a4a] hover:bg-[#2a3a5a] border border-[#3a4a6a] text-[#8ab8d8] text-sm">🔒 移动到保险箱</button>}
                  {itemAction.from !== 'equipment' && <button onClick={() => handleMove('equipment')} disabled={loading} className="w-full py-2 bg-[#1a3a2a] hover:bg-[#2a4a3a] border border-[#3a5a4a] text-[#8ad8a8] text-sm">⚔️ 移动到装备槽</button>}
                  {itemAction.from !== 'backpack' && <button onClick={() => handleMove('backpack')} disabled={loading} className="w-full py-2 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-[#4a4a5a] text-[#a8a8b8] text-sm">🎒 移动到背包</button>}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDiscard} disabled={loading} className="flex-1 py-2 bg-red-900/50 hover:bg-red-800/50 border border-red-700 text-red-400 text-sm">🗑️ 丢弃</button>
                  <button onClick={() => setItemAction(null)} disabled={loading} className="flex-1 py-2 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-[#4a4a5a] text-[#8a8a9a] text-sm">取消</button>
                </div>
              </div>
            )}
            
            {/* 行动选择 */}
            <div className="p-3 flex-shrink-0">
              {!player?.isAlive ? (
                <button onClick={resetGame} className="w-full py-4 bg-gradient-to-r from-[#1a4a3a] to-[#2a5a4a] hover:from-[#2a5a4a] hover:to-[#3a6a5a] border-2 border-[#4a8a6a] text-[#a8e8b8] font-bold text-lg tracking-wider transition-all shadow-lg">🔄 重新开始</button>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {(Object.keys(ZONE_INFO) as Array<keyof typeof ZONE_INFO>).map((zone) => {
                      const isRecommended = zone === 'normal' && showFirstGameHint;
                      const isSelected = pendingExploreZone === zone;
                      return (
                        <button 
                          key={zone} 
                          onClick={() => { setPendingExploreZone(zone); setShowActionSelect(true); }} 
                          disabled={loading} 
                          className={`p-3 bg-gradient-to-b ${ZONE_INFO[zone].color} hover:opacity-80 border transition-all disabled:opacity-50 ${isRecommended ? 'border-yellow-400 ring-2 ring-yellow-400/50 animate-pulse' : isSelected ? 'border-purple-400 ring-2 ring-purple-400/50' : 'border-[#3a4a5a]'}`}
                        >
                          <div className="text-center">
                            <div className="text-xl sm:text-2xl mb-1">{ZONE_INFO[zone].icon}</div>
                            <div className="text-xs sm:text-sm font-bold text-[#c8d8e8]">{ZONE_INFO[zone].name}</div>
                            <div className={`text-xs ${zone === 'normal' ? 'text-green-400' : zone === 'dangerous' ? 'text-amber-400' : 'text-red-400'}`}>{ZONE_INFO[zone].risk}</div>
                            {isRecommended && <div className="text-xs text-yellow-400 mt-1">👆 推荐</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* 行动方式选择 - 显示在风险区下方 */}
                  {showActionSelect && pendingExploreZone && (
                    <div className="mb-3 p-3 bg-gradient-to-b from-[#1a2a4a]/80 to-[#0a1520] border border-[#2a4a6a]">
                      <div className="text-center mb-2">
                        <div className="text-sm font-bold text-[#a8d8ff] mb-1">🎯 选择行动方式</div>
                        <div className="text-xs text-[#5a7a9a]">行动方式影响风险、收益和成功率</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {/* 潜行 */}
                        <button 
                          onClick={() => exploreZone(pendingExploreZone, 'stealth')}
                          disabled={loading}
                          className="p-2 bg-[#0a1a1a] hover:bg-[#1a2a2a] border border-green-800 hover:border-green-600 transition-all disabled:opacity-50"
                        >
                          <div className="text-center">
                            <div className="text-xl mb-1">🥷</div>
                            <div className="text-xs font-bold text-green-400 mb-1">潜行</div>
                            <div className="space-y-0.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[#5a7a9a]">暴露</span>
                                <span className="text-green-400">-50%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#5a7a9a]">收益</span>
                                <span className="text-red-400">-20%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#5a7a9a]">成功率</span>
                                <span className="text-green-400">+15%</span>
                              </div>
                            </div>
                          </div>
                        </button>
                        
                        {/* 搜索 */}
                        <button 
                          onClick={() => exploreZone(pendingExploreZone, 'search')}
                          disabled={loading}
                          className="p-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-yellow-800 hover:border-yellow-600 transition-all disabled:opacity-50"
                        >
                          <div className="text-center">
                            <div className="text-xl mb-1">🔍</div>
                            <div className="text-xs font-bold text-yellow-400 mb-1">搜索</div>
                            <div className="space-y-0.5 text-xs">
                              <div className="flex items-center justify-center">
                                <span className="text-[#5a7a9a]">暴露</span>
                                <span className="text-[#5a7a9a] ml-1">±0</span>
                              </div>
                              <div className="flex items-center justify-center">
                                <span className="text-[#5a7a9a]">收益</span>
                                <span className="text-[#5a7a9a] ml-1">±0</span>
                              </div>
                              <div className="flex items-center justify-center">
                                <span className="text-[#5a7a9a]">成功率</span>
                                <span className="text-[#5a7a9a] ml-1">基准</span>
                              </div>
                            </div>
                          </div>
                        </button>
                        
                        {/* 突击 */}
                        <button 
                          onClick={() => exploreZone(pendingExploreZone, 'assault')}
                          disabled={loading}
                          className="p-2 bg-[#1a0a0a] hover:bg-[#2a1a1a] border border-orange-800 hover:border-orange-600 transition-all disabled:opacity-50"
                        >
                          <div className="text-center">
                            <div className="text-xl mb-1">⚔️</div>
                            <div className="text-xs font-bold text-orange-400 mb-1">突击</div>
                            <div className="space-y-0.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[#5a7a9a]">暴露</span>
                                <span className="text-red-400">+100%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#5a7a9a]">收益</span>
                                <span className="text-green-400">+30%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#5a7a9a]">成功率</span>
                                <span className="text-red-400">-20%</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                      
                      {/* 当前状态提示 */}
                      {(player?.exposure || 0) >= 5 && (
                        <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-800/30">
                          <div className="text-xs text-yellow-300 flex items-center gap-1">
                            <span>💡</span>
                            <span>当前暴露度 {player?.exposure}/10，突击风险较高</span>
                          </div>
                        </div>
                      )}
                      {(player?.loadLevel || 'light') === 'overloaded' && (
                        <div className="mt-2 p-2 bg-red-900/20 border border-red-800/30">
                          <div className="text-xs text-red-300 flex items-center gap-1">
                            <span>⚠️</span>
                            <span>超载状态，撤离成功率降低 15%</span>
                          </div>
                        </div>
                      )}
                      
                      <button 
                        onClick={() => { setShowActionSelect(false); setPendingExploreZone(null); }}
                        disabled={loading}
                        className="w-full mt-2 py-1.5 text-xs text-[#5a7a9a] hover:text-[#8ab8d8] border border-[#2a3a4a] hover:border-[#3a4a5a] transition-colors"
                      >
                        取消选择
                      </button>
                    </div>
                  )}
                  
                  {/* 原地搜索按钮 */}
                  <button onClick={stayAndSearch} disabled={loading || currentZone === '待命中'} className="w-full py-2 mb-3 bg-[#2a2a4a] hover:bg-[#3a3a5a] border border-[#4a4a6a] text-[#a8a8d8] text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    🔄 原地搜索 {currentZone !== '待命中' && currentZone !== '撤离点' && `（${currentZone}）`}
                  </button>
                  
                  {/* 高价值警告 */}
                  {calculateAllItemsValue() >= 5000 && (
                    <div className="mb-2 p-2 bg-yellow-900/30 border border-yellow-700/50 flex items-center justify-center gap-2">
                      <span className="text-yellow-400 text-xs animate-pulse">💎</span>
                      <span className="text-yellow-300 text-xs">
                        {calculateAllItemsValue() >= 10000 ? '极高价值！建议立即撤离' : '高价值物品，建议考虑撤离'}
                      </span>
                    </div>
                  )}
                  
                  {/* 撤离按钮 */}
                  <button 
                    onClick={extract} 
                    disabled={loading || !player || (player.inventory.length === 0 && (player.equipmentSlots?.length || 0) === 0)} 
                    className={`
                      w-full py-4 mb-3 font-bold text-lg tracking-wider transition-all disabled:opacity-50
                      ${calculateAllItemsValue() >= 10000 
                        ? 'bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 border-2 border-red-400 text-white shadow-lg shadow-red-900/50 animate-pulse' 
                        : calculateAllItemsValue() >= 5000 
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 border-2 border-yellow-400 text-white shadow-lg shadow-orange-900/50 animate-pulse' 
                          : 'bg-[#1a4a3a] hover:bg-[#2a5a4a] border border-[#3a6a5a] text-[#8ad8a8]'
                      }
                    `}
                  >
                    🚁 撤离 {calculateAllItemsValue() > 0 && `(${calculateAllItemsValue().toLocaleString()})`}
                    {calculateAllItemsValue() >= 10000 && <span className="ml-2 text-sm">💀</span>}
                  </button>
                  
                  <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => setShowStorage(true)} disabled={loading} className="py-2 bg-[#2a3a4a] hover:bg-[#3a4a5a] border border-[#4a5a6a] text-[#8ab8d8] text-xs sm:text-sm">📦</button>
                    <button onClick={() => setShowShop(true)} disabled={loading} className="py-2 bg-[#4a3a1a] hover:bg-[#5a4a2a] border border-[#6a5a3a] text-[#d8b88a] text-xs sm:text-sm">🏪</button>
                    <button onClick={() => setShowLeaderboard(true)} disabled={loading} className="py-2 bg-[#1a2a4a] hover:bg-[#2a3a5a] border border-[#3a4a6a] text-[#8ab8d8] text-xs sm:text-sm">🏆</button>
                    <button onClick={() => setShowGuide(true)} className="py-2 bg-[#2a3a1a] hover:bg-[#3a4a2a] border border-[#4a5a3a] text-[#a8c878] text-xs sm:text-sm">📖</button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <button onClick={() => setShowAchievements(true)} className="py-2 bg-[#2a2a4a] hover:bg-[#3a3a5a] border border-[#4a4a6a] text-[#a8a8d8] text-xs sm:text-sm">🏅</button>
                    <button onClick={() => setShowChallenges(true)} className="py-2 bg-[#4a2a2a] hover:bg-[#5a3a3a] border border-[#6a4a4a] text-[#d8a8a8] text-xs sm:text-sm">🎯</button>
                    <button onClick={() => setShowMembership(true)} className="py-2 bg-[#3a3a2a] hover:bg-[#4a4a3a] border border-[#5a5a4a] text-[#d8d8a8] text-xs sm:text-sm">👑</button>
                  </div>
                  
                  <button onClick={() => setShowSettings(true)} disabled={loading} className="w-full mt-3 py-2 bg-transparent hover:bg-[#1a2a3a] text-[#5a6a7a] text-xs border border-[#1a2a3a]">⚙️ 账号设置</button>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* 右侧存储区 - 桌面端 */}
        <div className="hidden md:block w-64 flex-shrink-0 order-2">
          <div className="border border-[#1a2a3a] bg-[#0a1018]/95 sticky top-20 max-h-[calc(100vh-100px)] overflow-y-auto">
            <div className="border-b border-[#1a2a3a] p-2">
              <div className="text-xs text-green-400 mb-1">⚔️ 装备槽 ({player?.equipmentSlots?.length || 0}/10)</div>
              <div className="grid grid-cols-2 gap-1">
                {Array.from({ length: 10 }).map((_, i) => {
                  const item = player?.equipmentSlots?.[i];
                  if (item && item.type === 'equipment') {
                    const equip = item.item as Equipment;
                    return (<button key={i} onClick={() => setItemAction({ from: 'equipment', index: i, itemName: equip.name, item: equip })} className={`p-1.5 bg-[#0a1520] border ${getQualityBorderClass(equip.quality)} text-left hover:bg-[#1a2030] transition-colors cursor-pointer`}><div className="flex items-center gap-1"><span className="text-base">{QUALITY_SYMBOLS[equip.quality] || '📦'}</span><div className="flex-1 min-w-0"><div className={`text-xs truncate ${getQualityClass(equip.quality)}`}>{equip.name.replace(/^[^\s]+\s/, '').slice(0, 4)}</div><div className="text-xs text-yellow-400">{equip.totalValue}</div></div></div></button>);
                  }
                  return <div key={i} className="p-1.5 bg-[#0a0a10] border border-[#1a2a3a]"><div className="text-xs text-[#2a2a3a] text-center">空</div></div>;
                })}
              </div>
            </div>
            <div className="border-b border-[#1a2a3a] p-2">
              <div className="text-xs text-blue-400 mb-1">🎒 背包 ({player?.inventory.length || 0}/5)</div>
              <div className="space-y-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const item = player?.inventory?.[i];
                  if (item && item.type === 'equipment') {
                    const equip = item.item as Equipment;
                    return (<button key={i} onClick={() => setItemAction({ from: 'backpack', index: i, itemName: equip.name, item: equip })} className={`w-full p-1.5 bg-[#0a1520] border ${getQualityBorderClass(equip.quality)} text-left hover:bg-[#1a2030] transition-colors cursor-pointer`}><div className="flex items-center gap-1"><span className="text-base">{QUALITY_SYMBOLS[equip.quality] || '📦'}</span><div className="flex-1 min-w-0"><div className={`text-xs truncate ${getQualityClass(equip.quality)}`}>{equip.name.replace(/^[^\s]+\s/, '')}</div><div className="text-xs text-yellow-400">{equip.totalValue}</div></div></div></button>);
                  }
                  return <div key={i} className="p-1.5 bg-[#0a0a10] border border-[#1a2a3a]"><div className="text-xs text-[#2a2a3a] text-center">空</div></div>;
                })}
              </div>
            </div>
            <div className="p-2 bg-[#1a2a4a]/10">
              <div className="text-xs text-yellow-400 mb-1">🔒 保险箱 ({player?.safeBox?.length || 0}/10)</div>
              <div className="grid grid-cols-2 gap-1">
                {Array.from({ length: 10 }).map((_, i) => {
                  const item = player?.safeBox?.[i];
                  if (item && item.type === 'equipment') {
                    const equip = item.item as Equipment;
                    return (<button key={i} onClick={() => setItemAction({ from: 'safebox', index: i, itemName: equip.name, item: equip })} className={`p-1.5 bg-[#0a1520] border ${getQualityBorderClass(equip.quality)} text-left hover:bg-[#1a2030] transition-colors cursor-pointer`}><div className="flex items-center gap-1"><span className="text-base">{QUALITY_SYMBOLS[equip.quality] || '📦'}</span><div className="flex-1 min-w-0"><div className={`text-xs truncate ${getQualityClass(equip.quality)}`}>{equip.name.replace(/^[^\s]+\s/, '').slice(0, 4)}</div><div className="text-xs text-yellow-400">{equip.totalValue}</div></div></div></button>);
                  }
                  return <div key={i} className="p-1.5 bg-[#0a0a10] border border-[#1a2a3a]"><div className="text-xs text-[#2a2a3a] text-center">空</div></div>;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 手机端存储面板 */}
      {showStorage && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowStorage(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-[#0a1018] border-t border-[#1a2a3a] overflow-y-auto">
            <div className="sticky top-0 bg-[#0a1018] border-b border-[#1a2a3a] p-3 flex items-center justify-between">
              <div className="text-sm font-bold text-[#c8d8e8]">📦 装备存储</div>
              <button onClick={() => setShowStorage(false)} className="px-3 py-1 bg-[#2a3a4a] text-[#8ab8d8] text-sm">关闭</button>
            </div>
            <div className="border-b border-[#1a2a3a] p-2">
              <div className="text-xs text-green-400 mb-1">⚔️ 装备槽 ({player?.equipmentSlots?.length || 0}/10)</div>
              <div className="grid grid-cols-2 gap-1">
                {Array.from({ length: 10 }).map((_, i) => {
                  const item = player?.equipmentSlots?.[i];
                  if (item && item.type === 'equipment') {
                    const equip = item.item as Equipment;
                    return (<button key={i} onClick={() => { setItemAction({ from: 'equipment', index: i, itemName: equip.name, item: equip }); setShowStorage(false); }} className={`p-2 bg-[#0a1520] border ${getQualityBorderClass(equip.quality)} text-left hover:bg-[#1a2030]`}><div className="flex items-center gap-1"><span className="text-base">{QUALITY_SYMBOLS[equip.quality] || '📦'}</span><div className="flex-1 min-w-0"><div className={`text-xs truncate ${getQualityClass(equip.quality)}`}>{equip.name.replace(/^[^\s]+\s/, '').slice(0, 5)}</div><div className="text-xs text-yellow-400">{equip.totalValue}</div></div></div></button>);
                  }
                  return <div key={i} className="p-2 bg-[#0a0a10] border border-[#1a2a3a]"><div className="text-xs text-[#2a2a3a] text-center">空</div></div>;
                })}
              </div>
            </div>
            <div className="border-b border-[#1a2a3a] p-2">
              <div className="text-xs text-blue-400 mb-1">🎒 背包 ({player?.inventory.length || 0}/5)</div>
              <div className="space-y-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const item = player?.inventory?.[i];
                  if (item && item.type === 'equipment') {
                    const equip = item.item as Equipment;
                    return (<button key={i} onClick={() => { setItemAction({ from: 'backpack', index: i, itemName: equip.name, item: equip }); setShowStorage(false); }} className={`w-full p-2 bg-[#0a1520] border ${getQualityBorderClass(equip.quality)} text-left hover:bg-[#1a2030]`}><div className="flex items-center gap-1"><span className="text-base">{QUALITY_SYMBOLS[equip.quality] || '📦'}</span><div className="flex-1 min-w-0"><div className={`text-xs truncate ${getQualityClass(equip.quality)}`}>{equip.name.replace(/^[^\s]+\s/, '')}</div><div className="text-xs text-yellow-400">{equip.totalValue}</div></div></div></button>);
                  }
                  return <div key={i} className="p-2 bg-[#0a0a10] border border-[#1a2a3a]"><div className="text-xs text-[#2a2a3a] text-center">空</div></div>;
                })}
              </div>
            </div>
            <div className="p-2 bg-[#1a2a4a]/10">
              <div className="text-xs text-yellow-400 mb-1">🔒 保险箱 ({player?.safeBox?.length || 0}/10)</div>
              <div className="grid grid-cols-2 gap-1">
                {Array.from({ length: 10 }).map((_, i) => {
                  const item = player?.safeBox?.[i];
                  if (item && item.type === 'equipment') {
                    const equip = item.item as Equipment;
                    return (<button key={i} onClick={() => { setItemAction({ from: 'safebox', index: i, itemName: equip.name, item: equip }); setShowStorage(false); }} className={`p-2 bg-[#0a1520] border ${getQualityBorderClass(equip.quality)} text-left hover:bg-[#1a2030]`}><div className="flex items-center gap-1"><span className="text-base">{QUALITY_SYMBOLS[equip.quality] || '📦'}</span><div className="flex-1 min-w-0"><div className={`text-xs truncate ${getQualityClass(equip.quality)}`}>{equip.name.replace(/^[^\s]+\s/, '').slice(0, 5)}</div><div className="text-xs text-yellow-400">{equip.totalValue}</div></div></div></button>);
                  }
                  return <div key={i} className="p-2 bg-[#0a0a10] border border-[#1a2a3a]"><div className="text-xs text-[#2a2a3a] text-center">空</div></div>;
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 战报详情弹窗 */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        report={reportData}
      />
    </div>
  );
}
