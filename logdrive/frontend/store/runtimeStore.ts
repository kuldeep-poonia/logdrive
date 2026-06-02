import { create } from 'zustand';
import { RuntimeEvent, ReplayState } from '@/types/runtime';

interface RuntimeStore {
  // live connection status
  connected: boolean;
  setConnected: (v: boolean) => void;

  // event throughput (last second)
  eventsPerSecond: number;
  setEventsPerSecond: (v: number) => void;

  // active vehicle count
  activeVehicles: number;
  setActiveVehicles: (v: number) => void;

  // replay state
  replay: ReplayState;
  toggleReplay: () => void;
  setReplayEvents: (events: RuntimeEvent[]) => void;
  replayNextEvent: () => void;
  pauseReplay: () => void;
  resumeReplay: () => void;
  setReplayIndex: (index: number) => void;

  // dropped frame warning
  droppedFrames: number;
  incrementDroppedFrames: () => void;
  resetDroppedFrames: () => void;
}

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),
  eventsPerSecond: 0,
  setEventsPerSecond: (v) => set({ eventsPerSecond: v }),
  activeVehicles: 0,
  setActiveVehicles: (v) => set({ activeVehicles: v }),
  replay: {
    enabled: false,
    events: [],
    currentIndex: 0,
    isPlaying: false,
  },
  toggleReplay: () =>
    set((state) => ({
      replay: {
        ...state.replay,
        enabled: !state.replay.enabled,
        isPlaying: !state.replay.enabled,
        currentIndex: 0,
      },
    })),
  setReplayEvents: (events) =>
    set((state) => ({
      replay: { ...state.replay, events },
    })),
  replayNextEvent: () =>
    set((state) => ({
      replay: {
        ...state.replay,
        currentIndex: Math.min(
          state.replay.currentIndex + 1,
          state.replay.events.length - 1
        ),
      },
    })),
  pauseReplay: () =>
    set((state) => ({
      replay: { ...state.replay, isPlaying: false },
    })),
  resumeReplay: () =>
    set((state) => ({
      replay: { ...state.replay, isPlaying: true },
    })),
  setReplayIndex: (index) =>
    set((state) => ({
      replay: { ...state.replay, currentIndex: index },
    })),
  droppedFrames: 0,
  incrementDroppedFrames: () =>
    set((state) => ({ droppedFrames: state.droppedFrames + 1 })),
  resetDroppedFrames: () => set({ droppedFrames: 0 }),
}));