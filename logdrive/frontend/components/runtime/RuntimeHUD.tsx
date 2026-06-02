'use client';

import { useRuntimeStore } from '@/store/runtimeStore';

export default function RuntimeHUD() {
  const connected = useRuntimeStore((s) => s.connected);
  const eventsPerSecond = useRuntimeStore((s) => s.eventsPerSecond);
  const activeVehicles = useRuntimeStore((s) => s.activeVehicles);
  const droppedFrames = useRuntimeStore((s) => s.droppedFrames);
  const replay = useRuntimeStore((s) => s.replay);

  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between text-xs text-neon-cyan font-mono bg-black/50 p-2 rounded pointer-events-none z-10">
      <div className="flex gap-4">
        <span className={connected ? 'text-green-400' : 'text-red-500'}>
          WS: {connected ? 'LIVE' : 'OFF'}
        </span>
        <span>EPS: {eventsPerSecond}</span>
        <span>Vehicles: {activeVehicles}</span>
        {droppedFrames > 0 && <span className="text-yellow-400">Drops: {droppedFrames}</span>}
      </div>
      {replay.enabled && (
        <span className="text-neon-yellow">
          REPLAY [{replay.currentIndex}/{replay.events.length}] {replay.isPlaying ? '▶' : '⏸'}
        </span>
      )}
    </div>
  );
}