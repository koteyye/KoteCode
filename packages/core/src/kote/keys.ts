// Embedded public key for verifying Kote Gateway bootstrap configurations.
//
// Only the PUBLIC key lives in the repository. The corresponding private key is
// kept by the project owner OUTSIDE the repo (see docs/BOOTSTRAP.md) and is used
// only by scripts/sign-bootstrap.ts to sign new configs. It never enters the
// client, the build, CI logs, or release artifacts.
//
// Algorithm: Ed25519 (32-byte public key, hex-encoded).

export const KOTE_BOOTSTRAP_PUBLIC_KEY_HEX = "d5e1f3f5353848e49e341ede50622b2d5c96bbf2817a02539c4b7e4ba0ef7bb3"

// Config schema version this client understands. Bootstrap configs must declare
// config_version === 1 to be accepted; unknown versions are rejected.
export const KOTE_BOOTSTRAP_CONFIG_VERSION = 1 as const

// Safety limits for the bootstrap fetch (per spec ТЗ §9.3).
export const KOTE_BOOTSTRAP_TIMEOUT_MS = 10_000 // 10s connect+read
export const KOTE_BOOTSTRAP_MAX_BYTES = 64 * 1024 // 64 KiB response cap
// How long an EXPIRED cached (last-known-good) config may still be used in an
// emergency (bootstrap unreachable). Documented in docs/BOOTSTRAP.md.
export const KOTE_BOOTSTRAP_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
