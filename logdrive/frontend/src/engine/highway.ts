import { RuntimeEvent, Severity } from '../types/runtime';
import { SCROLL_SPEED, getSpawnX } from './synchronization';

// ---------- Types ----------
interface Point { x: number; y: number }

type ExitPhase = 'highway' | 'exiting' | 'parked';

interface Vehicle {
  seq: number;
  x: number;
  y: number;
  severity: Severity;
  message: string;
  label: string;               // short error type for parked display
  event: RuntimeEvent;
  phase: ExitPhase;
  exitPath: Point[];           // off‑ramp path points
  exitProgress: number;        // 0..1 along the path
  opacity: number;
}

// ---------- Layout constants (left‑to‑right flow) ----------
const MAIN_LANE_Y = 300;                     // vertical centre of main highway
const MAIN_LANE_TOP = MAIN_LANE_Y - 60;
const MAIN_LANE_BOTTOM = MAIN_LANE_Y + 60;

// Parking garage is on the left side only (x = 0..PARKING_WIDTH)
const PARKING_WIDTH = 320;
const INCIDENT_LANE_START = MAIN_LANE_BOTTOM + 20;   // top of parking area
const INCIDENT_LANE_GAP = 35;
const INCIDENT_LANES = 5;                            // 5 stacked parking lanes

// Off‑ramp splits from highway at this X coordinate
const OFF_RAMP_SPLIT_X = 100;               // vehicles exit soon after spawning
const EXIT_DURATION_FRAMES = 25;            // fast exit animation

const vehicles: Vehicle[] = [];

// ---------- Error label extraction ----------
function extractLabel(message: string, severity: Severity): string {
  const lower = message.toLowerCase();
  if (lower.includes('docker'))    return 'DOCKER';
  if (lower.includes('container')) return 'CONTAINER';
  if (lower.includes('redis'))     return 'REDIS';
  if (lower.includes('version'))   return 'VERSION';
  if (lower.includes('timeout'))   return 'TIMEOUT';
  if (lower.includes('connection'))return 'CONN';
  if (lower.includes('panic'))     return 'PANIC';
  if (lower.includes('kernel'))    return 'KERNEL';
  if (lower.includes('memory'))    return 'MEMORY';
  if (lower.includes('disk'))      return 'DISK';
  if (lower.includes('crash'))     return 'CRASH';
  if (lower.includes('abort'))     return 'ABORT';
  if (lower.includes('segfault'))  return 'SEGFAULT';
  return severity.substring(0, 4);
}

// ---------- Build off‑ramp path (short curve from split down to parking) ----------
function buildRampPath(startX: number, startY: number, endX: number, endY: number, steps = 20): Point[] {
  const points: Point[] = [];
  // Control point: a gentle right‑then‑down curve
  const cpX = startX + 60;
  const cpY = startY + (endY - startY) * 0.7;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) ** 2 * startX + 2 * (1 - t) * t * cpX + t ** 2 * endX;
    const y = (1 - t) ** 2 * startY + 2 * (1 - t) * t * cpY + t ** 2 * endY;
    points.push({ x, y });
  }
  return points;
}

// ---------- Vehicle lifecycle ----------
export function spawnVehicle(event: RuntimeEvent): Vehicle {
  const severity = event.severity;
  const seq = event.seq!;

  // Spawn just off‑screen to the left
  const x = getSpawnX(seq, window.innerWidth); // this returns a leftward coordinate? We'll override below.
  // In left‑to‑right flow, we spawn at x = -50 initially (just left of screen)
  const startX = -50 + Math.random() * 20; // tiny variation
  const label = extractLabel(event.message, severity);

  const vehicle: Vehicle = {
    seq,
    x: startX,
    y: MAIN_LANE_Y,
    severity,
    message: event.message,
    label,
    event,
    phase: 'highway',
    exitPath: [],
    exitProgress: 0,
    opacity: 1,
  };

  vehicles.push(vehicle);
  return vehicle;
}

