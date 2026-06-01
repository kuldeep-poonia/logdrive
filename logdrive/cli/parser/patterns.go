package parser

import "logdrive/cli/shared"

var severityKeywords = map[string]struct {
	Sev shared.Severity
	Typ string
}{
	"fatal":              {shared.FATAL, "fatal"},
	"panic":              {shared.FATAL, "panic"},
	"kernel panic":       {shared.FATAL, "kernel_panic"},
	"crash":              {shared.FATAL, "crash"},
	"abort":              {shared.FATAL, "abort"},
	"segfault":           {shared.FATAL, "segfault"},
	"timeout":            {shared.ERROR, "timeout"},
	"connection refused": {shared.ERROR, "connection_refused"},
	"error":              {shared.ERROR, "error"},
	"failed":             {shared.ERROR, "failure"},
	"failure":            {shared.ERROR, "failure"},
	"denied":             {shared.ERROR, "denied"},
	"exception":          {shared.ERROR, "exception"},
	"traceback":          {shared.ERROR, "traceback"},
	"stack trace":        {shared.ERROR, "stack_trace"},
	"retry":              {shared.WARN, "retry"},
	"retrying":           {shared.WARN, "retry"},
	"warning":            {shared.WARN, "warning"},
	"deprecated":         {shared.WARN, "deprecated"},
	"slow":               {shared.WARN, "slow"},
	"high":               {shared.WARN, "high_usage"},
	"info":               {shared.INFO, "info"},
	"success":            {shared.INFO, "success"},
	"successfully":       {shared.INFO, "success"},
	"connected":          {shared.INFO, "connected"},
	"started":            {shared.INFO, "started"},
	"listening":          {shared.INFO, "listening"},
	"ready":              {shared.INFO, "ready"},
	"completed":          {shared.INFO, "completed"},
}