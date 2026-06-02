import { Graphics } from 'pixi.js';
import { Severity } from '@/types/runtime';

// Simple pooling for Graphics objects (vehicles and crashes)
class GraphicsPool {
  private pool: Graphics[] = [];
  private createFn: () => Graphics;
  private resetFn: (g: Graphics) => void;

  constructor(createFn: () => Graphics, resetFn: (g: Graphics) => void) {
    this.createFn = createFn;
    this.resetFn = resetFn;
  }

  get(): Graphics {
    if (this.pool.length > 0) {
      const g = this.pool.pop()!;
      this.resetFn(g);
      return g;
    }
    return this.createFn();
  }

  release(g: Graphics) {
    g.visible = false;
    g.alpha = 1;
    g.scale.set(1);
    g.clear();
    this.pool.push(g);
  }
}

// Factory functions
export const vehiclePool = new GraphicsPool(
  () => new Graphics(),
  (g) => { g.visible = true; g.alpha = 1; g.scale.set(1); g.clear(); }
);

export const crashPool = new GraphicsPool(
  () => new Graphics(),
  (g) => { g.visible = true; g.alpha = 1; g.scale.set(1); g.clear(); }
);