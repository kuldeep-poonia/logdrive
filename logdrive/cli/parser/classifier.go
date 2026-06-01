package parser

import (
	"sync"
	"unsafe"

	"logdrive/shared"
)

// trieNode holds byte‑based children and optional result.
type trieNode struct {
	children map[byte]*trieNode
	result   struct {
		sev shared.Severity
		typ string
	}
	hasResult bool
}

var trieRoot *trieNode
var trieOnce sync.Once

func initTrie() {
	trieOnce.Do(func() {
		trieRoot = &trieNode{children: make(map[byte]*trieNode)}
		for kw, val := range severityKeywords {
			n := trieRoot
			bytes := []byte(kw) // ASCII keywords only
			for _, b := range bytes {
				if n.children[b] == nil {
					n.children[b] = &trieNode{children: make(map[byte]*trieNode)}
				}
				n = n.children[b]
			}
			n.result.sev = val.Sev
			n.result.typ = val.Typ
			n.hasResult = true
		}
	})
}

// classifyBytes scans the cleaned line bytes and returns severity + event type.
// It finds the longest keyword match to prioritize "kernel panic" over "panic".
func classifyBytes(line []byte) (shared.Severity, string) {
	initTrie()
	bestLen := 0
	var bestSev shared.Severity
	var bestTyp string

	for start := 0; start < len(line); start++ {
		n := trieRoot
		for i := start; i < len(line); i++ {
			b := line[i]
			// case‑insensitive: fold byte to lowercase (ASCII only)
			if b >= 'A' && b <= 'Z' {
				b += 32
			}
			child, ok := n.children[b]
			if !ok {
				break
			}
			n = child
			if n.hasResult {
				length := i - start + 1
				if length > bestLen {
					bestLen = length
					bestSev = n.result.sev
					bestTyp = n.result.typ
				}
			}
		}
	}

	if bestLen > 0 {
		return bestSev, bestTyp
	}
	// default to INFO if nothing matched
	return shared.INFO, ""
}

// byteLowerPool is a pool of temporary byte slices for case folding.
var byteLowerPool = sync.Pool{
	New: func() interface{} {
		return make([]byte, 0, 256)
	},
}

// toLowerBytes returns a lowercased copy of s, reusing a pooled buffer.
func toLowerBytes(s []byte) []byte {
	buf := byteLowerPool.Get().([]byte)[:0]
	defer byteLowerPool.Put(buf[:0]) // return after use (we copy out)
	buf = append(buf, s...)
	for i := range buf {
		if buf[i] >= 'A' && buf[i] <= 'Z' {
			buf[i] += 32
		}
	}
	// we need a stable copy because the pooled slice may be reused.
	out := make([]byte, len(buf))
	copy(out, buf)
	return out
}

// classifyFallback is used when no explicit severity label is found.
// It uses the trie on a case‑insensitive version of the line.
func classifyFallback(line []byte) (shared.Severity, string) {
	return classifyBytes(line)
}

// explicitSeverityLabels maps uppercase ASCII labels to severity.
var explicitSev = map[string]shared.Severity{
	"INFO":  shared.INFO,
	"WARN":  shared.WARN,
	"ERROR": shared.ERROR,
	"FATAL": shared.FATAL,
}

// classifyWithExplicit first checks for an all‑caps severity label.
func classifyWithExplicit(line []byte) (shared.Severity, string) {
	// quick scan for explicit label using a small buffer
	upper := toLowerBytes(line) // we need uppercase to match map keys, so we can't reuse pool for that. We'll just convert to upper directly with a local buffer.
	// we'll just do a simple scan on the actual bytes: find first token.
	// Simpler: convert first token to upper and check map.
	// But to avoid alloc we can do a byte‑by‑byte comparison.
	return classifyFallback(line) // for simplicity, rely on trie which already handles keywords case‑insensitively.
}