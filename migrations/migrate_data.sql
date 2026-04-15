-- ============================================
-- 迁移现有玩家数据
-- 执行时间：2026-03-21
-- ============================================

-- 玩家数据迁移（12条记录）
INSERT INTO players (id, name, password_hash, bind_email, google_id, google_email, coins, is_alive, current_hp, max_hp, current_zone, game_status, kill_count, total_loot_value, red_count, max_profit, total_games, last_login, created_at, updated_at) VALUES 
('d37fbef0-c76e-41ce-9477-4a551eb859b5', '测试玩家', NULL, NULL, NULL, NULL, 226, true, 100, 100, 'safe', 'exploring', 0, 126, 0, 0, 0, NULL, '2026-03-20 14:34:32.268907+08', '2026-03-20 14:34:39.798+08'),
('520f721a-0cf0-4f27-9659-2936040fd041', '孤狼001', NULL, NULL, NULL, NULL, 2000, true, 100, 100, 'safe', 'exploring', 0, 0, 0, 0, 0, '2026-03-20 14:43:50.477+08', '2026-03-20 14:43:31.064152+08', NULL),
('28fc6e96-93e5-4ac1-a341-a38a436f9b85', '孤狼002', NULL, NULL, NULL, NULL, 2000, true, 100, 100, 'safe', 'exploring', 0, 0, 0, 0, 0, NULL, '2026-03-20 14:43:50.718674+08', NULL),
('c1ef1054-fb5a-4a4d-9e32-8bddb92163e7', '孤狼003', NULL, NULL, NULL, NULL, 2000, true, 100, 100, 'safe', 'exploring', 0, 0, 0, 0, 0, NULL, '2026-03-20 14:44:08.92756+08', NULL),
('119378f8-864a-4dff-8e25-e27fe22002a6', '新玩家001', NULL, NULL, NULL, NULL, 2000, true, 100, 100, 'safe', 'exploring', 0, 0, 0, 0, 0, NULL, '2026-03-20 14:44:34.43773+08', NULL),
('48204475-e3a3-45e2-b368-fdcb3d1e36ca', '007', NULL, NULL, NULL, NULL, 2000, true, 100, 100, 'safe', 'exploring', 0, 0, 0, 0, 0, NULL, '2026-03-20 14:46:48.043776+08', '2026-03-20 14:46:55.959+08'),
('f4335a29-5ed5-4de0-86b3-b0996a1cd6ca', '测试战士', NULL, NULL, NULL, NULL, 2000, true, 100, 100, 'safe', 'exploring', 0, 0, 0, 0, 0, NULL, '2026-03-20 15:19:12.009407+08', '2026-03-20 15:19:21.986+08'),
('8ba8ea5d-89ea-436c-b7b9-0a6250945cee', 'bruce', '82ab3ea9901c1aa818963bbb122cfe1a:44d29ebe431df8e2c3b41653007af0bacefe077ad6aa69cb492961f052db99927878b54119cd81c0df32f6fc7c3ace8b0e5428a028949d03f8e2179fd31645c5', '123387447@qq.com', NULL, NULL, 87252, true, 100, 100, 'safe', 'exploring', 0, 8317004, 2, 2169243, 16, NULL, '2026-03-20 15:26:19.765019+08', '2026-03-21 17:22:38.25+08'),
('3a93a703-d0dc-4dac-8173-b63d2fc18960', '456', NULL, NULL, NULL, NULL, 2000, true, 100, 100, 'safe', 'exploring', 0, 0, 0, 0, 0, NULL, '2026-03-20 16:21:14.829187+08', NULL),
('0910dabd-8741-4f10-ac1c-c28240dba1a7', '001', NULL, NULL, NULL, NULL, 66055, true, 100, 100, 'safe', 'exploring', 0, 522949, 0, 303500, 2, NULL, '2026-03-20 19:40:05.976281+08', '2026-03-20 20:15:40.385+08'),
('e630b4c4-ac33-47cb-a7be-07385720b251', '猎鹰7660', NULL, NULL, NULL, NULL, 405117, true, 100, 100, 'safe', 'exploring', 0, 615290, 1, 385750, 3, NULL, '2026-03-20 22:36:10.906951+08', '2026-03-20 22:39:43.355+08'),
('92e6d184-9681-45cc-b4b8-f9dbe4d5b0df', 'AI测试用户', NULL, NULL, NULL, NULL, 2000, true, 100, 100, 'safe', 'exploring', 0, 0, 0, 0, 0, NULL, '2026-03-21 10:50:41.765252+08', NULL)
ON CONFLICT (id) DO NOTHING;

-- 验证导入
SELECT COUNT(*) as player_count FROM players;

-- 完成！
SELECT 'Data migration complete!' as status;
