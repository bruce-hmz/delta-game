import { pgTable, serial, timestamp, varchar, integer, boolean, jsonb, text, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// 系统健康检查表（Supabase 系统表，禁止删除或修改）
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 玩家表
export const players = pgTable(
	"players",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		name: varchar("name", { length: 50 }).notNull().unique(), // 昵称唯一约束
		coins: integer("coins").notNull().default(2000), // 初始资金2000
		isAlive: boolean("is_alive").notNull().default(true),
		currentHp: integer("current_hp").notNull().default(100),
		maxHp: integer("max_hp").notNull().default(100),
		currentZone: varchar("current_zone", { length: 20 }).default('safe'),
		gameStatus: varchar("game_status", { length: 20 }).notNull().default('exploring'),
		killCount: integer("kill_count").notNull().default(0),
		totalLootValue: integer("total_loot_value").notNull().default(0),
		redCount: integer("red_count").notNull().default(0), // 开红次数
		maxProfit: integer("max_profit").notNull().default(0), // 单局最高收益
		totalGames: integer("total_games").notNull().default(0), // 总游戏次数
		lastLogin: timestamp("last_login", { withTimezone: true }).defaultNow(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("players_name_idx").on(table.name), // 昵称索引加速查询
	]
);

// 玩家装备表
export const playerEquipment = pgTable("player_equipment", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull(),
	equipmentId: varchar("equipment_id", { length: 50 }).notNull(),
	equipmentName: varchar("equipment_name", { length: 100 }).notNull(),
	quality: varchar("quality", { length: 20 }).notNull(),
	value: integer("value").notNull().default(0),
	rarity: varchar("rarity", { length: 20 }).notNull(),
	stats: jsonb("stats"),
	isLooted: boolean("is_looted").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// 玩家道具表（消耗品和装备类道具）
export const playerItems = pgTable("player_items", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull(),
	itemType: varchar("item_type", { length: 50 }).notNull(),
	itemName: varchar("item_name", { length: 100 }).notNull(),
	quantity: integer("quantity").notNull().default(1),
	effect: jsonb("effect"),
	isEquipped: boolean("is_equipped").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// 排行榜表
export const leaderboard = pgTable("leaderboard", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull(),
	playerName: varchar("player_name", { length: 50 }).notNull(),
	totalValue: integer("total_value").notNull().default(0),
	killCount: integer("kill_count").notNull().default(0),
	equipmentCount: integer("equipment_count").notNull().default(0),
	survivedSeconds: integer("survived_seconds").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// ==================== AI 功能相关表 ====================

// 玩家记忆画像表
export const playerMemory = pgTable("player_memory", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull().unique(),
	styleTag: varchar("style_tag", { length: 20 }).notNull().default('unknown'), // aggressive | conservative | balanced | unknown
	styleScore: jsonb("style_score").notNull().default({ riskTaking: 50, patience: 50, efficiency: 50 }),
	summaryForAI: text("summary_for_ai"),
	keyMemories: jsonb("key_memories").notNull().default([]),
	personalityTraits: jsonb("personality_traits").notNull().default([]),
	milestones: jsonb("milestones").notNull().default([]), // 里程碑记录
	recentRuns: jsonb("recent_runs").notNull().default([]), // 最近对局摘要
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 游戏对局记录表
export const gameRuns = pgTable("game_runs", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull(),
	status: varchar("status", { length: 20 }).notNull().default('in_progress'), // in_progress | extracted | dead
	currentRound: integer("current_round").notNull().default(1),
	currentZone: varchar("current_zone", { length: 20 }),
	startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
	endedAt: timestamp("ended_at", { withTimezone: true }),
	events: jsonb("events").notNull().default([]), // 事件记录数组
	stats: jsonb("stats").notNull().default({}), // 本局统计
	result: jsonb("result"), // 结算结果
	battleReport: jsonb("battle_report"), // AI 生成的战报
}, (table) => [
	index("game_runs_player_id_idx").on(table.playerId),
	index("game_runs_status_idx").on(table.status),
]);

// AI 事件记录表
export const aiEvents = pgTable("ai_events", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	runId: varchar("run_id", { length: 36 }).notNull(),
	round: integer("round").notNull(),
	zone: varchar("zone", { length: 20 }).notNull(),
	eventType: varchar("event_type", { length: 20 }).notNull(),
	title: varchar("title", { length: 50 }).notNull(),
	description: text("description").notNull(),
	choices: jsonb("choices").notNull(),
	tensionLevel: integer("tension_level").notNull().default(3),
	playerChoice: varchar("player_choice", { length: 5 }), // A, B, C
	outcome: text("outcome"), // 结果描述
	valueChange: integer("value_change").default(0),
	generatedBy: varchar("generated_by", { length: 20 }).notNull().default('ai'), // ai | template | cached
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("ai_events_run_id_idx").on(table.runId),
]);

// AI 战报表
export const aiBattleReports = pgTable("ai_battle_reports", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	runId: varchar("run_id", { length: 36 }).notNull().unique(),
	playerId: varchar("player_id", { length: 36 }).notNull(),
	title: varchar("title", { length: 50 }).notNull(),
	narrative: text("narrative").notNull(),
	highlights: jsonb("highlights").notNull().default([]),
	advisorComment: text("advisor_comment"),
	shareCount: integer("share_count").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("ai_battle_reports_player_id_idx").on(table.playerId),
]);

// ==================== 战报分享表 ====================

// ==================== AI 埋点统计表 ====================

// AI 调用明细表 - 记录每次 AI 调用
export const aiCallLogs = pgTable("ai_call_logs", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	// 标识
	callId: varchar("call_id", { length: 64 }).notNull().unique(), // 唯一调用ID
	playerId: varchar("player_id", { length: 36 }), // 可为空（未登录用户）
	playerName: varchar("player_name", { length: 50 }), // 脱敏后的昵称
	// 调用类型
	callType: varchar("call_type", { length: 20 }).notNull(), // event | advice | report | memory
	// 调用上下文
	context: jsonb("context").notNull().default({}), // 调用时的上下文数据（脱敏）
	// 调用结果
	success: boolean("success").notNull().default(true),
	errorMessage: text("error_message"), // 错误信息（脱敏）
	// 性能指标
	responseTimeMs: integer("response_time_ms").notNull().default(0), // 响应时间
	 TokensUsed: integer("tokens_used").notNull().default(0), // Token 消耗
	cacheHit: boolean("cache_hit").notNull().default(false), // 是否命中缓存
	// 模型信息
	model: varchar("model", { length: 50 }).notNull().default('doubao'),
	// 质量标记
	qualityScore: integer("quality_score"), // 0-100 质量评分（可后续回传）
	// 时间戳
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("ai_call_logs_player_id_idx").on(table.playerId),
	index("ai_call_logs_call_type_idx").on(table.callType),
	index("ai_call_logs_created_at_idx").on(table.createdAt),
]);

// AI 统计汇总表 - 按天/用户维度汇总
export const aiStatsDaily = pgTable("ai_stats_daily", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	// 统计维度
	statDate: varchar("stat_date", { length: 10 }).notNull(), // YYYY-MM-DD
	playerId: varchar("player_id", { length: 36 }), // 可为空表示全局统计
	// 调用统计
	eventCalls: integer("event_calls").notNull().default(0),
	adviceCalls: integer("advice_calls").notNull().default(0),
	reportCalls: integer("report_calls").notNull().default(0),
	memoryCalls: integer("memory_calls").notNull().default(0),
	// 性能统计
	totalResponseTimeMs: integer("total_response_time_ms").notNull().default(0),
	totalTokens: integer("total_tokens").notNull().default(0),
	avgResponseTimeMs: integer("avg_response_time_ms").notNull().default(0),
	// 质量统计
	totalCacheHits: integer("total_cache_hits").notNull().default(0),
	cacheHitRate: integer("cache_hit_rate").notNull().default(0), // 百分比 0-100
	errorCount: integer("error_count").notNull().default(0),
	successRate: integer("success_rate").notNull().default(100), // 百分比 0-100
	// 去重用户数
	uniquePlayers: integer("unique_players").notNull().default(0),
	// 时间戳
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
	index("ai_stats_daily_date_idx").on(table.statDate),
	index("ai_stats_daily_player_idx").on(table.playerId),
]);

