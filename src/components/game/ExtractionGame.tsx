'use client';

import { useExtractionGame } from './useExtractionGame';
import { ZoneSelection } from './ZoneSelection';
import ExtractionMap from './ExtractionMap';
import type { EvacResult } from '@/lib/game/extraction/types';

interface ExtractionGameProps {
  accessToken: string | null;
}

export function ExtractionGame({ accessToken }: ExtractionGameProps) {
  const game = useExtractionGame(accessToken);

  if (game.phase === 'result' && game.evacResult) {
    return <EvacResultScreen result={game.evacResult} onReset={game.resetGame} />;
  }

  if (game.phase === 'playing' && game.runState) {
    return (
      <div>
        {game.error && (
          <div className="fixed top-0 left-0 right-0 z-[60] bg-red-500/90 text-white text-center text-sm py-2 px-4">
            {game.error}
          </div>
        )}
        <ExtractionMap
          runState={game.runState}
          map={game.map}
          moveResult={game.moveResult}
          onMove={game.moveToNode}
          onEvacuate={game.evacuate}
          loading={game.loading}
        />
      </div>
    );
  }

  return (
    <ZoneSelection
      zones={game.zones}
      onSelect={game.startRun}
      loading={game.loading && game.zones.length === 0}
    />
  );
}

function EvacResultScreen({ result, onReset }: { result: EvacResult; onReset: () => void }) {
  return (
    <div className="bg-[#0a0a0a] text-white max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center">
        <div className="text-5xl mb-4">🚁</div>
        <h1 className="text-2xl font-bold mb-2">成功撤离</h1>
        <p className="text-zinc-500 text-sm mb-8">物品已安全存入仓库</p>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8 w-full">
          <div className="flex justify-between items-center mb-4">
            <span className="text-zinc-400 text-sm">存入物品</span>
            <span className="text-amber-400 font-bold">{result.itemsBanked} 件</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-sm">总价值</span>
            <span className="text-amber-400 font-bold">{result.totalValue}</span>
          </div>
        </div>

        <button
          onClick={onReset}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-2xl text-base tracking-widest transition-colors"
        >
          再来一次
        </button>
      </div>
    </div>
  );
}
