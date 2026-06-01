package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"logdrive/cli/ingest"
	"logdrive/cli/parser"
	"logdrive/cli/shared"
)

func main() {
	// Prevent broken‑pipe crashes from Rust terminals/pagers.
	signal.Ignore(syscall.SIGPIPE)

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

	fmt.Fprintln(os.Stderr, "LogDrive PTY session started. Type commands (Ctrl+C to exit).")

	var last *shared.RuntimeEvent

	for {
		select {
		case line, ok := <-session.Lines():
			if !ok {
				return
			}
			ev := parser.ParseLine(line, last)
			if ev == nil {
				continue // multiline continuation updated `last`
			}
			if last != nil && ev != last {
				writeEvent(last)
			}
			last = ev
		case <-ctx.Done():
			if last != nil {
				writeEvent(last)
			}
			return
		}
	}
}

func writeEvent(ev *shared.RuntimeEvent) {
	if ev.Service != "" {
		_, err := fmt.Printf("[%s] %s %s\n", ev.Severity, ev.Service, ev.Message)
		if err != nil {
			os.Exit(0) // stdout closed, exit quietly
		}
	} else {
		_, err := fmt.Printf("[%s] %s\n", ev.Severity, ev.Message)
		if err != nil {
			os.Exit(0)
		}
	}
}