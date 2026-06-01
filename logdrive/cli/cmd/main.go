package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"logdrive/cli/ingest"
	"logdrive/cli/parser"
	"logdrive/cli/shared"
	"logdrive/cli/stream"
)

const flushTimeout = 100 * time.Millisecond

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}

	session, err := ingest.NewPTYSession(ctx, shell)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to start PTY: %v\n", err)
		os.Exit(1)
	}
	defer session.Close()

	ingest.ForwardStdin(ctx, session.Pty())

	ringBuf := stream.NewRingBuffer(1000)
	bcast := stream.NewBroadcaster()

	outSub := bcast.Subscribe(64)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for ev := range outSub.Ch {
			if err := writeEvent(ev); err != nil {
				return
			}
		}
	}()

	fmt.Fprintln(os.Stderr, "LogDrive PTY session started. Type commands (Ctrl+C to exit).")

	var last *shared.RuntimeEvent
	timer := time.NewTimer(flushTimeout)
	timer.Stop()

loop:
	for {
		select {
		case line, ok := <-session.Lines():
			if !ok {
				break loop
			}
			ev := parser.ParseLine(line, last)
			if ev == nil {
				timer.Reset(flushTimeout)
				continue
			}
			if last != nil && ev != last {
				publishEvent(ringBuf, bcast, last)
			}
			last = ev
			timer.Reset(flushTimeout)

		case <-timer.C:
			if last != nil {
				publishEvent(ringBuf, bcast, last)
				last = nil
			}

		case <-ctx.Done():
			break loop
		}
	}

	timer.Stop()
	if last != nil {
		publishEvent(ringBuf, bcast, last)
	}

	outSub.Unsubscribe()
	bcast.Close()
	wg.Wait()
}

func publishEvent(rb *stream.RingBuffer, bc *stream.Broadcaster, ev *shared.RuntimeEvent) {
	rb.Push(ev)
	bc.Publish(ev)
}

func writeEvent(ev *shared.RuntimeEvent) error {
	if ev.Service != "" {
		_, err := fmt.Printf("[%s] %s %s\n", ev.Severity, ev.Service, ev.Message)
		return err
	}
	_, err := fmt.Printf("[%s] %s\n", ev.Severity, ev.Message)
	return err
}