package parser

import (
	"bytes"
	"regexp"
	"sync"
	"time"

	"logdrive/cli/shared"
)

var (
	reANSI = regexp.MustCompile(`\x1b\[[0-9;:?]*[ABCDEFGHJKSTfmnsulh]|\x1b\][^\a]*(?:\x07|\x1b\\)|\x1b[()][0-9]|\x1b[7-8]|\x1bc|\x1b\[[0-9;]*[!"#$%&'()*+,\-./]?`)

	reService = regexp.MustCompile(`^([a-zA-Z][a-zA-Z0-9_.-]*(?:\/[a-zA-Z][a-zA-Z0-9_.-]*)?)\s*:`)

	lineBufPool = sync.Pool{New: func() any { return new(bytes.Buffer) }}
)

func ParseLine(raw string, last *shared.RuntimeEvent) *shared.RuntimeEvent {
	cleanBuf := lineBufPool.Get().(*bytes.Buffer)
	cleanBuf.Reset()
	defer lineBufPool.Put(cleanBuf)

	// strip ANSI & control chars
	clean := stripANSI([]byte(raw))
	clean = bytes.TrimSpace(clean)
	if len(clean) == 0 {
		return nil
	}
	cleanBuf.Write(clean)

	// extract optional service prefix like "payment-service:"
	service := ""
	if m := reService.FindSubmatchIndex(cleanBuf.Bytes()); m != nil {
		service = string(cleanBuf.Bytes()[m[2]:m[3]])
		rest := cleanBuf.Bytes()[m[1]:]
		cleanBuf.Reset()
		cleanBuf.Write(bytes.TrimSpace(rest))
	}
	cleanMsg := cleanBuf.Bytes()

	// multiline trace aggregation
	if last != nil && isContinuation(cleanMsg) {
		last.Message = last.Message + "\n" + string(cleanMsg)
		last.Raw = last.Raw + "\n" + raw
		return nil
	}

	sev, typ := classifyBytes(cleanMsg)

	return &shared.RuntimeEvent{
		Timestamp: time.Now(),
		Raw:       raw,
		Message:   string(cleanMsg),
		Severity:  sev,
		Service:   service,
		EventType: typ,
	}
}

func isContinuation(line []byte) bool {
	if len(line) == 0 {
		return false
	}
	if line[0] == ' ' || line[0] == '\t' {
		return true
	}
	lower := make([]byte, len(line))
	for i, b := range line {
		if b >= 'A' && b <= 'Z' {
			b += 32
		}
		lower[i] = b
	}
	return bytes.HasPrefix(lower, []byte("goroutine ")) ||
		bytes.HasPrefix(lower, []byte("panic:")) ||
		bytes.HasPrefix(lower, []byte("[0x"))
}

func stripANSI(s []byte) []byte {
	return reANSI.ReplaceAll(s, nil)
}