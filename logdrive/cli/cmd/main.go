package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"logdrive/cli/ingest"
	"logdrive/cli/parser"
	"logdrive/cli/shared"
	"logdrive/cli/stream"
)

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
			writeEvent(ev)
			os.Stdout.Sync()
		}
	}()

	fmt.Fprintln(os.Stderr, "LogDrive PTY session started. Type commands (Ctrl+C to exit).")

	var pending *shared.RuntimeEvent

	for {
		select {
		case line, ok := <-session.Lines():
			if !ok {
				// PTY closed – publish any pending event
				if pending != nil {
					publishEvent(ringBuf, bcast, pending)
				}
				goto shutdown
			}
			ev := parser.ParseLine(line, pending)
			if ev == nil {
				// line was a continuation → pending has been updated in place
				continue
			}
			// A new independent event started.
			// If we were building a previous event, publish it now.
			if pending != nil && ev != pending {
				publishEvent(ringBuf, bcast, pending)
			}
			pending = ev

		case <-ctx.Done():
			// interrupted – publish pending event and exit
			if pending != nil {
				publishEvent(ringBuf, bcast, pending)
			}
			goto shutdown
		}
	}

shutdown:
	outSub.Unsubscribe()
	bcast.Close()
	wg.Wait()
}

func publishEvent(rb *stream.RingBuffer, bc *stream.Broadcaster, ev *shared.RuntimeEvent) {
	rb.Push(ev)
	bc.Publish(ev)
}

func writeEvent(ev *shared.RuntimeEvent) {
	if ev.Service != "" {
		fmt.Printf("[%s] %s %s\n", ev.Severity, ev.Service, ev.Message)
	} else {
		fmt.Printf("[%s] %s\n", ev.Severity, ev.Message)
	}
}