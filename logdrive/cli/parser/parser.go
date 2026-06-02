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

	reBracketLabel = regexp.MustCompile(`^\[([A-Za-z0-9_.-]+)\]\s*`)

	lineBufPool = sync.Pool{New: func() any { return new(bytes.Buffer) }}
)

// ParseLine converts a raw log line into a RuntimeEvent.
// It does NOT aggregate multiline traces – each line is an independent event.
func ParseLine(raw string) *shared.RuntimeEvent {
	cleanBuf := lineBufPool.Get().(*bytes.Buffer)
	cleanBuf.Reset()
	defer lineBufPool.Put(cleanBuf)

	clean := stripANSI([]byte(raw))
	clean = bytes.TrimSpace(clean)
	if len(clean) == 0 {
		return nil
	}
	cleanBuf.Write(clean)

	service := ""
	if m := reBracketLabel.FindSubmatchIndex(cleanBuf.Bytes()); m != nil {
		service = string(cleanBuf.Bytes()[m[2]:m[3]])
		rest := cleanBuf.Bytes()[m[1]:]
		cleanBuf.Reset()
		cleanBuf.Write(bytes.TrimSpace(rest))
	} else if m := reService.FindSubmatchIndex(cleanBuf.Bytes()); m != nil {
		service = string(cleanBuf.Bytes()[m[2]:m[3]])
		rest := cleanBuf.Bytes()[m[1]:]
		cleanBuf.Reset()
		cleanBuf.Write(bytes.TrimSpace(rest))
	}
	cleanMsg := cleanBuf.Bytes()

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

func stripANSI(s []byte) []byte {
	return reANSI.ReplaceAll(s, nil)
}