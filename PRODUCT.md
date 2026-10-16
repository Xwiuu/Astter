# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

William Reis, a developer on Linux using this as his daily dictation and meeting-notes tool. He speaks into Wispr Flow-style capture for text and runs recorded meetings where he needs automatic transcription, summaries and action items without leaving the app.

## Product Purpose

A local clone of the Wispr Flow desktop experience: a hub app for dictation, scratchpad and history, plus an embedded Granola-style AI notetaker that records meetings, transcribes speakers, and produces summaries and next steps. Success means the notetaker feels like a faithful copy of Granola's look and works entirely inside the hub's Notetaker/Notes tab.

## Positioning

Native Linux dictation plus meeting recording and transcription integrated in one local hub — no cloud account, no separate recorder window, everything stored in a local SQLite memory.

## Operating Context

Electron shell (`tauri-client/`) serving the renderer at http://localhost:1420, launched via `launch-flow.sh`. The hub has Notetaker/Notes/Meetings tabs where the Granola view is embedded as an iframe. Meetings are stored in `memory/db.db` and `memory/meetings/`. Live recording flows through the `flowNative.meeting` IPC bridge (start/stop/status/transcript turns/speaker updates).

## Capabilities and Constraints

- Meeting recording, live transcript turns, speaker renaming and stored summaries/action items already exist via `flowNative.meeting` and `flowNative.memory`.
- The notetaker is embed-only: the separate Granola window is being removed; triggers that used to open it must focus the hub and navigate to the Notetaker tab instead.
- No real Granola dependency or affiliation; the page is a local reconstruction running offline.
- Existing fonts in the repo: EB Garamond (serif display) and Figtree (sans body).

## Brand Commitments

- The visual identity of the notetaker is a faithful, permanent copy of the real Granola screenshots the user supplied (dark near-black, serif display titles, pill toolbar, #-gutter note headings, transcript drawer with colored speaker bubbles). This is a binding constraint, not a starting point for reinterpretation.
- Product name and context remain the user's Wispr Flow clone; the Granola look applies to the notetaker surface.

## Evidence on Hand

- Six real Granola screenshots in `/home/wiu/Downloads` (dashboard, note detail, transcript drawer) — the authoritative visual reference.
- Working meeting recorder backend (`tauri-client/meeting-recorder.cjs`), preload API, hub embed scaffold in `hub/bridge.js`.
- No real testimonials, customers or usage data exist; future work must not fabricate any.

## Product Principles

1. The screenshot reference wins — fidelity to real Granola beats personal taste on this surface.
2. One app, one place: task flows live inside the hub, never in stray windows.
3. Everything local and offline-first: storage, transcription state, and meetings stay on the user's machine.
4. The recorder is real: UI state must reflect actual backend meeting events, not decorative mockups.

## Accessibility & Inclusion

No product-specific requirement established beyond standard keyboard-reachable controls in the hub.