// AI 质量反馈表 - 用户对 AI 输出的反馈
export const aiQualityFeedback = pgTable("ai_quality_feedback", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	callId: varchar("call_id", { length: 64 }).notNull(),
	playerId: varchar("player_id", { length: 36 }),
	// 反馈类型
	feedbackType: varchar("feedback_type", { length: 20 }).notNull(), // like | dislike | report
	feedbackDetail: text("feedback_detail"), // 详细反馈
	// 时间戳
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("ai_quality_feedback_call_id_idx").on(table.callId),
]);

// 分享统计表 - 战报分享统计
export const shareStats = pgTable("share_stats", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }),
	playerName: varchar("player_name", { length: 50 }),
	// 分享结果
	shareResult: varchar("share_result", { length: 20 }).notNull(), // success | fail
	finalValue: integer("final_value").notNull().default(0),
	playerStyle: varchar("player_style", { length: 20 }),
	// 时间戳
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("share_stats_created_at_idx").on(table.createdAt),
]);

export const sharedReports = pgTable("shared_reports", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	// 分享码（短链接用，8位）
	shareCode: varchar("share_code", { length: 10 }).notNull().unique(),
	// 基本信息
	playerName: varchar("player_name", { length: 50 }).notNull(),
	result: varchar("result", { length: 20 }).notNull(), // success | fail
	finalValue: integer("final_value").notNull().default(0),
	totalRounds: integer("total_rounds").notNull().default(1),
	playerStyle: varchar("player_style", { length: 20 }).notNull().default('unknown'),
	zonesExplored: jsonb("zones_explored").notNull().default([]),
	// AI 战报内容
	aiReport: jsonb("ai_report").notNull(),
	// 统计
	viewCount: integer("view_count").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("shared_reports_share_code_idx").on(table.shareCode),
	index("shared_reports_player_name_idx").on(table.playerName),
]);

