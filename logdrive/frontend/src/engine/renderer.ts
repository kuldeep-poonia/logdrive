export function setupCanvases() {
  const mainCanvas = document.getElementById('highway') as HTMLCanvasElement;
  const timelineCanvas = document.getElementById('timeline-canvas') as HTMLCanvasElement;

  function resize() {
    mainCanvas.width = window.innerWidth;
    mainCanvas.height = window.innerHeight;
    timelineCanvas.width = window.innerWidth;
    timelineCanvas.height = 24; // fixed height
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    mainCanvas,
    mainCtx: mainCanvas.getContext('2d')!,
    timelineCanvas,
    timelineCtx: timelineCanvas.getContext('2d')!,
  };
}