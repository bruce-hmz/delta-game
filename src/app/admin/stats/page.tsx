'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

interface StatsData {
  players: {
    total: number;
    todayNew: number;
    active24h: number;
  };
  sessions: {
    total: number;
    today: number;
    extracted: number;
    died: number;
  };
  playTime: {
    total: number;
    avg: number;
    formatted: {
      total: string;
      avg: string;
    };
  };
  last7Days: Array<{
    date: string;
    sessions: number;
  }>;
  topPlayers: Array<{
    name: string;
    total_loot_value: number;
    total_play_seconds: number;
    session_count: number;
  }>;
}

// 模拟最近游戏会话数据类型
interface RecentSession {
  id: string;
  player_name: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  final_value: number;
  extracted: boolean;
  died: boolean;
  zone: string;
  events_count: number;
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    fetchRecentSessions();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats/overview');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.error || '获取统计数据失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentSessions = async () => {
    try {
      const res = await fetch('/api/stats/sessions/recent?limit=20');
      const data = await res.json();
      if (data.success) {
        setRecentSessions(data.data);
      }
    } catch (err) {
      console.error('获取会话数据失败', err);
    }
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 60) {
      const hours = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hours}h ${remainMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载统计数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => { setLoading(true); setError(null); fetchStats(); }}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const extractRate = stats?.sessions.total 
    ? ((stats.sessions.extracted / stats.sessions.total) * 100).toFixed(1) 
    : '0';
  const deathRate = stats?.sessions.total 
    ? ((stats.sessions.died / stats.sessions.total) * 100).toFixed(1) 
    : '0';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Delta Ops 数据中心</h1>
            <p className="text-sm text-muted-foreground">玩家行为分析 & 游戏统计</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              {new Date().toLocaleDateString('zh-CN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                weekday: 'long'
              })}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchStats(); fetchRecentSessions(); }}>
              刷新数据
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* 核心指标卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 总玩家数 */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>总玩家数</CardDescription>
              <CardTitle className="text-3xl">{stats?.players.total || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">今日新增:</span>
                <Badge variant="secondary">{stats?.players.todayNew || 0}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* 24小时活跃 */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>24h 活跃玩家</CardDescription>
              <CardTitle className="text-3xl">{stats?.players.active24h || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">活跃率:</span>
                <Badge variant={stats?.players.active24h && stats.players.total ? 
                  (stats.players.active24h / stats.players.total > 0.3 ? 'default' : 'secondary') : 'secondary'}>
                  {stats?.players.total ? ((stats.players.active24h / stats.players.total) * 100).toFixed(1) : 0}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* 总游戏时长 */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>总游戏时长</CardDescription>
              <CardTitle className="text-3xl">{stats?.playTime.formatted.total || '0分钟'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">平均时长:</span>
                <Badge variant="secondary">{stats?.playTime.formatted.avg || '0分钟'}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* 游戏会话 */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>总会话数</CardDescription>
              <CardTitle className="text-3xl">{stats?.sessions.total || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">今日会话:</span>
                <Badge variant="secondary">{stats?.sessions.today || 0}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 次要指标 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 撤离率 */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>成功撤离率</CardDescription>
              <CardTitle className="text-2xl text-green-500">{extractRate}%</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={parseFloat(extractRate)} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {stats?.sessions.extracted || 0} / {stats?.sessions.total || 0} 次撤离成功
              </p>
            </CardContent>
          </Card>

          {/* 死亡率 */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>阵亡率</CardDescription>
              <CardTitle className="text-2xl text-red-500">{deathRate}%</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={parseFloat(deathRate)} className="h-2 bg-muted [&>div]:bg-red-500" />
              <p className="text-xs text-muted-foreground mt-2">
                {stats?.sessions.died || 0} 次阵亡
              </p>
            </CardContent>
          </Card>

          {/* 平均会话时长 */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>平均每局时长</CardDescription>
              <CardTitle className="text-2xl">{stats?.playTime.formatted.avg || '0分钟'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {stats?.playTime.avg ? Math.floor(stats.playTime.avg / 60) : 0} 分钟
                </Badge>
                <span className="text-xs text-muted-foreground">平均游戏深度</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 详细数据 Tabs */}
        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="sessions">最近会话</TabsTrigger>
            <TabsTrigger value="leaderboard">玩家排行</TabsTrigger>
            <TabsTrigger value="trends">活跃趋势</TabsTrigger>
          </TabsList>

          {/* 最近会话 */}
          <TabsContent value="sessions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>最近游戏会话</CardTitle>
                <CardDescription>显示最近 20 条游戏记录</CardDescription>
              </CardHeader>
              <CardContent>
                {recentSessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无会话数据
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>玩家</TableHead>
                          <TableHead>区域</TableHead>
                          <TableHead>开始时间</TableHead>
                          <TableHead>时长</TableHead>
                          <TableHead>最终价值</TableHead>
                          <TableHead>事件数</TableHead>
                          <TableHead>结果</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentSessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell className="font-medium">{session.player_name}</TableCell>
                            <TableCell>{session.zone || '-'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatTime(session.start_time)}
                            </TableCell>
                            <TableCell>{formatDuration(session.duration_seconds)}</TableCell>
                            <TableCell>
                              <span className="text-green-500">{formatValue(session.final_value)}</span>
                            </TableCell>
                            <TableCell>{session.events_count || 0}</TableCell>
                            <TableCell>
                              {session.extracted ? (
                                <Badge variant="default" className="bg-green-500">撤离成功</Badge>
                              ) : session.died ? (
                                <Badge variant="destructive">阵亡</Badge>
                              ) : (
                                <Badge variant="secondary">进行中</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 玩家排行榜 */}
          <TabsContent value="leaderboard" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>玩家排行榜</CardTitle>
                <CardDescription>按总战利品价值排名</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">排名</TableHead>
                        <TableHead>玩家名</TableHead>
                        <TableHead>总战利品</TableHead>
                        <TableHead>游戏时长</TableHead>
                        <TableHead>游戏次数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats?.topPlayers.map((player, index) => (
                        <TableRow key={player.name}>
                          <TableCell>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </TableCell>
                          <TableCell className="font-medium">{player.name}</TableCell>
                          <TableCell>
                            <span className="text-green-500 font-bold">
                              {formatValue(player.total_loot_value)}
                            </span>
                          </TableCell>
                          <TableCell>{formatDuration(player.total_play_seconds)}</TableCell>
                          <TableCell>{player.session_count || 0} 次</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 活跃趋势 */}
          <TabsContent value="trends" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>最近 7 天活跃趋势</CardTitle>
                <CardDescription>每日游戏会话数量</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between h-48 gap-2">
                  {stats?.last7Days.map((day, index) => {
                    const maxSessions = Math.max(...(stats?.last7Days.map(d => d.sessions) || [1]));
                    const height = maxSessions > 0 ? (day.sessions / maxSessions) * 100 : 0;
                    return (
                      <div key={day.date} className="flex flex-col items-center flex-1">
                        <div className="w-full flex flex-col items-center justify-end h-40">
                          <div 
                            className="w-full max-w-12 bg-primary rounded-t transition-all duration-300"
                            style={{ height: `${height}%`, minHeight: day.sessions > 0 ? '4px' : '0' }}
                          />
                        </div>
                        <div className="mt-2 text-center">
                          <div className="text-sm font-medium">{day.sessions}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(day.date)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8 py-4 text-center text-sm text-muted-foreground">
        <p>Delta Ops 数据分析平台 · 数据仅供内部运营参考</p>
      </footer>
    </div>
  );
}
