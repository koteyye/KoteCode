export type Channel = "dev" | "beta" | "prod"

const raw = import.meta.env.OPENCODE_CHANNEL
export const CHANNEL: Channel = raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const APP_NAMES = {
  dev: "KoteCode Dev",
  beta: "KoteCode Beta",
  prod: "KoteCode",
} as const satisfies Record<Channel, string>

export const APP_IDS = {
  dev: "ai.kotecode.desktop.dev",
  beta: "ai.kotecode.desktop.beta",
  prod: "ai.kotecode.desktop",
} as const satisfies Record<Channel, string>

// KoteCode releases do not have a fork-owned desktop update pipeline yet.
// Keep this disabled together with the CLI updater safety lock.
export const UPDATER_ENABLED = false

// Upstream's WSL integration installs and launches ~/.opencode/bin/opencode.
// Keep it unreachable until KoteCode publishes and verifies its own Linux sidecar.
export const WSL_ENABLED = false
export const WSL_DISABLED_MESSAGE = "WSL integration is not available in this KoteCode release"
