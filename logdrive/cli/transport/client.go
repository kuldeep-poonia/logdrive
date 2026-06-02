package transport

import (
	"encoding/json"
	"sync"
	"time"

	"logdrive/cli/shared"

	"github.com/gorilla/websocket"
)

const (
	outboundBufferSize = 64
	writeWait          = 10 * time.Second
	pongWait           = 60 * time.Second
	pingPeriod         = (pongWait * 9) / 10
	maxMessageSize     = 512
)

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
	once sync.Once
}

func NewClient(conn *websocket.Conn, hub *Hub) *Client {
	c := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, outboundBufferSize),
	}
	go c.writePump()
	go c.readPump()
	return c
}

func (c *Client) Send(data []byte) {
	select {
	case c.send <- data:
	default:
	}
}

func (c *Client) Disconnect() {
	c.once.Do(func() {
		close(c.send)
		c.conn.Close()
	})
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Disconnect()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.Unregister(c)
		c.Disconnect()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func marshalEvent(ev *shared.RuntimeEvent) ([]byte, error) {
	payload := struct {
		Timestamp string `json:"timestamp"`
		Severity  string `json:"severity"`
		Message   string `json:"message"`
		Service   string `json:"service,omitempty"`
		EventType string `json:"event_type,omitempty"`
	}{
		Timestamp: ev.Timestamp.UTC().Format(time.RFC3339Nano),
		Severity:  ev.Severity.String(),
		Message:   ev.Message,
		Service:   ev.Service,
		EventType: ev.EventType,
	}
	return json.Marshal(payload)
}