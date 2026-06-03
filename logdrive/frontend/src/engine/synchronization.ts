/**
 * Deterministic highway spacing: each vehicle gets a fixed headway.
 * Older events are to the left, newer to the right.
 * The highway scrolls left, so older vehicles move leftwards faster?
 * Actually we want a continuous scrolling stream: vehicles travel from right to left.
 * To preserve order, we assign each vehicle an initial x based on its sequence number,
 * then scroll them left at the same speed. Newer vehicles start further right.
 */

const VEHICLE_GAP = 50; // pixels between consecutive vehicles (headway)
const SCROLL_SPEED = 2; // pixels per frame base

let highestSeqSpawned = 0;

export function getSpawnX(seq: number, canvasWidth: number): number {
  // The most recent vehicle starts at the right edge.
  // All vehicles shift left by SCROLL_SPEED each frame.
  // For a new vehicle with higher seq, place it at the right edge.
  highestSeqSpawned = Math.max(highestSeqSpawned, seq);
  // The offset from right edge is (highestSeq - seq) * VEHICLE_GAP
  const offset = (highestSeqSpawned - seq) * VEHICLE_GAP;
  return canvasWidth + 50 + offset; // start offscreen right, but offset ensures order
}

export function resetSync() {
  highestSeqSpawned = 0;
}

export { SCROLL_SPEED };