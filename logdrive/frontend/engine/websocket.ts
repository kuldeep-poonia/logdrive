import { RuntimeEvent } from '@/types/runtime';

type EventCallback = (event: RuntimeEvent) => void;
type ReplayCallback = (events: RuntimeEvent[]) => void;

export class RealtimeWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onEvent: EventCallback;
  private onReplay: ReplayCallback;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private onStatusChange: (connected: boolean) => void;

  constructor(
    url: string,
    onEvent: EventCallback,
    onReplay: ReplayCallback,
    onStatusChange: (connected: boolean) => void
  ) {
    this.url = url;
    this.onEvent = onEvent;
    this.onReplay = onReplay;
    this.onStatusChange = onStatusChange;
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.onStatusChange(true);
    };
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // The server sends a snapshot as an array? Actually it sends individual JSON lines.
        // The hub sends a snapshot as a sequence of JSON objects, not an array.
        // We'll treat each line as an event.
        // If it's an array, we handle it as replay.
        if (Array.isArray(data)) {
          // this is unlikely but handle as replay snapshot
          this.onReplay(data);
        } else if (data && typeof data === 'object') {
          this.onEvent(data as RuntimeEvent);
        }
      } catch (err) {
        console.error('WebSocket parse error', err);
      }
    };
    this.ws.onerror = (err) => {
      console.error('WebSocket error', err);
    };
    this.ws.onclose = () => {
      this.onStatusChange(false);
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  public close() {
    if (this.ws) {
      this.ws.close();
    }
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
  }
}