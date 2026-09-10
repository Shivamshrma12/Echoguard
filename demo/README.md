# EchoGuard Demo Video

This directory contains the official recorded demonstration video for EchoGuard:

- **Filename:** `EchoGuard_Demo.mp4`
- **Duration:** Under 4 minutes
- **Content:**
  1. Complete natural human utterance capture without premature sentence drops.
  2. Spoken response synthesis via official Rime neural voice (`coda:celeste`).
  3. Real-time automatic acoustic voice barge-in (0.13ms hardware pause).
  4. Monotonic Generation Fencing (`GEN-N` invalidated, `GEN-N+1` created).
  5. Stale delayed result rejection (HTTP 410 / `FENCED_REJECTED` with zero stale leaks).
