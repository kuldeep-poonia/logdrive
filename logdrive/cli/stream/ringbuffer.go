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

func (rb *RingBuffer) Push(ev *shared.RuntimeEvent) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	// Explicitly nil the overwritten slot to help GC.
	if rb.full {
		rb.buf[rb.head] = nil
	}

	rb.buf[rb.tail] = ev
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
			clone := *orig // value copy (Metadata is nil, safe)
			snap[i] = &clone
		}
	}
	return snap
}