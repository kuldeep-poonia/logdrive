'use client';

import React, { useRef, useEffect } from 'react';
import { Application, Container } from 'pixi.js';
import { createPixiApp } from '@/engine/renderer';
import { RealtimeWebSocket } from '@/engine/websocket';
import { EventQueue } from '@/engine/eventQueue';
import { VehicleFactory } from '@/engine/vehicleFactory';
import { AnimationLoop } from '@/engine/animationLoop';
import { useRuntimeStore } from '@/store/runtimeStore';
import { RuntimeEvent } from '@/types/runtime';

export default function RuntimeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const wsRef = useRef<RealtimeWebSocket | null>(null);
  const eventQueueRef = useRef<EventQueue>(new EventQueue());
  const store = useRuntimeStore();

  useEffect(() => {
    if (!canvasRef.current) return;

    const app = createPixiApp(canvasRef.current);
    appRef.current = app;

    const container = new Container();
    app.stage.addChild(container);
    const vehicleFactory = new VehicleFactory(container);

    const animLoop = new AnimationLoop(app, vehicleFactory, eventQueueRef.current);
    animLoop.start();

    const ws = new RealtimeWebSocket(
      'ws://localhost:8080/ws',
      (event: RuntimeEvent) => {
        eventQueueRef.current.pushOne(event);
      },
      (replayEvents: RuntimeEvent[]) => {
        store.setReplayEvents(replayEvents);
      },
      (connected: boolean) => store.setConnected(connected)
    );
    wsRef.current = ws;

    return () => {
      ws.close();
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
}