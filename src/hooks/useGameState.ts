'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PlayerState, Equipment, ZoneType } from '@/lib/game/types';
import { ExtractionEngine } from '@/lib/game/canvas/engine';

// Re-export types needed by components
export type { PlayerState, Equipment, ZoneType };
export type { RunPhase, RunState } from '@/lib/game/canvas/engine';

const ZONE_INFO = {
  normal: { name: '废弃居民区', deathRate: 5 },
  dangerous: { name: '军事仓库', deathRate: 15 },
  boss: { name: '黑区实验室', deathRate: 30 },
} as const;

const QUALITY_NAMES: Record<string, string> = {
  white: '普通', blue: '精良', purple: '稀有', red: '史诗', gold: '传说',
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

export function useGameState() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [lastResult, setLastResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentZone, setCurrentZone] = useState<string>('待命中');
  const [gameSessionId, setGameSessionId] = useState<string | null>(null);
  const [eventsCount, setEventsCount] = useState(0);
  const [authError, setAuthError] = useState('');

  // Computed values
  const calculateAllItemsValue = useCallback(() => {
    if (!player) return 0;
    let total = 0;
    if (player.equipmentSlots) {
      for (const item of player.equipmentSlots) {
        if (item.type === 'equipment') total += (item.item as Equipment).totalValue;
      }
    }
    for (const item of player.inventory) {
      if (item.type === 'equipment') total += (item.item as Equipment).totalValue;
      else total += (item.item as { name: string; value: number }).value;
    }
    return total;
  }, [player]);

  const calculateRiskStars = useCallback(() => {
    if (!player) return 1;
    const itemValue = calculateAllItemsValue();
    const baseZone = currentZone === '废弃居民区' ? 1 : currentZone === '军事仓库' ? 2 : 3;
    const round = player.currentRound || 1;
    let risk = baseZone + (itemValue > 10000 ? 2 : itemValue > 5000 ? 1 : 0) + (round > 8 ? 1 : round > 5 ? 0 : -1);
    return Math.max(1, Math.min(5, risk));
  }, [player, currentZone, calculateAllItemsValue]);

  // Auth init
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
          } else if (data.needAuth) {
            localStorage.removeItem('delta_ops_token');
            await performLogin();
          } else {
            setUserExists(false);
          }
        } else {
          await performLogin();
        }
      } catch {
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
      } catch {
        setAuthError('网络错误，请刷新页面');
      }
    }
    initAuth();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      localStorage.setItem('delta_ops_token', token);
      setAccessToken(token);
      setUserExists(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const setNickname = useCallback(async (nickname: string, password: string) => {
    if (!accessToken || !nickname.trim()) return false;
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
        return true;
      }
      setAuthError(data.error || '设置昵称失败');
      return false;
    } catch {
      setAuthError('网络错误，请重试');
      return false;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const guestStart = useCallback(async () => {
    if (!accessToken) return false;
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
        return true;
      }
      setAuthError(data.error || '开始游戏失败');
      return false;
    } catch {
      setAuthError('网络错误，请重试');
      return false;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const startGame = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const sessionRes = await fetch('/api/stats/session/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const sessionData = await sessionRes.json();
      if (sessionData.success) setGameSessionId(sessionData.data.sessionId);

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
    } catch {
      console.error('Start game error');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const exploreZone = useCallback(async (zone: ZoneType, actionType: 'stealth' | 'search' | 'assault' = 'search') => {
    if (!player || !accessToken) return;
    setLoading(true);
    setCurrentZone(ZONE_INFO[zone].name);
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

        if (data.data.player && !data.data.player.isAlive && gameSessionId) {
          await fetch('/api/stats/session/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ sessionId: gameSessionId, finalValue: 0, extracted: false, died: true, zone: ZONE_INFO[zone].name, eventsCount: eventsCount + 1 }),
          });
          setGameSessionId(null);
        }
        return data.data.result;
      }
      setLastResult({ success: false, message: data.error || '探索失败' });
      return null;
    } catch {
      console.error('Explore error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [player, accessToken, gameSessionId, eventsCount]);

  const extract = useCallback(async () => {
    if (!player || !accessToken) return;
    setLoading(true);
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
        if (data.data.leaderboard) setBroadcasts(prev => prev);

        if (gameSessionId) {
          await fetch('/api/stats/session/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ sessionId: gameSessionId, finalValue: data.data.result.totalValue || 0, extracted: data.data.result.success, died: false, zone: currentZone, eventsCount }),
          });
          setGameSessionId(null);
        }
        return data.data.result;
      }
      return null;
    } catch {
      console.error('Extract error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [player, accessToken, gameSessionId, currentZone, eventsCount]);

  const resetGame = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/game/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.data.player);
        setLastResult(null);
        setCurrentZone('待命中');
        setEventsCount(0);
      }
    } catch {
      console.error('Reset error');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  return {
    // Auth
    accessToken,
    userExists,
    isLoading,
    authError,
    setNickname,
    guestStart,
    setAuthError,

    // Game state
    player,
    broadcasts,
    lastResult,
    loading,
    currentZone,
    eventsCount,

    // Computed
    carryValue: calculateAllItemsValue(),
    riskStars: calculateRiskStars(),

    // Actions
    startGame,
    exploreZone,
    extract,
    resetGame,
  };
}
