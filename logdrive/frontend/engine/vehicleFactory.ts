import { Container, Graphics } from 'pixi.js';
import { Severity } from '@/types/runtime';

const severityColors: Record<Severity, number> = {
  INFO: 0x39ff14,
  WARN: 0xffea00,
  ERROR: 0xff3300,
  FATAL: 0xff0040,
  UNKNOWN: 0x888888,
};

export class VehicleFactory {
  private container: Container;
  private vehicleGraphics: Map<number, Graphics> = new Map();
  private crashGraphics: Map<number, { graphic: Graphics; startTime: number; duration: number }> = new Map();
  private nextId = 1;

  constructor(container: Container) {
    this.container = container;
  }

  spawnVehicle(severity: Severity, laneY: number): { id: number; x: number; y: number; speed: number; severity: Severity } {
    const g = new Graphics();
    const color = severityColors[severity];
    switch (severity) {
      case 'WARN':
        g.beginFill(color);
        g.drawPolygon([8, 0, 16, 16, 0, 16]);
        g.endFill();
        break;
      case 'ERROR':
        g.beginFill(color);
        g.drawRect(0, 0, 16, 16);
        g.endFill();
        break;
      case 'FATAL':
        g.beginFill(color);
        g.drawRect(0, 0, 16, 16);
        g.endFill();
        break;
      default: // INFO
        g.beginFill(color);
        g.drawCircle(8, 8, 8);
        g.endFill();
    }
    // Use pivot for centering (graphics drawn around 0,0)
    g.pivot.set(8, 8); // center of a 16x16 area
    const id = this.nextId++;
    g.x = 800; // start from right edge
    g.y = laneY;
    this.container.addChild(g);
    this.vehicleGraphics.set(id, g);
    return { id, x: g.x, y: g.y, speed: 2 + Math.random() * 2, severity };
  }

  spawnCrash(x: number, y: number): void {
    const g = new Graphics();
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
    this.crashGraphics.set(id, { graphic: g, startTime: performance.now(), duration: 1000 });
  }

  update(delta: number, now: number) {
    for (const [id, g] of this.vehicleGraphics) {
      g.x -= 2 * delta;
      if (g.x < -30) {
        this.container.removeChild(g);
        this.vehicleGraphics.delete(id);
      }
    }
    for (const [id, { graphic, startTime, duration }] of this.crashGraphics) {
      const age = now - startTime;
      if (age > duration) {
        this.container.removeChild(graphic);
        this.crashGraphics.delete(id);
      } else {
        graphic.alpha = 1 - age / duration;
        graphic.scale.set(1 + (age / duration) * 1.5);
      }
    }
  }

  get activeVehicleCount(): number {
    return this.vehicleGraphics.size;
  }
}