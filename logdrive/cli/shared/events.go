
package shared

import "time"

type Severity int

const (
	UNKNOWN Severity = iota
	INFO
	WARN
	ERROR
	FATAL
)

func (s Severity) String() string {
	switch s {
	case INFO:
		return "INFO"
	case WARN:
		return "WARN"
	case ERROR:
		return "ERROR"
	case FATAL:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

type RuntimeEvent struct {
	Timestamp time.Time         `json:"timestamp"`
	Raw       string            `json:"raw"`
	Message   string            `json:"message"`
	Severity  Severity          `json:"severity"`
	Service   string            `json:"service,omitempty"`
	EventType string            `json:"event_type,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}