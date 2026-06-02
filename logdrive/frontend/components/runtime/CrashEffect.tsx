import { Graphics } from 'pixi.js';

export function createCrashGraphic(): Graphics {
  const g = new Graphics();
  g.beginFill(0xff0000, 0.5);
  g.drawCircle(0, 0, 10);
  g.lineStyle(2, 0xff0000, 0.7);
  g.moveTo(0, -10);
  g.lineTo(0, 10);
  g.moveTo(-10, 0);
  g.lineTo(10, 0);
  g.endFill();
  // Center via pivot
  g.pivot.set(0, 0);
  return g;
}