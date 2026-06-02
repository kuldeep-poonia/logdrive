export type Severity = 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'UNKNOWN';

export interface RuntimeEvent {
  timestamp: string;
  severity: Severity;
  message: string;
  service?: string;
  event_type?: string;
}

export interface Vehicle {
  id: number;
  x: number;
  y: number;
  speed: number;
  severity: Severity;
  spriteIndex: number; // index into the sprite pool
  wobblePhase: number;
  active: boolean;
}

export interface CrashEffect {
  id: number;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  active: boolean;
  spriteIndex: number;
}

export type ReplayState = {
  enabled: boolean;
  events: RuntimeEvent[];
  currentIndex: number;
  isPlaying: boolean;
};