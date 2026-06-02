import { Container, Graphics } from 'pixi.js';

export function createTrafficLane(y: number, width: number, height: number): Container {
  const lane = new Container();
  const dash = new Graphics();
  dash.lineStyle(1, 0x00ffff, 0.15);
  for (let x = 0; x < width; x += 30) {
    dash.moveTo(x, y + height / 2);
    dash.lineTo(x + 15, y + height / 2);
  }
  lane.addChild(dash);
  return lane;
}