package ingest

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"
)

type PTYSession struct {
	cmd     *exec.Cmd
	ptyFile *os.File
	lines   chan string
	done    chan struct{}
	cancel  context.CancelFunc
}

func (s *PTYSession) Lines() <-chan string { return s.lines }
func (s *PTYSession) Pty() *os.File       { return s.ptyFile }

// ringBufSize must be a power of two for the lock‑free mask.
const ringBufSize = 256

// ringBuffer is a simple channel‑based drop‑oldest queue.
type ringBuffer struct {
	ch      chan string
	done    chan struct{}
	overflow chan struct{}
	mu       sync.Mutex
	closing  bool
}

func newRingBuffer() *ringBuffer {
	rb := &ringBuffer{
		ch:      make(chan string, ringBufSize),
		overflow: make(chan struct{}, 1),
	}
	return rb
}

// Enqueue pushes a line. If full, drops the oldest and signals overflow.
func (rb *ringBuffer) Enqueue(line string) {
	select {
	case rb.ch <- line:
		return
	default:
		// channel full → drop oldest
		select {
		case <-rb.ch:
			// successfully dropped oldest
		default:
		}
		// now try again to enqueue
		select {
		case rb.ch <- line:
		default:
			// still full? extremely unlikely, discard line
		}
		// non‑blocking signal overflow
		select {
		case rb.overflow <- struct{}{}:
		default:
		}
	}
}

// Dequeue returns a channel that closes when the buffer is drained.
func (rb *ringBuffer) Dequeue(ctx context.Context) <-chan string {
	out := make(chan string)
	go func() {
		defer close(out)
		for {
			select {
			case line, ok := <-rb.ch:
				if !ok {
					return
				}
				select {
				case out <- line:
				case <-ctx.Done():
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	return out
}

// NewPTYSession starts a shell with PTY, echo off, resize support.
func NewPTYSession(ctx context.Context, shell string) (*PTYSession, error) {
	if shell == "" {
		shell = "/bin/bash"
	}

	cmd := exec.Command(shell)
	cmd.Env = os.Environ()

	ptyFile, ttyFile, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: 24, Cols: 80})
	if err != nil {
		return nil, err
	}
	if err := setNoEcho(ttyFile); err != nil {
		ttyFile.Close()
		ptyFile.Close()
		return nil, fmt.Errorf("setNoEcho: %w", err)
	}
	ttyFile.Close()

	ctx, cancel := context.WithCancel(ctx)
	s := &PTYSession{
		cmd:     cmd,
		ptyFile: ptyFile,
		lines:   make(chan string, 1), // actually we'll use ringBuffer
		done:    make(chan struct{}),
		cancel:  cancel,
	}

	rb := newRingBuffer()
	go s.readLines(ctx, rb)
	go s.handleResize(ctx, ptyFile.Fd())

	// The public Lines() channel is replaced by the ring buffer's output.
	// We'll bridge: rb.Dequeue(ctx) feeds a new channel, but we need to return it.
	// Since main expects a simple channel, we'll store it and set s.lines to the output.
	s.lines = rb.Dequeue(ctx)

	// overflow warning goroutine
	go func() {
		for {
			select {
			case <-rb.overflow:
				select {
				case s.lines <- "[WARN] logdrive: ring buffer overflow, dropping oldest line":
				default:
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	return s, nil
}

// readLines reads from PTY into ring buffer.
func (s *PTYSession) readLines(ctx context.Context, rb *ringBuffer) {
	defer close(s.done)
	defer s.ptyFile.Close()

	reader := bufio.NewReaderSize(s.ptyFile, 64*1024) // 64KB buffer
	bufPool := sync.Pool{
		New: func() interface{} { return new(bytes.Buffer) },
	}

	for {
		line, err := readLine(reader, bufPool)
		if line != "" {
			rb.Enqueue(line)
		}
		if err != nil {
			return
		}
		select {
		case <-ctx.Done():
			return
		default:
		}
	}
}

// readLine reuses a pooled buffer.
func readLine(r *bufio.Reader, pool sync.Pool) (string, error) {
	buf := pool.Get().(*bytes.Buffer)
	buf.Reset()
	defer pool.Put(buf)

	for {
		part, isPrefix, err := r.ReadLine()
		if len(part) > 0 {
			buf.Write(part)
		}
		if !isPrefix {
			return buf.String(), err
		}
		if err != nil {
			return buf.String(), err
		}
	}
}

func (s *PTYSession) handleResize(ctx context.Context, fd uintptr) {
	sigwinch := make(chan os.Signal, 1)
	signal.Notify(sigwinch, syscall.SIGWINCH)
	defer signal.Stop(sigwinch)

	for {
		select {
		case <-sigwinch:
			ws, err := pty.GetsizeFull(os.Stdin)
			if err == nil {
				_ = pty.Setsize(s.ptyFile, &pty.Winsize{Rows: ws.Rows, Cols: ws.Cols})
			}
		case <-ctx.Done():
			return
		}
	}
}

func (s *PTYSession) Close() {
	s.cancel()
	if s.cmd.Process != nil {
		_ = s.cmd.Process.Signal(syscall.SIGTERM)
		done := make(chan struct{})
		go func() { s.cmd.Wait(); close(done) }()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			_ = s.cmd.Process.Kill()
			<-done
		}
	}
	<-s.done
}

func setNoEcho(f *os.File) error {
	fd := int(f.Fd())
	termios, err := syscall.IoctlGetTermios(fd, syscall.TCGETS)
	if err != nil {
		return err
	}
	termios.Lflag &^= syscall.ECHO
	return syscall.IoctlSetTermios(fd, syscall.TCSETS, termios)
}