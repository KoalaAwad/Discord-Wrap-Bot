# Deprecated: requirements document removed for minimal bot reset.

2. **Batch Buffer**
   - last 5 messages (server‑wide)
   - latest batch summary (top message sender within the batch)

### Storage

- Store as JSON objects in RxDB (in‑memory for now)

### Output (Short‑Term)

- A simple stats endpoint or command (e.g., `/stats` or `/wrap-mini`) that shows:
  - top message sender (total)
  - top reaction sender
  - top reaction receiver
  - most popular message

## Open Decisions

- Batch summary format (what to show from the last 5 messages)
- Whether to ignore bot users and bot channels (default: yes)