// ==================== S4 里程碑/成就系统 ====================

// 成就定义表
export const achievements = pgTable("achievements", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	// 成就标识
	code: varchar("code", { length: 50 }).notNull().unique(), // 唯一标识符
	category: varchar("category", { length: 20 }).notNull(), // combat | exploration | wealth | survival | special
	name: varchar("name", { length: 100 }).notNull(),
	description: varchar("description", { length: 255 }).notNull(),
	icon: varchar("icon", { length: 50 }).default('🏅'), // emoji图标
	// 条件
	condition: jsonb("condition").notNull(), // 条件配置 { type: 'xxx', value: xxx }
	reward: jsonb("reward").notNull().default({}), // 奖励配置
	// 显示
	displayOrder: integer("display_order").notNull().default(0),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 玩家成就进度表
export const playerAchievements = pgTable("player_achievements", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull(),
	achievementCode: varchar("achievement_code", { length: 50 }).notNull(),
	// 进度
	currentProgress: integer("current_progress").notNull().default(0),
	targetValue: integer("target_value").notNull().default(1),
	// 状态
	status: varchar("status", { length: 20 }).notNull().default('in_progress'), // locked | in_progress | completed
	completedAt: timestamp("completed_at", { withTimezone: true }),
	rewardClaimed: boolean("reward_claimed").notNull().default(false),
	// 时间戳
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
	index("player_achievements_player_id_idx").on(table.playerId),
	index("player_achievements_status_idx").on(table.status),
]);

// ==================== S5 AI 历史建议引用 ====================

// AI 建议历史表
export const aiAdviceHistory = pgTable("ai_advice_history", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull(),
	runId: varchar("run_id", { length: 36 }), // 可为空
	round: integer("round").notNull(),
	// 建议内容
	zone: varchar("zone", { length: 20 }).notNull(),
	carryValue: integer("carry_value").notNull().default(0),
	adviceText: text("advice_text").notNull(),
	recommendation: jsonb("recommendation").notNull(), // { action, confidence, reason }
	personality: varchar("personality", { length: 20 }).notNull(),
	// 玩家决策
	playerDecision: varchar("player_decision", { length: 20 }), // follow | ignore | opposite
	// 结果
	outcome: text("outcome"), // 后续结果
	valueChange: integer("value_change").default(0),
	// 时间戳
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("ai_advice_history_player_id_idx").on(table.playerId),
	index("ai_advice_history_run_id_idx").on(table.runId),
]);

// ==================== S6 每日挑战系统 ====================

// 每日挑战定义表
export const dailyChallenges = pgTable("daily_challenges", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	// 挑战标识
	code: varchar("code", { length: 50 }).notNull().unique(),
	category: varchar("category", { length: 20 }).notNull(), // combat | exploration | survival | wealth
	name: varchar("name", { length: 100 }).notNull(),
	description: varchar("description", { length: 255 }).notNull(),
	icon: varchar("icon", { length: 50 }).default('🎯'),
	// 条件
	condition: jsonb("condition").notNull(), // { type: 'xxx', value: xxx }
	difficulty: varchar("difficulty", { length: 10 }).notNull().default('normal'), // easy | normal | hard | extreme
	// 奖励
	reward: jsonb("reward").notNull().default({ coins: 500, xp: 100 }),
	// 显示
	displayOrder: integer("display_order").notNull().default(0),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 玩家每日挑战进度表
export const playerDailyChallenges = pgTable("player_daily_challenges", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull(),
	challengeCode: varchar("challenge_code", { length: 50 }).notNull(),
	challengeDate: varchar("challenge_date", { length: 10 }).notNull(), // YYYY-MM-DD
	// 进度
	currentProgress: integer("current_progress").notNull().default(0),
	targetValue: integer("target_value").notNull().default(1),
	// 状态
	status: varchar("status", { length: 20 }).notNull().default('active'), // active | completed | expired
	completedAt: timestamp("completed_at", { withTimezone: true }),
	rewardClaimed: boolean("reward_claimed").notNull().default(false),
	// 时间戳
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
	index("player_daily_challenges_player_id_idx").on(table.playerId),
	index("player_daily_challenges_date_idx").on(table.challengeDate),
]);

