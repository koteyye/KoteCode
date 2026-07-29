// KoteCode versioning.
//
// KoteCode keeps its own version independent of upstream OpenCode, while preserving
// the OpenCode build-time defines (OPENCODE_VERSION / OPENCODE_CHANNEL) so the internal
// compatibility layer and upstream merge process stay intact. See docs/UPSTREAM.md.
//
// `kotencode --version` prints BOTH versions:
//   KoteCode <kotecode-version>
//   Based on OpenCode <upstream-version>

declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
  const KOTECODE_VERSION: string
}

// OpenCode base version, injected at compile time by packages/opencode/script/build.ts.
// Falls back to "local" under `bun dev` (no define present).
export const UpstreamVersion = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local"
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"

// KoteCode's own version. Bump here for each KoteCode release.
// The public KoteCode version line starts at 1.0.0 and remains independent
// from the upstream compatibility version below.
export const KoteCodeVersion = typeof KOTECODE_VERSION === "string" ? KOTECODE_VERSION : "1.0.0"

// Upstream OpenCode version this KoteCode was forked from (see UPSTREAM_STATE.md).
export const UpstreamBaseVersion = "1.18.5"
export const UpstreamBaseCommit = "e5cc278"

// `InstallationVersion` is consumed across the OpenCode compatibility layer (User-Agent,
// provider headers, etc.). It keeps the upstream value so attribution and telemetry remain
// correct and merges stay trivial. KoteCode surfaces its own version via KoteCodeVersion /
// the composed `versionString` below.
export const InstallationVersion = UpstreamVersion

// Human-readable version shown by `kotencode --version` and the TUI.
export function versionString(): string {
  return `KoteCode v${KoteCodeVersion}
Based on OpenCode ${UpstreamVersion} (fork base ${UpstreamBaseVersion} ${UpstreamBaseCommit})`
}
