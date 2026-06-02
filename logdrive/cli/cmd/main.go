package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"logdrive/cli/parser"
	"logdrive/cli/shared"
	"logdrive/cli/stream"
	"golang.org/x/term"
)

const flushTimeout = 150 * time.Millisecond

func main() {
	// Put the terminal in raw mode: no echo, no line buffering, Ctrl‑C handled by us.
	oldState, err := term.MakeRaw(int(os.Stdin.Fd()))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to set raw terminal: %v\n", err)
		os.Exit(1)
	}
	defer term.Restore(int(os.Stdin.Fd()), oldState)

	// Ctrl‑C will be caught as a byte, not a signal. However, SIGINT can still
	// be delivered in some scenarios; we ignore it for safety.
	signal.Ignore(syscall.SIGINT)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM)
	defer stop()

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

	fmt.Fprintf(os.Stderr, "LogDrive memory engine active. Type log lines (Ctrl+C to quit).\r\n")
	fmt.Fprintf(os.Stderr, "Example: ERROR grpc timeout\r\n")

	// Read stdin byte by byte in raw mode.
	input := make(chan string, 1)
	go func() {
		buf := make([]byte, 1)
		var line []byte
		for {
			_, err := os.Stdin.Read(buf)
			if err != nil {
				close(input)
				return
			}
			b := buf[0]
			switch b {
			case 0x03: // Ctrl‑C → shut down
				stop()
				close(input)
				return
			case '\r', '\n': // Enter → send line
				if len(line) > 0 {
					input <- string(line)
					line = line[:0]
				}
			case 0x7f: // Backspace
				if len(line) > 0 {
					line = line[:len(line)-1]
					// Erase the last character from the terminal.
					fmt.Print("\b \b")
				}
			default:
				// Printable character – add to line, but do NOT echo.
				if b >= 32 {
					line = append(line, b)
				}
			}
		}
	}()

	var pending *shared.RuntimeEvent
	flushTimer := time.NewTimer(flushTimeout)
	flushTimer.Stop()

	for {
		select {
		case line, ok := <-input:
			if !ok {
				if pending != nil {
					publishEvent(ringBuf, bcast, pending)
				}
				goto shutdown
			}

			ev := parser.ParseLine(line, pending)
			if ev == nil {
				flushTimer.Reset(flushTimeout)
				continue
			}
			if pending != nil && ev != pending {
				publishEvent(ringBuf, bcast, pending)
			}
			pending = ev
			flushTimer.Reset(flushTimeout)

		case <-flushTimer.C:
			if pending != nil {
				publishEvent(ringBuf, bcast, pending)
				pending = nil
			}

		case <-ctx.Done():
			if pending != nil {
				publishEvent(ringBuf, bcast, pending)
			}
			goto shutdown
		}
	}

shutdown:
	flushTimer.Stop()
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
		fmt.Printf("[%s] %s %s\r\n", ev.Severity, ev.Service, ev.Message)
	} else {
		fmt.Printf("[%s] %s\r\n", ev.Severity, ev.Message)
	}
}