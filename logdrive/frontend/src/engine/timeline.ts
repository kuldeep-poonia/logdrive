import { streamManager } from './stream';

export function drawTimeline(ctx: CanvasRenderingContext2D) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const events = streamManager.getRecent(500);
  if (events.length === 0) return;

  ctx.clearRect(0, 0, w, h);
  const barW = w / events.length;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const x = i * barW;
    const barH = ev.severity === 'FATAL' ? 10 : ev.severity === 'ERROR' ? 7 : ev.severity === 'WARN' ? 5 : 3;
    ctx.fillStyle = ev.severity === 'FATAL' ? '#ff0040' :
                    ev.severity === 'ERROR' ? '#ff3300' :
                    ev.severity === 'WARN' ? '#ffea00' : '#39ff14';
    ctx.fillRect(x, h - barH, barW - 1, barH);
  }
}

export function handleTimelineClick(e: MouseEvent, timelineCanvas: HTMLCanvasElement) {
  // not implemented in this minimal version
}