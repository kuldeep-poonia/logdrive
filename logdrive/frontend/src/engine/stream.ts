import { RuntimeEvent } from '../types/runtime';

/**
 * Manages the live event stream: assigns sequence numbers,
 * holds the event log, and feeds events into the animation loop.
 */
class StreamManager {
  private eventLog: RuntimeEvent[] = [];
  private nextSeq = 1;

  /** Add a batch of events (replay or live) */
  addEvents(events: RuntimeEvent[]) {
    for (const ev of events) {
      ev.seq = this.nextSeq++;
      this.eventLog.push(ev);
    }
    // Keep log bounded (last 10k events)
    if (this.eventLog.length > 10000) {
      this.eventLog = this.eventLog.slice(-5000);
    }
  }

  /** Add a single live event */
  addEvent(ev: RuntimeEvent) {
    ev.seq = this.nextSeq++;
    this.eventLog.push(ev);
    if (this.eventLog.length > 10000) {
      this.eventLog = this.eventLog.slice(-5000);
    }
  }

  /** Return recent events for timeline */
  getRecent(count: number = 500): RuntimeEvent[] {
    return this.eventLog.slice(-count);
  }

  /** Get events around a specific seq for inspector context */
  getContext(seq: number, window: number = 5): { before: RuntimeEvent[]; after: RuntimeEvent[] } {
    const idx = this.eventLog.findIndex(e => e.seq === seq);
    if (idx === -1) return { before: [], after: [] };
    return {
      before: this.eventLog.slice(Math.max(0, idx - window), idx),
      after: this.eventLog.slice(idx + 1, idx + 1 + window),
    };
  }

  /** Full event log for replay */
  getFullLog(): RuntimeEvent[] {
    return this.eventLog;
  }
}

export const streamManager = new StreamManager();