// ==================== S7 排行榜增强 ====================

// 排行榜快照表（每日/每周/每月）
export const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	// 维度
	period: varchar("period", { length: 10 }).notNull(), // daily | weekly | monthly
	periodStart: varchar("period_start", { length: 10 }).notNull(), // YYYY-MM-DD
	periodEnd: varchar("period_end", { length: 10 }).notNull(),
	// 排名数据
	rankings: jsonb("rankings").notNull().default([]), // [{ playerId, playerName, score, ... }]
	// 统计
	totalPlayers: integer("total_players").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("leaderboard_snapshots_period_idx").on(table.period),
]);

// 玩家排行榜历史（记录玩家在各周期的排名变化）
export const playerRankHistory = pgTable("player_rank_history", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull(),
	period: varchar("period", { length: 10 }).notNull(),
	periodDate: varchar("period_date", { length: 10 }).notNull(), // YYYY-MM-DD
	// 排名
	rank: integer("rank").notNull(),
	score: integer("score").notNull(),
	change: integer("change").notNull().default(0), // 排名变化（正数表示上升）
	// 时间戳
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("player_rank_history_player_id_idx").on(table.playerId),
	index("player_rank_history_period_idx").on(table.period),
]);

// ==================== S8 订阅/会员系统 ====================

// 会员等级定义表
export const subscriptionTiers = pgTable("subscription_tiers", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	// 等级标识
	code: varchar("code", { length: 20 }).notNull().unique(), // free | basic | premium | vip
	name: varchar("name", { length: 50 }).notNull(),
	description: varchar("description", { length: 255 }).notNull(),
	// 价格
	price: integer("price").notNull().default(0), // 价格（分）
	priceMonthly: integer("price_monthly").notNull().default(0), // 月付价格
	durationDays: integer("duration_days").notNull().default(0), // 有效期天数（0=永久）
	// 权益
	features: jsonb("features").notNull().default({}), // 权益配置
	// 显示
	icon: varchar("icon", { length: 50 }).default('👤'),
	color: varchar("color", { length: 20 }).default('#888888'),
	displayOrder: integer("display_order").notNull().default(0),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 玩家订阅表
export const playerSubscriptions = pgTable("player_subscriptions", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull().unique(),
	tierCode: varchar("tier_code", { length: 20 }).notNull().default('free'),
	// 订阅状态
	status: varchar("status", { length: 20 }).notNull().default('inactive'), // inactive | active | expired | cancelled
	// 时间
	startAt: timestamp("start_at", { withTimezone: true }),
	expireAt: timestamp("expire_at", { withTimezone: true }),
	// 续费
	autoRenew: boolean("auto_renew").notNull().default(false),
	// 统计
	totalDays: integer("total_days").notNull().default(0), // 累计订阅天数
	// 时间戳
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
	index("player_subscriptions_player_id_idx").on(table.playerId),
	index("player_subscriptions_status_idx").on(table.status),
]);

// 订阅购买记录表
export const subscriptionOrders = pgTable("subscription_orders", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	playerId: varchar("player_id", { length: 36 }).notNull(),
	orderNo: varchar("order_no", { length: 64 }).notNull().unique(), // 订单号
	// 购买信息
	tierCode: varchar("tier_code", { length: 20 }).notNull(),
	// 金额
	originalPrice: integer("original_price").notNull().default(0), // 原价
	actualPrice: integer("actual_price").notNull().default(0), // 实付
	// 支付
	paymentMethod: varchar("payment_method", { length: 20 }), // alipay | wechat | card
	paymentStatus: varchar("payment_status", { length: 20 }).notNull().default('pending'), // pending | paid | refunded | failed
	// 优惠
	couponCode: varchar("coupon_code", { length: 50 }),
	discountAmount: integer("discount_amount").notNull().default(0),
	// 时间
	paidAt: timestamp("paid_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("subscription_orders_player_id_idx").on(table.playerId),
	index("subscription_orders_status_idx").on(table.paymentStatus),
]);
