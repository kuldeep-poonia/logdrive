let fps = 0;
let eps = 0;
let frameCount = 0;
let eventCount = 0;
let lastTime = performance.now();

export function updateMetrics(activeVehicles: number) {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    fps = Math.round(frameCount / ((now - lastTime) / 1000));
    eps = eventCount;
    frameCount = 0;
    eventCount = 0;
    lastTime = now;
  }
  const el = document.getElementById('metrics');
  if (el) {
    el.textContent = `FPS ${fps} | EPS ${eps} | Vehicles ${activeVehicles}`;
  }
}

export function incrementEventCount() { eventCount++; }

export function drawMetrics(ctx: CanvasRenderingContext2D) {} // not used now