export function updateVehicles() {
  const canvasW = window.innerWidth;

  for (const v of vehicles) {
    // Highway phase – move rightwards
    if (v.phase === 'highway') {
      v.x += SCROLL_SPEED;

      // Incident vehicles exit when they reach the split point
      if (v.severity !== 'INFO' && v.x >= OFF_RAMP_SPLIT_X) {
        v.phase = 'exiting';
        const lane = findFreeIncidentLane();
        const targetY = INCIDENT_LANE_START + lane * INCIDENT_LANE_GAP;
        const targetX = OFF_RAMP_SPLIT_X + 120; // end of ramp X, inside parking area
        v.exitPath = buildRampPath(OFF_RAMP_SPLIT_X, MAIN_LANE_Y, targetX, targetY);
        v.exitProgress = 0;
      }
    }
    // Exiting phase – follow ramp curve
    else if (v.phase === 'exiting') {
      v.exitProgress += 1 / EXIT_DURATION_FRAMES;
      if (v.exitProgress >= 1) {
        v.exitProgress = 1;
        v.phase = 'parked';
        const finalPoint = v.exitPath[v.exitPath.length - 1];
        v.x = finalPoint.x;
        v.y = finalPoint.y;
      } else {
        const pathIdx = Math.floor(v.exitProgress * (v.exitPath.length - 1));
        const nextIdx = Math.min(pathIdx + 1, v.exitPath.length - 1);
        const localT = v.exitProgress * (v.exitPath.length - 1) - pathIdx;
        const p0 = v.exitPath[pathIdx];
        const p1 = v.exitPath[nextIdx];
        v.x = p0.x + (p1.x - p0.x) * localT;
        v.y = p0.y + (p1.y - p0.y) * localT;
      }
    }

    // Remove INFO vehicles that have left the screen (right side)
    if (v.severity === 'INFO' && v.phase === 'highway' && v.x > canvasW + 100) {
      v.opacity = 0;
    }
  }

  // Cleanup dead vehicles
  for (let i = vehicles.length - 1; i >= 0; i--) {
    if (vehicles[i].opacity <= 0) vehicles.splice(i, 1);
  }

  // Limit parked vehicles
  const parked = vehicles.filter(v => v.phase === 'parked');
  if (parked.length > 200) {
    let oldestSeq = Infinity;
    let oldestIdx = -1;
    for (let i = 0; i < vehicles.length; i++) {
      if (vehicles[i].phase === 'parked' && vehicles[i].seq < oldestSeq) {
        oldestSeq = vehicles[i].seq;
        oldestIdx = i;
      }
    }
    if (oldestIdx !== -1) vehicles.splice(oldestIdx, 1);
  }
}

function findFreeIncidentLane(): number {
  const counts = new Array(INCIDENT_LANES).fill(0);
  for (const v of vehicles) {
    if ((v.phase === 'parked' || v.phase === 'exiting') && v.exitPath.length > 0) {
      const finalY = v.exitPath[v.exitPath.length - 1].y;
      const lane = Math.round((finalY - INCIDENT_LANE_START) / INCIDENT_LANE_GAP);
      if (lane >= 0 && lane < INCIDENT_LANES) counts[lane]++;
    }
  }
  let minIdx = 0;
  for (let i = 1; i < INCIDENT_LANES; i++) {
    if (counts[i] < counts[minIdx]) minIdx = i;
  }
  return minIdx;
}

export function getVehicles(): Vehicle[] { return vehicles; }

export function findVehicleAt(px: number, py: number): Vehicle | null {
  for (const v of vehicles) {
    const halfW = 40;
    const halfH = 10;
    if (px >= v.x - halfW && px <= v.x + halfW && py >= v.y - halfH && py <= v.y + halfH) {
      return v;
    }
  }
  return null;
}

// ---------- Drawing helpers (scenery) ----------

function seededRandom(x: number): number {
  let seed = x * 9301 + 49297;
  seed = seed % 233280;
  return seed / 233280;
}

// A more beautiful building with windows, roof antenna, and subtle glow
function drawBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opacity: number) {
  ctx.globalAlpha = opacity;
  // Body
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#00ffff22';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Windows
  const winSize = 3;
  const gap = 7;
  for (let wy = y + 4; wy < y + h - 4; wy += gap) {
    for (let wx = x + 3; wx < x + w - 3; wx += gap) {
      if (seededRandom(wx + wy * 1000) > 0.6) {
        ctx.fillStyle = '#ffea00';
        ctx.fillRect(wx, wy, winSize, winSize);
      }
    }
  }

  // Roof antenna
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y - 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w / 2, y - 10, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ff000088';
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, baseY: number, size: number, opacity: number) {
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#0f3d0f';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x - size / 2, baseY - size);
  ctx.lineTo(x + size / 2, baseY - size);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a2e15';
  ctx.fillRect(x - 1, baseY, 2, size * 0.25);
  ctx.globalAlpha = 1;
}

// Day sky with sun on the right horizon
function drawSky(ctx: CanvasRenderingContext2D) {
  const w = ctx.canvas.width;
  const skyTop = MAIN_LANE_TOP;

  // Sky gradient – daytime blue
  const gradient = ctx.createLinearGradient(0, 0, 0, skyTop);
  gradient.addColorStop(0, '#1a3a5c');    // deep blue
  gradient.addColorStop(0.7, '#4a7a9c');  // mid blue
  gradient.addColorStop(1, '#87b9d8');    // light blue near horizon
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, skyTop);

  // Sun (rising on the right)
  const sunX = w * 0.85;
  const sunY = skyTop - 50;
  const radius = 40;

  // Outer glow
  const glowGrad = ctx.createRadialGradient(sunX, sunY, radius * 0.5, sunX, sunY, radius * 2);
  glowGrad.addColorStop(0, '#ffffffdd');
  glowGrad.addColorStop(0.3, '#ffeebbaa');
  glowGrad.addColorStop(1, '#ffeebb00');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, radius * 2, 0, Math.PI * 2);
  ctx.fill();

  // Sun disc
  ctx.fillStyle = '#fffbea';
  ctx.beginPath();
  ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Distant city skyline – a few buildings and trees on top and bottom
