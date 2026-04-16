-- Seed: 3 crate types for launch
-- Run after migration: psql $DATABASE_URL -f drizzle/seed.sql

INSERT INTO crate_configs (id, name, description, star_rating, ticket_cost, drop_rates, active, sort_order) VALUES
  (
    gen_random_uuid(),
    '军用补给箱',
    '标准军用物资箱，包含基础到稀有品质的装备',
    1, 1,
    '{"white": 0.60, "blue": 0.25, "purple": 0.10, "red": 0.04, "gold": 0.01}'::jsonb,
    true, 1
  ),
  (
    gen_random_uuid(),
    '空投补给箱',
    '高级空投物资，保底蓝色品质以上',
    2, 1,
    '{"white": 0.00, "blue": 0.40, "purple": 0.30, "red": 0.20, "gold": 0.10}'::jsonb,
    true, 2
  ),
  (
    gen_random_uuid(),
    '黑市军火箱',
    '黑市稀有军火，只有紫色以上品质',
    3, 1,
    '{"white": 0.00, "blue": 0.00, "purple": 0.30, "red": 0.40, "gold": 0.30}'::jsonb,
    true, 3
  );
