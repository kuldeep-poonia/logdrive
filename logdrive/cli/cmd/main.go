package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"logdrive/cli/parser"
	"logdrive/cli/shared"
	"logdrive/cli/stream"
	"logdrive/cli/transport"
)

const wsAddr = ":8080"

func main() {
	ctx, stop := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer stop()

	go func() {
	<-ctx.Done()
	os.Exit(0)
}()

	ringBuf := stream.NewRingBuffer(1000)
	bcast := stream.NewBroadcaster()

	outSub := bcast.Subscribe(64)

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
    defer wg.Done()

    for range outSub.Ch {
    }
}()

	hub := transport.NewHub(bcast, ringBuf)

	wsServer := transport.NewServer(wsAddr, hub)

	if err := wsServer.Start(); err != nil {
		log.Fatalf("WebSocket server failed: %v", err)
	}

	fmt.Fprintf(
		os.Stderr,
		"WebSocket server listening on %s\n",
		wsAddr,
	)

	fmt.Fprintf(
		os.Stderr,
		"LogDrive memory engine active. Type log lines (Ctrl+C to quit).\n",
	)

	scanner := bufio.NewScanner(os.Stdin)

inputLoop:
	for {
		select {
		case <-ctx.Done():
			break inputLoop

		default:
			if !scanner.Scan() {
				break inputLoop
			}

			line := scanner.Text()

			if line == "" {
				continue
			}

			// Prevent recursive self-ingestion.
			if line[0] == '[' {
				continue
			}

			ev := parser.ParseLine(line)
			if ev == nil {
				continue
			}

			// Deep-copy event before publishing.
			clone := *ev

			if ev.Metadata != nil {
				clone.Metadata = make(map[string]string, len(ev.Metadata))

				for k, v := range ev.Metadata {
					clone.Metadata[k] = v
				}
			}

			ringBuf.Push(&clone)
			bcast.Publish(&clone)
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "stdin scanner error: %v\n", err)
	}

	shutdownCtx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	_ = wsServer.Shutdown(shutdownCtx)

	hub.Close()

	outSub.Unsubscribe()

	bcast.Close()

	wg.Wait()
}

func writeEvent(ev *shared.RuntimeEvent) {
	if ev.Service != "" {
		fmt.Printf(
			"[%s] %s %s\n",
			ev.Severity,
			ev.Service,
			ev.Message,
		)
		return
	}

	fmt.Printf(
		"[%s] %s\n",
		ev.Severity,
		ev.Message,
	)
}