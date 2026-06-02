import { Container, Graphics } from 'pixi.js';
import { Severity } from '@/types/runtime';
import { vehiclePool, crashPool } from './pools';
import { applyScreenShake } from './effects';

export class VehicleFactory {
  private container: Container;
  private vehicles: Map<number, { graphic: Graphics; speed: number; severity: Severity; wobblePhase: number }> = new Map();
  private crashes: Map<number, { graphic: Graphics; startTime: number; duration: number }> = new Map();
  private nextId = 1;

  constructor(container: Container) {
    this.container = container;
  }

  spawnVehicle(severity: Severity, laneY: number) {
    const g = vehiclePool.get();
    const color = severity === 'INFO' ? 0x39ff14 :
                  severity === 'WARN' ? 0xffea00 :
                  severity === 'ERROR' ? 0xff3300 : 0xff0040;
    // Draw simple shape
    if (severity === 'WARN') {
      g.beginFill(color);
      g.drawPolygon([8, 0, 16, 16, 0, 16]);
      g.endFill();
    } else if (severity === 'ERROR') {
      g.beginFill(color);
      g.drawRect(0, 0, 16, 16);
      g.endFill();
    } else { // INFO & FATAL as circle
      g.beginFill(color);
      g.drawCircle(8, 8, 8);
      g.endFill();
    }
    g.pivot.set(8, 8);
    g.x = this.container.width + 30; // start offscreen right
    g.y = laneY;
    this.container.addChild(g);
    const id = this.nextId++;
    this.vehicles.set(id, { graphic: g, speed: 2 + Math.random() * 2, severity, wobblePhase: Math.random() * Math.PI * 2 });
  }

  spawnCrash(x: number, y: number) {
    const g = crashPool.get();
    g.beginFill(0xff0000, 0.5);
    g.drawCircle(0, 0, 10);
    g.lineStyle(2, 0xff0000, 0.7);
    g.moveTo(0, -10);
    g.lineTo(0, 10);
    g.moveTo(-10, 0);
    g.lineTo(10, 0);
    g.endFill();
    g.pivot.set(0, 0);
    g.x = x;
    g.y = y;
    this.container.addChild(g);
    const id = this.nextId++;
    this.crashes.set(id, { graphic: g, startTime: performance.now(), duration: 800 });
    applyScreenShake(this.container, 4, 300);
  }

  update(delta: number, now: number) {
    // Update vehicles
    for (const [id, v] of this.vehicles) {
      v.graphic.x -= v.speed * delta;
      // Wobble for WARN
      if (v.severity === 'WARN') {
        v.wobblePhase += 0.1 * delta;
        v.graphic.y += Math.sin(v.wobblePhase) * 0.5;
      }
      if (v.graphic.x < -30) {
        this.container.removeChild(v.graphic);
        vehiclePool.release(v.graphic);
        this.vehicles.delete(id);
      }
    }
    // Update crashes
    for (const [id, c] of this.crashes) {
      const age = now - c.startTime;
      if (age > c.duration) {
        this.container.removeChild(c.graphic);
        crashPool.release(c.graphic);
        this.crashes.delete(id);
      } else {
        const progress = age / c.duration;
        c.graphic.alpha = 1 - progress;
        c.graphic.scale.set(1 + progress * 2);
      }
    }
  }

  get activeVehicleCount() { return this.vehicles.size; }
}