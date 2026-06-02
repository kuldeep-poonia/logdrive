'use client';

import { useRuntimeStore } from '@/store/runtimeStore';

export default function ReplayController() {
  const replay = useRuntimeStore((s) => s.replay);
  const toggleReplay = useRuntimeStore((s) => s.toggleReplay);
  const resumeReplay = useRuntimeStore((s) => s.resumeReplay);
  const pauseReplay = useRuntimeStore((s) => s.pauseReplay);
  const setReplayIndex = useRuntimeStore((s) => s.setReplayIndex);

  return (
    <div className="absolute bottom-4 left-4 right-4 bg-black/70 border border-neon-cyan/30 rounded p-3 text-xs text-neon-cyan font-mono z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleReplay}
          className="px-2 py-1 bg-neon-cyan/20 rounded hover:bg-neon-cyan/40"
        >
          {replay.enabled ? 'Stop Replay' : 'Start Replay'}
        </button>
        {replay.enabled && (
          <>
            <button
              onClick={replay.isPlaying ? pauseReplay : resumeReplay}
              className="px-2 py-1 bg-neon-cyan/20 rounded hover:bg-neon-cyan/40"
            >
              {replay.isPlaying ? 'Pause' : 'Play'}
            </button>
            <input
              type="range"
              min={0}
              max={replay.events.length - 1}
              value={replay.currentIndex}
              onChange={(e) => setReplayIndex(Number(e.target.value))}
              className="flex-1 h-1 accent-neon-cyan"
            />
            <span>{replay.currentIndex}/{replay.events.length}</span>
          </>
        )}
      </div>
    </div>
  );
}