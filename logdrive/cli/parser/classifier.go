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

func classifyBytes(line []byte) (shared.Severity, string) {
	trieOnce.Do(func() { trieRoot = buildTrie() })

	bestLen := 0
	var bestSev shared.Severity
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
				if length > bestLen {
					bestLen = length
					bestSev = n.sev
					bestTyp = n.eventType
				}
			}
		}
		_, size := utf8.DecodeRune(line[start:])
		start += size
	}

	if bestLen > 0 {
		return bestSev, bestTyp
	}
	return shared.INFO, ""
}