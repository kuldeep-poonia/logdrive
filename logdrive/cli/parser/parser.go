package parser

import (
	"bytes"
	"strings"
	"sync"
	"time"

	"logdrive/shared"
)

var (
	// Comprehensive ANSI + terminal escape stripping.
	reANSI = regexp.MustCompile(`\x1b\[[0-9;:?]*[ABCDEFGHJKSTfmnsulh]|\x1b\][^\a]*(?:\x07|\x1b\\)|\x1b[()][0-9]|\x1b[7-8]|\x1bc|\x1b\[[0-9;]*[!"#$%&'()*+,\-./]?`)

	// Service extraction: starts with a letter, optional slash, then colon.
	reService = regexp.MustCompile(`^([a-zA-Z][a-zA-Z0-9_.-]*(?:\/[a-zA-Z][a-zA-Z0-9_.-]*)?)\s*:\s`)
)

// lineBufPool reuses buffers for building cleaned lines.
var lineBufPool = sync.Pool{
	New: func() interface{} {
		return new(bytes.Buffer)
	},
}

// multilineBuf collects continuation lines for stack traces.
var multilineBufPool = sync.Pool{
	New: func() interface{} {
		return new(bytes.Buffer)
	},
}

// ParseLine converts a raw PTY line into a RuntimeEvent, or aggregates multiline.
// It returns nil if the line is blank after cleaning.
func ParseLine(raw string, last *shared.RuntimeEvent) *shared.RuntimeEvent {
	rawBytes := []byte(raw)
	cleanBuf := lineBufPool.Get().(*bytes.Buffer)
	cleanBuf.Reset()
	defer lineBufPool.Put(cleanBuf)

	// 1. Strip ANSI / control sequences
	clean := stripANSI(rawBytes)
	clean = bytes.TrimSpace(clean)
	if len(clean) == 0 {
		return nil
	}
	cleanBuf.Write(clean)

	// 2. Extract service prefix
	service := ""
	if m := reService.FindSubmatchIndex(cleanBuf.Bytes()); m != nil {
		service = string(cleanBuf.Bytes()[m[2]:m[3]])
		// cut off the matched prefix
		rest := cleanBuf.Bytes()[m[1]:] // m[1] is end of full match
		cleanBuf.Reset()
		cleanBuf.Write(bytes.TrimSpace(rest))
	}
	cleanMsg := cleanBuf.Bytes()

	// 3. Multiline aggregation
	if last != nil && isContinuationLine(cleanMsg) {
		// Append to previous event
		mlBuf := multilineBufPool.Get().(*bytes.Buffer)
		mlBuf.Reset()
		mlBuf.WriteString(last.Message)
		mlBuf.WriteByte('\n')
		mlBuf.Write(cleanMsg)
		last.Message = mlBuf.String()
		last.Raw = last.Raw + "\n" + raw
		multilineBufPool.Put(mlBuf)
		return nil // updated existing event
	}

	// 4. Classify
	sev, typ := classifyFallback(cleanMsg)

	// 5. Build event
	ev := &shared.RuntimeEvent{
		Timestamp: time.Now(),
		Raw:       raw,
		Message:   string(cleanMsg),
		Severity:  sev,
		Service:   service,
		EventType: typ,
		Metadata:  nil,
	}
	return ev
}

// isContinuationLine returns true if the line appears to be part of a trace.
func isContinuationLine(line []byte) bool {
	if len(line) == 0 {
		return false
	}
	// Starts with whitespace
	if line[0] == ' ' || line[0] == '\t' {
		return true
	}
	// or starts with a known stack frame prefix (goroutine, panic:, etc.)
	lower := toLowerBytes(line)
	defer byteLowerPool.Put(lower) // recycle after use
	if bytes.HasPrefix(lower, []byte("goroutine ")) || bytes.HasPrefix(lower, []byte("panic:")) || bytes.HasPrefix(lower, []byte("[0x")) {
		return true
	}
	return false
}

func stripANSI(s []byte) []byte {
	return reANSI.ReplaceAll(s, nil)
}