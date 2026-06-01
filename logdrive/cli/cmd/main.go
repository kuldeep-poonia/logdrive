package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"logdrive/ingest"
	"logdrive/parser"
	"logdrive/shared"
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

	// Forward user input
	ingest.ForwardStdin(ctx, session.Pty())

	// Buffered stdout writer to avoid fmt.Printf in hot path
	out := bufio.NewWriterSize(os.Stdout, 16*1024)
	defer out.Flush()

	var lastEvent *shared.RuntimeEvent

	fmt.Fprintln(os.Stderr, "LogDrive PTY session started. Type commands (Ctrl+C to exit).")

	for {
		select {
		case line, ok := <-session.Lines():
			if !ok {
				return
			}
			event := parser.ParseLine(line, lastEvent)
			if event == nil {
				// multiline continuation updated lastEvent
				continue
			}
			// If the event is not a continuation, finalize last and start new.
			if lastEvent != nil && event != lastEvent {
				writeEvent(out, lastEvent)
			}
			lastEvent = event
		case <-ctx.Done():
			// flush the last event before exit
			if lastEvent != nil {
				writeEvent(out, lastEvent)
				out.Flush()
			}
			return
		}
	}
}

// writeEvent builds the output line without allocations by reusing a buffer.
var writeBuf = make([]byte, 0, 256)

func writeEvent(w *bufio.Writer, ev *shared.RuntimeEvent) {
	writeBuf = writeBuf[:0]
	writeBuf = append(writeBuf, '[')
	writeBuf = append(writeBuf, ev.Severity.String()...)
	writeBuf = append(writeBuf, ']')
	if ev.Service != "" {
		writeBuf = append(writeBuf, ' ')
		writeBuf = append(writeBuf, ev.Service...)
	}
	writeBuf = append(writeBuf, ' ')
	writeBuf = append(writeBuf, ev.Message...)
	writeBuf = append(writeBuf, '\n')
	w.Write(writeBuf)
}