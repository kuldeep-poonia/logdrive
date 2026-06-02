import { Application } from 'pixi.js';
import { VehicleFactory } from './vehicleFactory';
import { EventQueue } from './eventQueue';
import { updateShake } from './effects';
import { useRuntimeStore } from '@/store/runtimeStore';

export class AnimationLoop {
  private app: Application;
  private vehicleFactory: VehicleFactory;
  private eventQueue: EventQueue;
  private laneYs: number[] = [120, 220, 320, 420, 520]; // 5 lanes

  constructor(app: Application, vehicleFactory: VehicleFactory, eventQueue: EventQueue) {
    this.app = app;
    this.vehicleFactory = vehicleFactory;
    this.eventQueue = eventQueue;
  }

  start() {
    let lastFpsUpdate = performance.now();
    let frameCount = 0;
    this.app.ticker.add((delta) => {
      // Process incoming events
      const events = this.eventQueue.drain();
      for (const ev of events) {
        this.handleEvent(ev);
      }

      // Update entities
      this.vehicleFactory.update(delta, performance.now());
      updateShake(delta);

      // FPS counter
      frameCount++;
      const now = performance.now();
      if (now - lastFpsUpdate >= 1000) {
        useRuntimeStore.getState().setFps(Math.round(frameCount / ((now - lastFpsUpdate) / 1000)));
        useRuntimeStore.getState().setEventsPerSecond(events.length); // approximate
        frameCount = 0;
        lastFpsUpdate = now;
      }
      useRuntimeStore.getState().setActiveVehicles(this.vehicleFactory.activeVehicleCount);
    });
  }

  private handleEvent(ev: any) {
    const laneIdx = this.laneForEvent(ev);
    if (ev.severity === 'FATAL') {
      const x = Math.random() * (this.app.screen.width - 100) + 50;
      this.vehicleFactory.spawnCrash(x, this.laneYs[laneIdx]);
    } else {
      this.vehicleFactory.spawnVehicle(ev.severity, this.laneYs[laneIdx]);
    }
  }

  private laneForEvent(ev: any): number {
    const str = ev.service || ev.message;
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(hash) % this.laneYs.length;
  }
}