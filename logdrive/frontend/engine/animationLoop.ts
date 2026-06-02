import { Application } from 'pixi.js';
import { VehicleFactory } from './vehicleFactory';
import { EventQueue } from './eventQueue';
import { useRuntimeStore } from '@/store/runtimeStore';

export class AnimationLoop {
  private app: Application;
  private vehicleFactory: VehicleFactory;
  private eventQueue: EventQueue;
  private laneYs: number[] = [100, 180, 260, 340, 420];

  constructor(app: Application, vehicleFactory: VehicleFactory, eventQueue: EventQueue) {
    this.app = app;
    this.vehicleFactory = vehicleFactory;
    this.eventQueue = eventQueue;
  }

  start() {
    this.app.ticker.add((delta) => { // delta is number (scale factor)
      this.processQueue();
      this.vehicleFactory.update(delta, performance.now());
      useRuntimeStore.getState().setActiveVehicles(this.vehicleFactory.activeVehicleCount);
    });
  }

  private processQueue() {
    const events = this.eventQueue.drain();
    for (const ev of events) {
      this.handleEvent(ev);
    }
  }

  private handleEvent(ev: any) {
    const laneIndex = this.getLaneForEvent(ev);
    if (ev.severity === 'FATAL') {
      const x = Math.random() * 700 + 50;
      const y = this.laneYs[laneIndex];
      this.vehicleFactory.spawnCrash(x, y);
    } else {
      this.vehicleFactory.spawnVehicle(ev.severity, this.laneYs[laneIndex]);
    }
  }

  private getLaneForEvent(ev: any): number {
    const str = ev.service || ev.message;
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(hash) % this.laneYs.length;
  }
}