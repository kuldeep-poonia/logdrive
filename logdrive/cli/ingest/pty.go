package ingest

import (
	"bufio"
	"bytes"
	"context"
	"os"
	"os/exec"
	"os/signal"
	"strings"
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
func (s *PTYSession) Pty() *os.File        { return s.ptyFile }

func NewPTYSession(ctx context.Context, shell string) (*PTYSession, error) {
	if shell == "" {
		shell = "/bin/bash"
	}

	// Start a clean, prompt‑less interactive shell with echo disabled.
	// The wrapper script sets PS1 to empty, suppresses bash startup files,
	// turns off terminal echo, and finally execs the desired shell.
	cmd := exec.Command("/bin/bash", "-c",
		`export PS1=; stty -echo; exec bash --norc --noprofile`)
	cmd.Env = os.Environ()

	ptyFile, err := pty.Start(cmd)
	if err != nil {
		return nil, err
	}

	// Set an initial sensible terminal size.
	if err := pty.Setsize(ptyFile, &pty.Winsize{Rows: 24, Cols: 80}); err != nil {
		ptyFile.Close()
		return nil, err
	}

	ctx, cancel := context.WithCancel(ctx)
	s := &PTYSession{
		cmd:     cmd,
		ptyFile: ptyFile,
		lines:   make(chan string, 128),
		done:    make(chan struct{}),
		cancel:  cancel,
	}

	go s.readLines(ctx)
	go s.handleResize(ctx, ptyFile.Fd())

	return s, nil
}

func (s *PTYSession) readLines(ctx context.Context) {
	defer close(s.done)
	defer s.ptyFile.Close()

	reader := bufio.NewReaderSize(s.ptyFile, 64*1024)
	var buf bytes.Buffer

	for {
		line, err := readLongLine(reader, &buf)
		if line != "" {
			// Remove trailing carriage return for clean output.
			line = strings.TrimSuffix(line, "\r")
			if line != "" {
				select {
				case s.lines <- line:
				case <-ctx.Done():
					return
				}
			}
		}
		if err != nil {
			return
		}
	}
}

func readLongLine(r *bufio.Reader, buf *bytes.Buffer) (string, error) {
	buf.Reset()
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
		go func() {
			s.cmd.Wait()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			_ = s.cmd.Process.Kill()
			<-done
		}
	}
	<-s.done
}