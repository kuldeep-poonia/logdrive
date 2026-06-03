import { setupCanvases } from './engine/renderer';
import { startAnimationLoop } from './engine/animationLoop';
import { RealtimeWebSocket } from './engine/websocket';
import { streamManager } from './engine/stream';
import { spawnVehicle, findVehicleAt } from './engine/highway';
import { inspector } from './engine/inspector';
import { incrementEventCount } from './engine/metrics';

const { mainCanvas, mainCtx, timelineCanvas, timelineCtx } = setupCanvases();

// HUD elements
const metricsEl = document.getElementById('metrics')!;
const replayControlsEl = document.getElementById('replay-controls')!;
const replayToggle = document.getElementById('replay-toggle') as HTMLButtonElement;
const replaySpeed = document.getElementById('replay-speed') as HTMLInputElement;
const replayPos = document.getElementById('replay-position')!;

let replayEnabled = false;

// WebSocket
const ws = new RealtimeWebSocket(
  'ws://localhost:8080/ws',
  (replayEvents) => {
    streamManager.addEvents(replayEvents);
    for (const ev of replayEvents) {
      spawnVehicle(ev);
      incrementEventCount();
    }
  },
  (liveEvent) => {
    streamManager.addEvent(liveEvent);
    spawnVehicle(liveEvent);
    incrementEventCount();
  },
  (connected) => {
    // update connection status if needed
  }
);

// Inspector click
mainCanvas.addEventListener('click', (e) => {
  const rect = mainCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const vehicle = findVehicleAt(x, y);
  if (vehicle) {
    inspector.show(vehicle.event);
    const inspDiv = document.getElementById('inspector')!;
    inspDiv.style.left = Math.min(e.clientX, window.innerWidth - 320) + 'px';
    inspDiv.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
  } else {
    inspector.hide();
  }
});

// Replay controls (top right)
replayToggle.addEventListener('click', () => {
  replayEnabled = !replayEnabled;
  replayControlsEl.style.display = replayEnabled ? 'flex' : 'none';
  // You would integrate replay logic here using streamManager and synchronization
});
replaySpeed.addEventListener('input', () => {
  // adjust replay speed
});

// Show replay controls when enabled
replayControlsEl.style.display = 'none'; // hidden initially

// Start animation
startAnimationLoop(mainCtx, timelineCtx);