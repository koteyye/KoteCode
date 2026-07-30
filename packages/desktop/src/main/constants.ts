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

export type UpdaterMode = "disabled" | "install" | "notify"

export const UPDATER_MODE: UpdaterMode = (() => {
  if (CHANNEL === "dev") return "disabled"
  if (process.platform === "win32") return "install"
  if (process.platform === "linux" && process.env.APPIMAGE) return "install"
  if (process.platform === "linux") return "notify"
  return "disabled"
})()
export const UPDATER_ENABLED = UPDATER_MODE !== "disabled"

// Upstream's WSL integration installs and launches ~/.opencode/bin/opencode.
// Keep it unreachable until KoteCode publishes and verifies its own Linux sidecar.
export const WSL_ENABLED = false
export const WSL_DISABLED_MESSAGE = "WSL integration is not available in this KoteCode release"
