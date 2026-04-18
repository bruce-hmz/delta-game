'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ZoneConfig, FogOfWarNode, MoveResult, EvacResult, RunItem } from '@/lib/game/extraction/types';

interface RunState {
  runId: string;
  zoneId: string;
  currentNodeId: string;
  hp: number;
  maxHp: number;
  backpackCapacity: number;
  evacWaitTurns: number;
  backpack: RunItem[];
}

export function useExtractionGame(accessToken: string | null) {
  const [phase, setPhase] = useState<'select' | 'playing' | 'result'>('select');
  const [zones, setZones] = useState<ZoneConfig[]>([]);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [map, setMap] = useState<FogOfWarNode[]>([]);
  const [moveResult, setMoveResult] = useState<MoveResult | null>(null);
  const [evacResult, setEvacResult] = useState<EvacResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const response = await fetch('/api/game/maps', { headers });
      if (!response.ok) throw new Error('Failed to fetch zones');

      const data = await response.json();
      setZones(data.zones ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch zones');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const startRun = useCallback(async (zoneId: string) => {
    setLoading(true);
    setError(null);
    setMoveResult(null);
    setEvacResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const response = await fetch('/api/game/start-run', {
        method: 'POST',
        headers,
        body: JSON.stringify({ zoneId }),
      });

      if (!response.ok) throw new Error('Failed to start run');

      const data = await response.json();
      setRunState({
        runId: data.runId,
        zoneId: data.zoneId,
        currentNodeId: data.currentNodeId,
        hp: data.hp,
        maxHp: data.maxHp,
        backpackCapacity: data.backpackCapacity,
        evacWaitTurns: data.evacWaitTurns,
        backpack: [],
      });
      setMap(data.map);
      setPhase('playing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const moveToNode = useCallback(async (targetNodeId: string) => {
    setLoading(true);
    setError(null);
    setMoveResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const response = await fetch('/api/game/move', {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetNodeId }),
      });

      if (!response.ok) throw new Error('Failed to move');

      const data = await response.json();
      setMoveResult(data);

      setRunState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          currentNodeId: data.newNodeId,
          hp: data.hp,
          backpack: [...prev.backpack, ...(data.items || [])],
        };
      });
      setMap(data.map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const evacuate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEvacResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const response = await fetch('/api/game/evacuate', {
        method: 'POST',
        headers,
      });

      if (!response.ok) throw new Error('Failed to evacuate');

      const data = await response.json();
      setEvacResult(data);
      setPhase('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evacuate');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const resetGame = useCallback(() => {
    setPhase('select');
    setRunState(null);
    setMap([]);
    setMoveResult(null);
    setEvacResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  return {
    phase,
    zones,
    runState,
    map,
    moveResult,
    evacResult,
    loading,
    error,
    startRun,
    moveToNode,
    evacuate,
    resetGame,
  };
}
