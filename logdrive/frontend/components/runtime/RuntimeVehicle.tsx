import { Graphics } from 'pixi.js';
import { Severity } from '@/types/runtime';

export function createVehicleGraphic(severity: Severity): Graphics {
  const g = new Graphics();
  const color =
    severity === 'INFO' ? 0x39ff14 :
    severity === 'WARN' ? 0xffea00 :
    severity === 'ERROR' ? 0xff3300 : 0xff0040;
  if (severity === 'WARN') {
    g.beginFill(color);
    g.drawPolygon([8, 0, 16, 16, 0, 16]);
    g.endFill();
  } else if (severity === 'ERROR') {
    g.beginFill(color);
    g.drawRect(0, 0, 16, 16);
    g.endFill();
  } else {
    g.beginFill(color);
    g.drawCircle(8, 8, 8);
    g.endFill();
  }
  // Center via pivot (coordinates are relative to pivot)
  g.pivot.set(8, 8);
  return g;
}