import { RuntimeEvent } from '@/types/runtime';

// A simple double-buffer queue to decouple websocket from rendering.
export class EventQueue {
  private queue: RuntimeEvent[] = [];
  private processing: RuntimeEvent[] = [];

  push(events: RuntimeEvent[]) {
    this.queue.push(...events);
  }

  pushOne(event: RuntimeEvent) {
    this.queue.push(event);
  }

  // Swap buffers and return ready events for processing
  swap(): RuntimeEvent[] {
    const tmp = this.queue;
    this.queue = this.processing;
    this.processing = tmp;
    this.processing.length = 0; // clear ready
    return this.processing.concat(...[]); // return reference to the old processing? Actually we want to process the old processing.
    // Let's correct: we want to process the previously collected events.
  }

  // Simpler: just drain the queue and return a new array
  drain(): RuntimeEvent[] {
    if (this.queue.length === 0) return [];
    const events = this.queue;
    this.queue = [];
    return events;
  }
}