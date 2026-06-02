package transport

import (
	"sync"

	"logdrive/cli/shared"
	"logdrive/cli/stream"
)

type Hub struct {
	broadcaster *stream.Broadcaster
	ringBuffer  *stream.RingBuffer
	sub         *stream.Subscription   // our subscription to the broadcaster

	clientsMu sync.RWMutex
	clients   map[*Client]struct{}
}

// NewHub creates a hub, subscribes to the broadcaster, and starts the event loop.
func NewHub(bc *stream.Broadcaster, rb *stream.RingBuffer) *Hub {
	sub := bc.Subscribe(256)
	h := &Hub{
		broadcaster: bc,
		ringBuffer:  rb,
		sub:         sub,
		clients:     make(map[*Client]struct{}),
	}
	go h.run(sub.Ch)
	return h
}

// run fans out live events to all connected clients.
// It exits when the liveEvents channel is closed (broadcaster stopped or we unsubscribe).
func (h *Hub) run(liveEvents <-chan *shared.RuntimeEvent) {
	defer h.disconnectAllClients()
	for ev := range liveEvents {
		data, err := marshalEvent(ev)
		if err != nil {
			continue
		}
		h.clientsMu.RLock()
		for c := range h.clients {
			c.Send(data)
		}
		h.clientsMu.RUnlock()
	}
}

// disconnectAllClients closes all clients and clears the map.
func (h *Hub) disconnectAllClients() {
	h.clientsMu.Lock()
	defer h.clientsMu.Unlock()
	for c := range h.clients {
		c.Disconnect()
		delete(h.clients, c)
	}
}

// Register adds a client and immediately sends the replay snapshot.
func (h *Hub) Register(client *Client) {
	h.clientsMu.Lock()
	h.clients[client] = struct{}{}
	h.clientsMu.Unlock()
	go h.sendReplay(client)
}

// Unregister removes a client and disconnects it.
func (h *Hub) Unregister(client *Client) {
	h.clientsMu.Lock()
	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		client.Disconnect()
	}
	h.clientsMu.Unlock()
}

func (h *Hub) sendReplay(client *Client) {
	snapshot := h.ringBuffer.Snapshot()
	for _, ev := range snapshot {
		data, err := marshalEvent(ev)
		if err != nil {
			continue
		}
		client.Send(data)
	}
}

// Close stops the hub, unsubscribes from the broadcaster, and disconnects all clients.
func (h *Hub) Close() {
	// Unsubscribe to stop the live event stream. This will close the channel
	// returned by Subscribe, causing the run goroutine to exit.
	h.sub.Unsubscribe()
}