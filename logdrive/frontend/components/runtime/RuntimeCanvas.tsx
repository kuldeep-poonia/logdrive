'use client';

import React, { useRef, useEffect } from 'react';
import { Application, Container } from 'pixi.js';
import { createPixiApp } from '@/engine/renderer';
import { RealtimeWebSocket } from '@/engine/websocket';
import { EventQueue } from '@/engine/eventQueue';
import { VehicleFactory } from '@/engine/vehicleFactory';
import { AnimationLoop } from '@/engine/animationLoop';
import { createTrafficLane } from './TrafficLane';
import { useRuntimeStore } from '@/store/runtimeStore';

export default function RuntimeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const wsRef = useRef<RealtimeWebSocket | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const app = createPixiApp(canvasRef.current);
    appRef.current = app;

    const rootContainer = new Container();
    app.stage.addChild(rootContainer);
    // Add lanes
    const laneYs = [120, 220, 320, 420, 520];
    laneYs.forEach(y => rootContainer.addChild(createTrafficLane(y, app.screen.width)));

    const eventQueue = new EventQueue();
    const vehicleFactory = new VehicleFactory(rootContainer);
    const animLoop = new AnimationLoop(app, vehicleFactory, eventQueue);
    animLoop.start();

    // WebSocket connection
    const ws = new RealtimeWebSocket('ws://localhost:8080/ws', (events) => {
      eventQueue.push(events);
    });
    wsRef.current = ws;

    // Replay integration: when replay is enabled and playing, we feed events from store into queue
    let replayInterval: ReturnType<typeof setInterval> | null = null;
    const unsub = useRuntimeStore.subscribe((state) => {
      if (state.replay.enabled && state.replay.isPlaying) {
        if (!replayInterval) {
          replayInterval = setInterval(() => {
            const { replay, replayNextEvent } = useRuntimeStore.getState();
            if (replay.currentIndex < replay.events.length) {
              const ev = replay.events[replay.currentIndex];
              eventQueue.pushOne(ev);
              replayNextEvent();
            } else {
              useRuntimeStore.getState().pauseReplay();
            }
          }, 500); // replay speed
        }
      } else {
        if (replayInterval) {
          clearInterval(replayInterval);
          replayInterval = null;
        }
      }
    });

    return () => {
      ws.close();
      if (replayInterval) clearInterval(replayInterval);
      unsub();
      app.destroy(true, { children: true });
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
}