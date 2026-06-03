import { RuntimeEvent } from '../types/runtime';

type ReplayCallback = (events: RuntimeEvent[]) => void;
type LiveCallback = (event: RuntimeEvent) => void;
type StatusCallback = (connected: boolean) => void;

export class RealtimeWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private onReplay: ReplayCallback;
  private onLive: LiveCallback;
  private onStatus: StatusCallback;

  constructor(
    url: string,
    onReplay: ReplayCallback,
    onLive: LiveCallback,
    onStatus: StatusCallback
  ) {
    this.onReplay = onReplay;
    this.onLive = onLive;
    this.onStatus = onStatus;
    this.connect(url);
  }

  private connect(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.onStatus(true);
    };
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // Backend sends individual event objects (live or replay).
        // Replay snapshot is a batch of separate JSON lines (one per event).
        // We collect them if they arrive in a burst, then flush.
        // A simple heuristic: if we receive multiple messages quickly, it's replay.
        if (Array.isArray(data)) {
          this.onReplay(data);
        } else {
          // Single event could be replay or live. We'll treat them all the same and let stream sort.
          this.onLive(data as RuntimeEvent);
        }
      } catch {}
    };
    this.ws.onerror = () => {};
    this.ws.onclose = () => {
      this.onStatus(false);
      this.scheduleReconnect(url);
    };
  }

  private scheduleReconnect(url: string) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connect(url), 3000);
  }

  public close() {
    if (this.ws) this.ws.close();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }
}