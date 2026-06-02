import { Application } from 'pixi.js';

export function createPixiApp(canvas: HTMLCanvasElement): Application {
  const app = new Application({
    view: canvas,
    backgroundColor: 0x0a0a0a,
    resizeTo: canvas.parentElement || undefined,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  return app;
}