import { RuntimeEvent } from '@/types/runtime';

export class EventQueue {
  private buffer: RuntimeEvent[] = [];

  push(events: RuntimeEvent[]) {
    this.buffer.push(...events);
  }

  pushOne(event: RuntimeEvent) {
    this.buffer.push(event);
  }

  drain(): RuntimeEvent[] {
    if (this.buffer.length === 0) return [];
    const events = this.buffer;
    this.buffer = [];
    return events;
  }
}