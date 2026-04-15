-- ============================================
-- 游戏会话表迁移脚本
-- 在 Supabase Dashboard 的 SQL Editor 中执行此脚本
-- ============================================

-- 1. 为 players 表添加新字段（如果不存在）
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS total_play_seconds INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS session_count INTEGER NOT NULL DEFAULT 0;

-- 2. 创建游戏会话表
CREATE TABLE IF NOT EXISTS game_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  final_value INTEGER NOT NULL DEFAULT 0,
  extracted BOOLEAN NOT NULL DEFAULT false,
  died BOOLEAN NOT NULL DEFAULT false,
  zone VARCHAR,
  events_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_game_sessions_player_id ON game_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_start_time ON game_sessions(start_time DESC);

-- 4. 启用 RLS
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- 5. 添加访问策略
CREATE POLICY "Allow all for anon users" ON game_sessions FOR ALL USING (true);

-- ============================================
-- 验证表创建成功
-- ============================================
-- 执行以下命令检查表是否创建成功：
-- SELECT * FROM game_sessions LIMIT 5;
