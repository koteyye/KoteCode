import { app } from "electron"

type Channel = "dev" | "beta" | "prod"
const raw = import.meta.env.OPENCODE_CHANNEL
export const CHANNEL: Channel = raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

// KoteCode alpha releases do not have a fork-owned desktop update pipeline yet.
// Keep this disabled together with the CLI updater safety lock.
export const UPDATER_ENABLED = false
