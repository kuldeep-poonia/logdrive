export type Severity = 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'UNKNOWN';

export interface RuntimeEvent {
  timestamp: string;
  severity: Severity;
  message: string;
  service?: string;
  event_type?: string;
  // Sequence number assigned by stream
  seq?: number;
}