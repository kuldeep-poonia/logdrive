import { create } from 'zustand';
import { RuntimeEvent } from '@/types/runtime';

interface RuntimeStore {
  connected: boolean;
  setConnected: (v: boolean) => void;
  eventsPerSecond: number;
  setEventsPerSecond: (v: number) => void;
  activeVehicles: number;
  setActiveVehicles: (v: number) => void;
  fps: number;
  setFps: (v: number) => void;
  replay: {
    enabled: boolean;
    events: RuntimeEvent[];
    currentIndex: number;
    isPlaying: boolean;
  };
  toggleReplay: () => void;
  setReplayEvents: (events: RuntimeEvent[]) => void;
  replayNextEvent: () => void;
  pauseReplay: () => void;
  resumeReplay: () => void;
  setReplayIndex: (index: number) => void;
}

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),
  eventsPerSecond: 0,
  setEventsPerSecond: (v) => set({ eventsPerSecond: v }),
  activeVehicles: 0,
  setActiveVehicles: (v) => set({ activeVehicles: v }),
  fps: 0,
  setFps: (v) => set({ fps: v }),
  replay: {
    enabled: false,
    events: [],
    currentIndex: 0,
    isPlaying: false,
  },
  toggleReplay: () =>
    set((s) => ({
      replay: { ...s.replay, enabled: !s.replay.enabled, isPlaying: !s.replay.enabled, currentIndex: 0 },
    })),
  setReplayEvents: (events) =>
    set((s) => ({ replay: { ...s.replay, events } })),
  replayNextEvent: () =>
    set((s) => ({
      replay: {
        ...s.replay,
        currentIndex: Math.min(s.replay.currentIndex + 1, s.replay.events.length - 1),
      },
    })),
  pauseReplay: () =>
    set((s) => ({ replay: { ...s.replay, isPlaying: false } })),
  resumeReplay: () =>
    set((s) => ({ replay: { ...s.replay, isPlaying: true } })),
  setReplayIndex: (index) =>
    set((s) => ({ replay: { ...s.replay, currentIndex: index } })),
}));