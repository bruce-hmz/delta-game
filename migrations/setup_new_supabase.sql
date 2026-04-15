-- ============================================
-- 请在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 玩家表
CREATE TABLE IF NOT EXISTS players (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  password_hash TEXT,
  bind_email TEXT,
  google_id TEXT,
  google_email TEXT,
  coins INTEGER NOT NULL DEFAULT 100,
  is_alive BOOLEAN NOT NULL DEFAULT true,
  current_hp INTEGER NOT NULL DEFAULT 100,
  max_hp INTEGER NOT NULL DEFAULT 100,
  current_zone VARCHAR DEFAULT 'safe',
  game_status VARCHAR NOT NULL DEFAULT 'exploring',
  kill_count INTEGER NOT NULL DEFAULT 0,
  total_loot_value INTEGER NOT NULL DEFAULT 0,
  red_count INTEGER NOT NULL DEFAULT 0,
  max_profit INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER NOT NULL DEFAULT 0,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. 玩家装备表
CREATE TABLE IF NOT EXISTS player_equipment (
  id VARCHAR PRIMARY KEY,
  player_id VARCHAR NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  equipment_id VARCHAR NOT NULL,
  equipment_name VARCHAR NOT NULL,
  quality VARCHAR NOT NULL,
  rarity VARCHAR NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  stats JSONB,
  is_looted BOOLEAN NOT NULL DEFAULT true,
  slot_type VARCHAR DEFAULT 'inventory',
  slot_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. 玩家道具表
CREATE TABLE IF NOT EXISTS player_items (
  id VARCHAR PRIMARY KEY,
  player_id VARCHAR NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_type VARCHAR NOT NULL,
  item_name VARCHAR NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  effect JSONB,
  is_equipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. 排行榜表
CREATE TABLE IF NOT EXISTS leaderboard (
  id VARCHAR PRIMARY KEY,
  player_id VARCHAR NOT NULL,
  player_name VARCHAR NOT NULL,
  total_value INTEGER NOT NULL DEFAULT 0,
  kill_count INTEGER NOT NULL DEFAULT 0,
  equipment_count INTEGER NOT NULL DEFAULT 0,
  survived_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. 成就表
CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  icon VARCHAR DEFAULT '🏅',
  category VARCHAR NOT NULL,
  condition JSONB NOT NULL,
  reward JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. 玩家成就表
CREATE TABLE IF NOT EXISTS player_achievements (
  id VARCHAR PRIMARY KEY,
  player_id VARCHAR NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_code VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'in_progress',
  current_progress INTEGER NOT NULL DEFAULT 0,
  target_value INTEGER NOT NULL DEFAULT 1,
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(player_id, achievement_code)
);

-- 7. 每日挑战表
CREATE TABLE IF NOT EXISTS daily_challenges (
  id VARCHAR PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  icon VARCHAR DEFAULT '🎯',
  category VARCHAR NOT NULL,
  difficulty VARCHAR NOT NULL DEFAULT 'normal',
  condition JSONB NOT NULL,
  reward JSONB NOT NULL DEFAULT '{"xp": 100, "coins": 500}',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. 玩家每日挑战表
CREATE TABLE IF NOT EXISTS player_daily_challenges (
  id VARCHAR PRIMARY KEY,
  player_id VARCHAR NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  challenge_code VARCHAR NOT NULL,
  challenge_date VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'active',
  current_progress INTEGER NOT NULL DEFAULT 0,
  target_value INTEGER NOT NULL DEFAULT 1,
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(player_id, challenge_code, challenge_date)
);

-- 9. 订阅等级表
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id VARCHAR PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  icon VARCHAR DEFAULT '👤',
  color VARCHAR DEFAULT '#888888',
  price INTEGER NOT NULL DEFAULT 0,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. 玩家订阅表
CREATE TABLE IF NOT EXISTS player_subscriptions (
  id VARCHAR PRIMARY KEY,
  player_id VARCHAR NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tier_code VARCHAR NOT NULL DEFAULT 'free',
  status VARCHAR NOT NULL DEFAULT 'inactive',
  start_at TIMESTAMP WITH TIME ZONE,
  expire_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  total_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11. 订阅订单表
CREATE TABLE IF NOT EXISTS subscription_orders (
  id VARCHAR PRIMARY KEY,
  order_no VARCHAR NOT NULL UNIQUE,
  player_id VARCHAR NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tier_code VARCHAR NOT NULL,
  original_price INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  actual_price INTEGER NOT NULL DEFAULT 0,
  payment_status VARCHAR NOT NULL DEFAULT 'pending',
  payment_method VARCHAR,
  coupon_code VARCHAR,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 12. AI 调用日志表
CREATE TABLE IF NOT EXISTS ai_call_logs (
  id VARCHAR PRIMARY KEY,
  call_id VARCHAR NOT NULL,
  call_type VARCHAR NOT NULL,
  player_id VARCHAR,
  player_name VARCHAR,
  model VARCHAR NOT NULL DEFAULT 'doubao',
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  quality_score INTEGER,
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 13. AI 建议历史表
CREATE TABLE IF NOT EXISTS ai_advice_history (
  id VARCHAR PRIMARY KEY,
  player_id VARCHAR NOT NULL,
  run_id VARCHAR,
  zone VARCHAR NOT NULL,
  round INTEGER NOT NULL,
  advice_text TEXT NOT NULL,
  personality VARCHAR NOT NULL,
  recommendation JSONB NOT NULL,
  player_decision VARCHAR,
  outcome TEXT,
  value_change INTEGER DEFAULT 0,
  carry_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 14. AI 每日统计表
CREATE TABLE IF NOT EXISTS ai_stats_daily (
  id VARCHAR PRIMARY KEY,
  stat_date VARCHAR NOT NULL,
  player_id VARCHAR,
  event_calls INTEGER NOT NULL DEFAULT 0,
  advice_calls INTEGER NOT NULL DEFAULT 0,
  report_calls INTEGER NOT NULL DEFAULT 0,
  memory_calls INTEGER NOT NULL DEFAULT 0,
  total_response_time_ms INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_hit_rate INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  success_rate INTEGER NOT NULL DEFAULT 100,
  unique_players INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(stat_date, player_id)
);

-- 15. 分享统计表
CREATE TABLE IF NOT EXISTS share_stats (
  id VARCHAR PRIMARY KEY,
  player_id VARCHAR,
  player_name VARCHAR,
  final_value INTEGER NOT NULL DEFAULT 0,
  player_style VARCHAR,
  share_result VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 16. 排行榜快照表
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id VARCHAR PRIMARY KEY,
  period VARCHAR NOT NULL,
  period_start VARCHAR NOT NULL,
  period_end VARCHAR NOT NULL,
  rankings JSONB NOT NULL DEFAULT '[]',
  total_players INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 17. 玩家排名历史表
CREATE TABLE IF NOT EXISTS player_rank_history (
  id VARCHAR PRIMARY KEY,
  player_id VARCHAR NOT NULL,
  period VARCHAR NOT NULL,
  period_date VARCHAR NOT NULL,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  change INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- 创建索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_players_bind_email ON players(bind_email);
CREATE INDEX IF NOT EXISTS idx_players_google_id ON players(google_id);
CREATE INDEX IF NOT EXISTS idx_player_equipment_player_id ON player_equipment(player_id);
CREATE INDEX IF NOT EXISTS idx_player_items_player_id ON player_items(player_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_created_at ON leaderboard(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_total_value ON leaderboard(total_value DESC);

-- ============================================
-- 禁用 RLS（简化访问）
-- ============================================

ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard DISABLE ROW LEVEL SECURITY;
ALTER TABLE achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_daily_challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_advice_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_stats_daily DISABLE ROW LEVEL SECURITY;
ALTER TABLE share_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_rank_history DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 初始化订阅等级数据
-- ============================================

INSERT INTO subscription_tiers (id, code, name, description, icon, color, price, price_monthly, duration_days, features, display_order) VALUES
('free-tier', 'free', '免费用户', '基础游戏体验', '👤', '#888888', 0, 0, 0, '{"aiAdvice": 3, "safeboxSlots": 5, "extractProtection": false}', 0),
('basic-tier', 'basic', '基础会员', '解锁更多 AI 功能', '🥉', '#cd7f32', 1800, 1500, 30, '{"aiAdvice": 10, "safeboxSlots": 10, "extractProtection": true}', 1),
('premium-tier', 'premium', '高级会员', '完整 AI 战术体验', '🥈', '#c0c0c0', 5800, 4800, 30, '{"aiAdvice": -1, "safeboxSlots": 15, "extractProtection": true, "extraDropRate": 5}', 2),
('vip-tier', 'vip', 'VIP会员', '顶级特权体验', '🥇', '#ffd700', 12800, 9800, 30, '{"aiAdvice": -1, "safeboxSlots": 20, "extractProtection": true, "extraDropRate": 10, "prioritySupport": true}', 3)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 初始化成就数据
-- ============================================

INSERT INTO achievements (id, code, name, description, icon, category, condition, reward, display_order) VALUES
('ach-001', 'first_extract', '首次撤离', '成功完成第一次撤离', '🚁', 'progress', '{"type": "extract", "count": 1}', '{"coins": 500}', 0),
('ach-002', 'survivor_10', '幸存者', '累计成功撤离10次', '🏃', 'progress', '{"type": "extract", "count": 10}', '{"coins": 2000}', 1),
('ach-003', 'killer_5', '猎人', '单局击杀5个敌人', '⚔️', 'combat', '{"type": "kills", "count": 5}', '{"coins": 1000}', 2),
('ach-004', 'red_drop', '开红时刻', '首次获得红色品质装备', '💎', 'loot', '{"type": "red_quality", "count": 1}', '{"coins": 3000}', 3),
('ach-005', 'millionaire', '百万富翁', '单局收益超过100000', '💰', 'wealth', '{"type": "profit", "value": 100000}', '{"coins": 10000}', 4)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 初始化每日挑战数据
-- ============================================

INSERT INTO daily_challenges (id, code, name, description, icon, category, difficulty, condition, reward, display_order) VALUES
('dc-001', 'daily_extract', '安全撤离', '完成一次成功撤离', '🚁', 'extract', 'easy', '{"type": "extract", "count": 1}', '{"coins": 300}', 0),
('dc-002', 'daily_kill', '猎杀任务', '击杀3个敌人', '⚔️', 'combat', 'normal', '{"type": "kills", "count": 3}', '{"coins": 500}', 1),
('dc-003', 'daily_loot', '搜刮专家', '获得5件装备', '📦', 'loot', 'easy', '{"type": "loot", "count": 5}', '{"coins": 400}', 2),
('dc-004', 'daily_boss', '挑战黑区', '探索黑区实验室', '💀', 'explore', 'hard', '{"type": "zone_boss", "count": 1}', '{"coins": 1000}', 3)
ON CONFLICT (code) DO NOTHING;

-- 完成！
SELECT 'Database setup complete!' as status;
