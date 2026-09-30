# ADR-0001: Web-first single UI hosted by Tauri

Status: accepted (KODEX §10).

## Context

The submission needs a usable inspection tool on Windows 11 and a reviewable
web codebase. Two independent UIs (web + desktop) would double KRDS,
accessibility, and evidence-panel work.

## Decision

One React + TypeScript + Vite application. The desktop app is the same app
hosted by Tauri 2; all native capability flows through `HostBridge`
(`BrowserHost` for preview/replay, `TauriHost` for scanning/filesystem/
process supervision).

## Consequences

- React code must not import Tauri APIs outside platform adapters.
- Browser preview cannot fake local scanning or weaken browser security.
- Tauri stays a thin host; detection lives in reusable scanner modules.
