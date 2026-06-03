import { RuntimeEvent } from '../types/runtime';
import { streamManager } from './stream';

const inspectorDiv = document.getElementById('inspector')!;
const closeBtn = inspectorDiv.querySelector('.close')!;

let currentEvent: RuntimeEvent | null = null;

export const inspector = {
  show(event: RuntimeEvent) {
    currentEvent = event;
    const context = streamManager.getContext(event.seq!);
    inspectorDiv.innerHTML = `
      <span class="close">&times;</span>
      <div><strong>${event.severity}</strong></div>
      <div>Seq: ${event.seq}</div>
      <div>Time: ${new Date(event.timestamp).toLocaleTimeString()}</div>
      <div>Service: ${event.service || '—'}</div>
      <div>Message: ${event.message}</div>
      <div style="margin-top:4px;color:#888">Before: ${context.before.map(e=>e.message).join(', ')}</div>
      <div style="color:#888">After: ${context.after.map(e=>e.message).join(', ')}</div>
    `;
    inspectorDiv.style.display = 'block';
    // Position near mouse (we'll set via caller)
  },
  hide() {
    inspectorDiv.style.display = 'none';
    currentEvent = null;
  },
  isVisible() {
    return inspectorDiv.style.display === 'block';
  }
};

closeBtn?.addEventListener('click', () => inspector.hide());
// Click on canvas to hide if clicking outside a vehicle
document.getElementById('highway')!.addEventListener('click', (e) => {
  // handled in main
});