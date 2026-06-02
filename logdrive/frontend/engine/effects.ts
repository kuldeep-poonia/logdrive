import { Container, Graphics } from 'pixi.js';
import { crashPool } from './pools';

// Simple screen shake effect
let shakeAmount = 0;
let shakeTarget: Container | null = null;

export function applyScreenShake(target: Container, intensity: number, duration: number) {
  shakeTarget = target;
  shakeAmount = intensity;
  setTimeout(() => {
    if (shakeTarget === target) {
      shakeAmount = 0;
    }
  }, duration);
}

export function updateShake(delta: number) {
  if (shakeAmount <= 0 || !shakeTarget) return;
  const dx = (Math.random() - 0.5) * shakeAmount;
  const dy = (Math.random() - 0.5) * shakeAmount;
  shakeTarget.x = dx;
  shakeTarget.y = dy;
  shakeAmount *= 0.95;
  if (shakeAmount < 0.01) shakeAmount = 0;
}