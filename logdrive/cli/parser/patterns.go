package parser

// Instead of regex, we build a trie from these keywords.
// Each keyword maps to its severity and event type.
var severityKeywords = map[string]struct {
	Sev shared.Severity
	Typ string
}{
	"fatal":              {FATAL, "fatal"},
	"panic":              {FATAL, "panic"},
	"kernel panic":       {FATAL, "kernel_panic"},
	"crash":              {FATAL, "crash"},
	"abort":              {FATAL, "abort"},
	"segfault":           {FATAL, "segfault"},
	"timeout":            {ERROR, "timeout"},
	"connection refused": {ERROR, "connection_refused"},
	"error":              {ERROR, "error"},
	"failed":             {ERROR, "failure"},
	"failure":            {ERROR, "failure"},
	"denied":             {ERROR, "denied"},
	"exception":          {ERROR, "exception"},
	"traceback":          {ERROR, "traceback"},
	"stack trace":        {ERROR, "stack_trace"},
	"retry":              {WARN, "retry"},
	"retrying":           {WARN, "retry"},
	"warning":            {WARN, "warning"},
	"deprecated":         {WARN, "deprecated"},
	"slow":               {WARN, "slow"},
	"high":               {WARN, "high_usage"},
	"info":               {INFO, "info"},
	"success":            {INFO, "success"},
	"successfully":       {INFO, "success"},
	"connected":          {INFO, "connected"},
	"started":            {INFO, "started"},
	"listening":          {INFO, "listening"},
	"ready":              {INFO, "ready"},
	"completed":          {INFO, "completed"},
}