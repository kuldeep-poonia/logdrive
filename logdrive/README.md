# LogDrive – Phase 1: Production‑Grade CLI Ingestion Foundation

LogDrive turns live terminal output into structured runtime events. This phase is **only** the backend CLI, built with:

- PTY‑based interactive shell (echo‑off, resize‑aware)
- unlimited line lengths, allocation‑free byte‑level classification
- multiline stack trace aggregation
- ring‑buffer backpressure, async pipeline
- zero `fmt.Printf` in hot path – buffered, reuse‑driven output

## Install

```bash
go mod tidy