function drawDistantSkyline(ctx: CanvasRenderingContext2D) {
  const w = ctx.canvas.width;
  // Top background (above highway)
  drawBuilding(ctx, 30, MAIN_LANE_TOP - 70, 45, 65, 0.35);
  drawBuilding(ctx, 90, MAIN_LANE_TOP - 50, 35, 45, 0.35);
  drawTree(ctx, 150, MAIN_LANE_TOP, 25, 0.35);
  drawBuilding(ctx, 200, MAIN_LANE_TOP - 60, 50, 55, 0.35);

  // Far right buildings (behind sun slightly)
  drawBuilding(ctx, w - 250, MAIN_LANE_TOP - 80, 55, 75, 0.3);
  drawBuilding(ctx, w - 170, MAIN_LANE_TOP - 40, 30, 35, 0.3);
  drawTree(ctx, w - 300, MAIN_LANE_TOP, 30, 0.3);

  // Bottom background (below parking garage)
  const groundY = INCIDENT_LANE_START + INCIDENT_LANES * INCIDENT_LANE_GAP + 30;
  drawBuilding(ctx, 10, groundY, 60, 80, 0.3);
  drawBuilding(ctx, 100, groundY, 40, 60, 0.3);
  drawTree(ctx, 160, groundY, 25, 0.3);
  drawBuilding(ctx, w - 180, groundY, 50, 70, 0.3);
  drawBuilding(ctx, w - 100, groundY, 35, 50, 0.3);
  drawTree(ctx, w - 220, groundY, 22, 0.3);
}

// Traffic light (green, right end of highway)
function drawTrafficLight(ctx: CanvasRenderingContext2D) {
  const x = ctx.canvas.width - 60;
  const y = MAIN_LANE_TOP + 5;
  const poleHeight = 30;

  // Pole
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - poleHeight);
  ctx.stroke();

  // Housing
  ctx.fillStyle = '#222222';
  ctx.fillRect(x - 6, y - poleHeight - 16, 12, 16);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6, y - poleHeight - 16, 12, 16);

  // Green light (permanently on)
  ctx.fillStyle = '#00ff00';
  ctx.beginPath();
  ctx.arc(x, y - poleHeight - 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = '#00ff00';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Off‑ramp – short single‑lane road branching from the left
function drawOffRamp(ctx: CanvasRenderingContext2D) {
  const entryX = OFF_RAMP_SPLIT_X;
  const entryY = MAIN_LANE_Y;
  // Exit coordinates: a point inside the parking garage
  const exitX = entryX + 130;
  const exitY = INCIDENT_LANE_START + INCIDENT_LANE_GAP * 2.5; // mid‑parking

  const rampPath = buildRampPath(entryX, entryY, exitX, exitY);
  if (rampPath.length < 2) return;

  const roadWidth = 36; // single lane

  // Compute edges
  const leftPoints: Point[] = [];
  const rightPoints: Point[] = [];
  for (let i = 0; i < rampPath.length; i++) {
    const pt = rampPath[i];
    let dirX = 0, dirY = -1;
    if (i < rampPath.length - 1) {
      dirX = rampPath[i + 1].x - pt.x;
      dirY = rampPath[i + 1].y - pt.y;
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len > 0) { dirX /= len; dirY /= len; }
    } else if (i > 0) {
      dirX = pt.x - rampPath[i - 1].x;
      dirY = pt.y - rampPath[i - 1].y;
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len > 0) { dirX /= len; dirY /= len; }
    }
    const perpX = -dirY;
    const perpY = dirX;
    const halfW = roadWidth / 2;
    leftPoints.push({ x: pt.x + perpX * halfW, y: pt.y + perpY * halfW });
    rightPoints.push({ x: pt.x - perpX * halfW, y: pt.y - perpY * halfW });
  }

  // Road surface
  ctx.beginPath();
  ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
  for (const p of leftPoints) ctx.lineTo(p.x, p.y);
  for (let i = rightPoints.length - 1; i >= 0; i--) ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
  ctx.closePath();
  ctx.fillStyle = '#2a2a2a';
  ctx.fill();
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Dashed centre line
  ctx.strokeStyle = '#ffffff88';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(rampPath[0].x, rampPath[0].y);
  for (let i = 1; i < rampPath.length; i++) ctx.lineTo(rampPath[i].x, rampPath[i].y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Guardrails
  ctx.strokeStyle = '#ffffffaa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
  for (let i = 1; i < leftPoints.length; i++) ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rightPoints[0].x, rightPoints[0].y);
  for (let i = 1; i < rightPoints.length; i++) ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
  ctx.stroke();

  // Arrow at exit
  const last = rampPath[rampPath.length - 1];
  const prev = rampPath[rampPath.length - 2];
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const arrowSize = 10;
  ctx.save();
  ctx.translate(last.x, last.y);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffffffaa';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-arrowSize, -arrowSize / 2);
  ctx.lineTo(-arrowSize, arrowSize / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Parking garage – compact, on the left side
function drawParkingGarage(ctx: CanvasRenderingContext2D) {
  const x = 0;
  const w = PARKING_WIDTH;
  const startY = INCIDENT_LANE_START - 8;
  const endY = INCIDENT_LANE_START + INCIDENT_LANES * INCIDENT_LANE_GAP + 8;

  // Background
  ctx.fillStyle = '#111122';
  ctx.fillRect(x, startY, w, endY - startY);

  // Border
  ctx.strokeStyle = '#ffffff33';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, startY, w, endY - startY);

  // Label
  ctx.fillStyle = '#ffffff99';
  ctx.font = 'bold 10px "Courier New"';
  ctx.fillText('PARKING', x + 8, startY - 4);

  // Parking lanes (horizontal lines)
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 1;
  for (let i = 0; i < INCIDENT_LANES; i++) {
    const y = INCIDENT_LANE_START + i * INCIDENT_LANE_GAP;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Stall dividers (short vertical ticks)
    for (let stallX = x + 10; stallX < x + w - 10; stallX += 50) {
      ctx.beginPath();
      ctx.moveTo(stallX, y - 8);
      ctx.lineTo(stallX, y + 8);
      ctx.stroke();
    }
  }

  // Connection from off‑ramp to garage (a small opening)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(OFF_RAMP_SPLIT_X + 100, startY - 2, 20, endY - startY + 4);
}

