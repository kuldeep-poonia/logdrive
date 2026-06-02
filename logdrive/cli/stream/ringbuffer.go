package stream

import (
	"sync"

	"logdrive/cli/shared"
)

type RingBuffer struct {
	mu   sync.RWMutex
	buf  []*shared.RuntimeEvent
	head int
	tail int
	size int
	full bool
}

func NewRingBuffer(capacity int) *RingBuffer {
	if capacity < 1 {
		capacity = 1
	}
	return &RingBuffer{
		buf:  make([]*shared.RuntimeEvent, capacity),
		size: capacity,
	}
}

// Push stores a deep copy of the event so that subsequent modifications by the
// parser (e.g. multiline aggregation) do not corrupt history.
func (rb *RingBuffer) Push(ev *shared.RuntimeEvent) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	// Deep‑copy the event.
	clone := *ev
	if ev.Metadata != nil {
		clone.Metadata = make(map[string]string, len(ev.Metadata))
		for k, v := range ev.Metadata {
			clone.Metadata[k] = v
		}
	}

	// Overwrite oldest if full.
	if rb.full {
		rb.buf[rb.head] = nil
	}

	rb.buf[rb.tail] = &clone
	rb.tail = (rb.tail + 1) % rb.size

	if rb.full {
		rb.head = (rb.head + 1) % rb.size
	} else if rb.tail == rb.head {
		rb.full = true
	}
}

func (rb *RingBuffer) Len() int {
	rb.mu.RLock()
	defer rb.mu.RUnlock()
	return rb.lenLocked()
}

func (rb *RingBuffer) Capacity() int {
	return rb.size
}

func (rb *RingBuffer) lenLocked() int {
	if rb.full {
		return rb.size
	}
	if rb.tail >= rb.head {
		return rb.tail - rb.head
	}
	return rb.size - rb.head + rb.tail
}

func (rb *RingBuffer) Snapshot() []*shared.RuntimeEvent {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	count := rb.lenLocked()
	if count == 0 {
		return nil
	}
	snap := make([]*shared.RuntimeEvent, count)
	for i := 0; i < count; i++ {
		idx := (rb.head + i) % rb.size
		orig := rb.buf[idx]
		if orig != nil {
			clone := *orig
			if orig.Metadata != nil {
				clone.Metadata = make(map[string]string, len(orig.Metadata))
				for k, v := range orig.Metadata {
					clone.Metadata[k] = v
				}
			}
			snap[i] = &clone
		}
	}
	return snap
}