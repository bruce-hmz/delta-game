-- ============================================
-- 数据导出脚本
-- 在旧 Supabase 实例执行此脚本导出数据
-- ============================================

-- 导出玩家数据
COPY (SELECT * FROM players ORDER BY created_at) TO STDOUT WITH CSV HEADER;

-- 导出玩家装备数据
COPY (SELECT * FROM player_equipment ORDER BY created_at) TO STDOUT WITH CSV HEADER;

-- 导出玩家道具数据
COPY (SELECT * FROM player_items ORDER BY created_at) TO STDOUT WITH CSV HEADER;

-- 导出排行榜数据
COPY (SELECT * FROM leaderboard ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- 导出玩家成就数据
COPY (SELECT * FROM player_achievements) TO STDOUT WITH CSV HEADER;

-- 导出玩家每日挑战数据
COPY (SELECT * FROM player_daily_challenges) TO STDOUT WITH CSV HEADER;

-- 导出玩家订阅数据
COPY (SELECT * FROM player_subscriptions) TO STDOUT WITH CSV HEADER;

-- 导出订阅订单数据
COPY (SELECT * FROM subscription_orders) TO STDOUT WITH CSV HEADER;

-- 导出 AI 调用日志（可选，数据量大）
-- COPY (SELECT * FROM ai_call_logs ORDER BY created_at DESC LIMIT 10000) TO STDOUT WITH CSV HEADER;
