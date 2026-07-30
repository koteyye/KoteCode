# Upstream state (KoteCode fork base)

This file records the exact upstream state KoteCode was forked from.
It is the single source of truth for "what is KoteCode based on?".

## Origin

- **Upstream repository:** <https://github.com/anomalyco/opencode>
- **Upstream license:** MIT (`Copyright (c) 2025 opencode`) — preserved verbatim in [`LICENSE`](./LICENSE).
- **Upstream default branch:** `dev`

## Fork base (this is the commit `feat/kotecode-bootstrap` started from)

- **Release tag:** `v1.18.5`
- **Commit SHA:** `e5cc278dec9294a627a7b05f47ce6a564408c1a2`
- **OpenCode version:** `1.18.5`
- **Release published:** 2026-07-24
- **KoteCode fork date:** 2026-07-25

## Remotes

- `origin` — `https://github.com/koteyye/KoteCode.git` (this fork)
- `upstream` — `https://github.com/anomalyco/opencode.git` (official OpenCode)

## Versioning (KoteCode)

KoteCode keeps its own version independent of upstream. The first release is
`KoteCode 0.1.0-alpha.1`, based on `OpenCode 1.18.5 (e5cc278)`.

`kotecode --version` prints both the KoteCode version and the upstream base.

## How to refresh this record

When the fork is rebased/merged onto a newer upstream commit, update the
"Fork base" fields above with the new tag, SHA, version and date, then commit
this file as part of the upstream-sync commit. See [`docs/UPSTREAM.md`](./docs/UPSTREAM.md)
for the full update procedure.
