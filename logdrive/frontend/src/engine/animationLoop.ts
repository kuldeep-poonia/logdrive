import { spawnVehicle, updateVehicles, getVehicles, findVehicleAt, drawHighwayBackground, drawVehicles } from './highway';
import { drawTimeline } from './timeline';
import { updateMetrics } from './metrics';
import { inspector } from './inspector';

let animFrameId: number;

export function startAnimationLoop(ctx: CanvasRenderingContext2D, timelineCtx: CanvasRenderingContext2D) {
  function frame() {
    // Move vehicles
    updateVehicles();

    // Draw highway scene
    drawHighwayBackground(ctx);
    drawVehicles(ctx);

    // Draw timeline
    drawTimeline(timelineCtx);

    // Update metrics display
    updateMetrics(getVehicles().length);

    animFrameId = requestAnimationFrame(frame);
  }

  animFrameId = requestAnimationFrame(frame);
}

export function stopAnimationLoop() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
}