// ---------- Main background composition ----------
export function drawHighwayBackground(ctx: CanvasRenderingContext2D) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Day sky
  drawSky(ctx);

  // Ground (below highway, including parking area)
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, MAIN_LANE_BOTTOM, w, h - MAIN_LANE_BOTTOM);

  // Distant buildings and trees
  drawDistantSkyline(ctx);

  // Main highway surface
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, MAIN_LANE_TOP, w, MAIN_LANE_BOTTOM - MAIN_LANE_TOP);

  // Highway boundaries
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, MAIN_LANE_TOP);
  ctx.lineTo(w, MAIN_LANE_TOP);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, MAIN_LANE_BOTTOM);
  ctx.lineTo(w, MAIN_LANE_BOTTOM);
  ctx.stroke();

  // Dashed centre line (now left‑to‑right direction)
  ctx.strokeStyle = '#ffffff55';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 15]);
  ctx.beginPath();
  ctx.moveTo(0, MAIN_LANE_Y);
  ctx.lineTo(w, MAIN_LANE_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Off‑ramp (splitting on the left)
  drawOffRamp(ctx);

  // Parking garage (left side)
  drawParkingGarage(ctx);

  // Traffic light (right side)
  drawTrafficLight(ctx);
}

// ---------- Vehicle drawing (with error labels) ----------
export function drawVehicles(ctx: CanvasRenderingContext2D) {
  for (const v of vehicles) {
    if (v.opacity <= 0) continue;
    ctx.globalAlpha = v.opacity;
    const color = v.severity === 'INFO' ? '#39ff14' :
                  v.severity === 'WARN' ? '#ffea00' :
                  v.severity === 'ERROR' ? '#ff3300' : '#ff0040';

    const labelText = v.phase === 'parked' ? v.label : v.message;
    const displayText = v.phase === 'parked'
      ? `[${v.label}]`
      : (v.message.length > 25 ? v.message.slice(0, 23) + '…' : v.message);

    // Dynamic width based on text
    ctx.font = 'bold 11px "Courier New"';
    const textWidth = ctx.measureText(displayText).width + 20;
    const width = Math.min(140, Math.max(80, textWidth));
    const height = 26;
    const x = v.x - width / 2;
    const y = v.y - height / 2;

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();

    // Inner dark
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, width - 4, height - 4, 5);
    ctx.fill();

    // Text
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, v.x, v.y);

    // Severity indicator dot
    ctx.beginPath();
    ctx.arc(v.x - width / 2 - 6, v.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

// roundRect polyfill
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x: number, y: number, w: number, h: number, r: number
  ) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}