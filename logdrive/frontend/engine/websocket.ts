import { RuntimeEvent } from '@/types/runtime';
import { useRuntimeStore } from '@/store/runtimeStore';

export class RealtimeWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private queue: RuntimeEvent[] = [];
  private onFlush: (events: RuntimeEvent[]) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private store = useRuntimeStore;

  constructor(url: string, onFlush: (events: RuntimeEvent[]) => void) {
    this.url = url;
    this.onFlush = onFlush;
    this.connect();
  }

  private connect() {
    if (this.ws) this.ws.close();
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.store.getState().setConnected(true);
      // Send any queued replay events as initial snapshot? Not needed, server sends replay automatically.
    };
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // The server sends individual JSON lines. It may also send an array for replay (but we treat each line separately)
        if (Array.isArray(data)) {
          this.queue.push(...data);
        } else {
          this.queue.push(data as RuntimeEvent);
        }
        // Flush immediately (non-blocking via requestAnimationFrame)
        if (this.queue.length > 0) {
          this.flush();
        }
      } catch {}
    };
    this.ws.onerror = () => {};
    this.ws.onclose = () => {
      this.store.getState().setConnected(false);
      this.scheduleReconnect();
    };
  }

  private flush() {
    const events = this.queue;
    this.queue = [];
    this.onFlush(events);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 3000);
  }

  public close() {
    if (this.ws) this.ws.close();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }
}