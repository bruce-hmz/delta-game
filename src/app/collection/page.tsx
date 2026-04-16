'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GachaQuality } from '@/lib/game/gacha-constants';

const QUALITY_COLORS: Record<GachaQuality, string> = {
  white: '#888888',
  blue: '#4a90e2',
  purple: '#a855f7',
  red: '#ef4444',
  gold: '#fbbf24',
};

const QUALITY_LABEL: Record<GachaQuality, string> = {
  white: '普通',
  blue: '精良',
  purple: '稀有',
  red: '史诗',
  gold: '传说',
};

const ALL_QUALITIES: GachaQuality[] = ['gold', 'red', 'purple', 'blue', 'white'];

interface CollectionItem {
  id: string;
  itemName: string;
  quality: GachaQuality;
  value: number;
  createdAt: string;
}

export default function CollectionPage() {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<GachaQuality | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(
    async (p: number, q?: GachaQuality) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ page: String(p), limit: '20' });
        if (q) params.set('quality', q);

        const res = await fetch(`/api/gacha/collection?${params}`);
        if (!res.ok) return;

        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setPage(data.page ?? p);
        setHasMore(data.hasMore ?? false);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchItems(1, filter);
  }, [filter, fetchItems]);

  const handleFilter = (q: GachaQuality | undefined) => {
    setFilter(q);
    setPage(1);
  };

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white max-w-[430px] mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm z-10 px-4 pt-4 pb-2">
        <a href="/" className="text-zinc-500 text-sm">
          ‹ 返回
        </a>
        <h1 className="text-lg font-bold mt-2">收藏</h1>
        <div className="text-xs text-zinc-500 mt-0.5">共 {total} 件物品</div>

        {/* Quality filter tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          <button
            onClick={() => handleFilter(undefined)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
              !filter ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            全部
          </button>
          {ALL_QUALITIES.map((q) => (
            <button
              key={q}
              onClick={() => handleFilter(q)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                filter === q ? 'text-black' : 'text-zinc-400'
              }`}
              style={
                filter === q
                  ? { backgroundColor: QUALITY_COLORS[q] }
                  : { backgroundColor: '#1a1a1a' }
              }
            >
              {QUALITY_LABEL[q]}
            </button>
          ))}
        </div>
      </div>

      {/* Items grid */}
      <div className="px-4 pb-20">
        {loading ? (
          <div className="text-center py-20 text-zinc-600">加载中...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-3xl mb-3">📦</div>
            <div className="text-sm text-zinc-500">还没有战利品</div>
            <a
              href="/"
              className="inline-block mt-4 px-6 py-2 bg-amber-500 text-black text-sm rounded-xl font-bold"
            >
              去开箱
            </a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-900 rounded-xl p-3 border"
                  style={{ borderColor: QUALITY_COLORS[item.quality] + '33' }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: QUALITY_COLORS[item.quality] }}
                    />
                    <span
                      className="text-[10px]"
                      style={{ color: QUALITY_COLORS[item.quality] }}
                    >
                      {QUALITY_LABEL[item.quality]}
                    </span>
                  </div>
                  <div className="text-sm font-bold truncate">
                    {item.itemName}
                  </div>
                  <div className="text-amber-400 text-xs font-bold mt-1">
                    ¥{item.value.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">
                    {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {hasMore && (
              <div className="text-center mt-6">
                <button
                  onClick={() => fetchItems(page + 1, filter)}
                  className="px-6 py-2 bg-zinc-800 text-zinc-400 text-sm rounded-xl"
                >
                  加载更多
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
