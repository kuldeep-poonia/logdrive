package stream

import (
	"sync"
	"sync/atomic"

	"logdrive/cli/shared"
)

type Subscription struct {
	ID     uint64
	Ch     <-chan *shared.RuntimeEvent
	unsub  func()
	closed int32 // atomically accessed, prevents double‑close
}

func (s *Subscription) Unsubscribe() {
	if atomic.CompareAndSwapInt32(&s.closed, 0, 1) {
		if s.unsub != nil {
			s.unsub()
		}
	}
}

type subscriber struct {
	ch     chan *shared.RuntimeEvent
	once   sync.Once // ensures channel closed exactly once
}

// subscriberSlicePool reuses slices for Publish fan‑out, avoiding allocations.
var subscriberSlicePool = sync.Pool{
	New: func() any {
		s := make([]*subscriber, 0, 16)
		return &s
	},
}

type Broadcaster struct {
	mu     sync.Mutex
	subs   map[uint64]*subscriber
	nextID uint64
	closed int32
}

func NewBroadcaster() *Broadcaster {
	return &Broadcaster{
		subs: make(map[uint64]*subscriber),
	}
}

func (b *Broadcaster) Subscribe(bufSize int) *Subscription {
	if bufSize < 1 {
		bufSize = 1
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	if atomic.LoadInt32(&b.closed) == 1 {
		ch := make(chan *shared.RuntimeEvent)
		close(ch)
		return &Subscription{Ch: ch}
	}

	id := b.nextID
	b.nextID++

	ch := make(chan *shared.RuntimeEvent, bufSize)
	sub := &subscriber{ch: ch}
	b.subs[id] = sub

	var once sync.Once
	unsub := func() {
		once.Do(func() {
			b.mu.Lock()
			if _, ok := b.subs[id]; ok {
				close(sub.ch)
				delete(b.subs, id)
			}
			b.mu.Unlock()
		})
	}

	return &Subscription{
		ID:    id,
		Ch:    ch,
		unsub: unsub,
	}
}

func (b *Broadcaster) Publish(ev *shared.RuntimeEvent) {
	if atomic.LoadInt32(&b.closed) == 1 {
		return
	}

	// Grab a reusable slice from the pool.
	subsPtr := subscriberSlicePool.Get().(*[]*subscriber)
	subs := (*subsPtr)[:0]
	defer func() {
		*subsPtr = subs
		subscriberSlicePool.Put(subsPtr)
	}()

	b.mu.Lock()
	for _, sub := range b.subs {
		subs = append(subs, sub)
	}
	b.mu.Unlock()

	for _, sub := range subs {
		select {
		case sub.ch <- ev:
		default:
			// slow consumer – drop event
		}
	}
}

func (b *Broadcaster) Close() {
	if !atomic.CompareAndSwapInt32(&b.closed, 0, 1) {
		return
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	for id, sub := range b.subs {
		sub.once.Do(func() {
			close(sub.ch)
		})
		delete(b.subs, id)
	}
}