package parser

import (
	"sync"
	"unicode/utf8"

	"logdrive/cli/shared"
)

type trieNode struct {
	children  [256]*trieNode
	sev       shared.Severity
	eventType string
	isEnd     bool
}

var trieRoot *trieNode
var trieOnce sync.Once

func buildTrie() *trieNode {
	root := &trieNode{}
	for word, val := range severityKeywords {
		n := root
		for i := 0; i < len(word); i++ {
			b := word[i]
			if b >= 'A' && b <= 'Z' {
				b += 32
			}
			idx := int(b)
			if n.children[idx] == nil {
				n.children[idx] = &trieNode{}
			}
			n = n.children[idx]
		}
		n.sev = val.Sev
		n.eventType = val.Typ
		n.isEnd = true
	}
	return root
}

// classifyBytes returns the highest‑severity match found in the line.
// Within the same severity, longer matches are preferred.
func classifyBytes(line []byte) (shared.Severity, string) {
	trieOnce.Do(func() { trieRoot = buildTrie() })

	var bestSev shared.Severity = shared.UNKNOWN
	bestLen := 0
	var bestTyp string

	for start := 0; start < len(line); {
		n := trieRoot
		end := start
		for end < len(line) {
			b := line[end]
			if b >= 'A' && b <= 'Z' {
				b += 32
			}
			child := n.children[b]
			if child == nil {
				break
			}
			n = child
			end++
			if n.isEnd {
				length := end - start
				// Prefer higher severity; if equal, longer match wins.
				if n.sev > bestSev || (n.sev == bestSev && length > bestLen) {
					bestSev = n.sev
					bestLen = length
					bestTyp = n.eventType
				}
			}
		}
		_, size := utf8.DecodeRune(line[start:])
		start += size
	}

	if bestSev > shared.UNKNOWN {
		return bestSev, bestTyp
	}
	return shared.INFO, ""
}