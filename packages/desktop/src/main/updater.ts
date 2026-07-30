import { app, dialog, shell } from "electron"
import pkg from "electron-updater"
import semver from "semver"

import { CHANNEL, UPDATER_ENABLED, UPDATER_MODE } from "./constants"
import { createUpdaterController, type UpdaterReadyRecord } from "./updater-controller"
import { getLogger } from "./logging"
import { getStore } from "./store"
import { setAppQuitting } from "./windows"

const { autoUpdater } = pkg
const key = "ready"
const releases = "https://github.com/koteyye/KoteCode/releases"

export function setupAutoUpdater(stop: () => Promise<void>) {
  const logger = getLogger()
  autoUpdater.logger = logger
  autoUpdater.channel = CHANNEL === "beta" ? "beta" : "latest"
  autoUpdater.allowPrerelease = CHANNEL === "beta"
  autoUpdater.allowDowngrade = false
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  logger.log("auto updater configured", {
    mode: UPDATER_MODE,
    channel: autoUpdater.channel,
    allowPrerelease: autoUpdater.allowPrerelease,
    allowDowngrade: autoUpdater.allowDowngrade,
    currentVersion: app.getVersion(),
  })

  const store = getStore("kotecode.updater")
  return createUpdaterController({
    enabled: UPDATER_ENABLED,
    currentVersion: app.getVersion(),
    backend: {
      checkForUpdates: async () => {
        if (UPDATER_MODE === "notify") return checkLinuxPackageUpdate()
        const result = await autoUpdater.checkForUpdates()
        if (!result) return result
        return {
          isUpdateAvailable: result.isUpdateAvailable,
          updateInfo: {
            version: result.updateInfo.version,
            releaseNotes: normalizeReleaseNotes(result.updateInfo.releaseNotes),
          },
        }
      },
      downloadUpdate: () => (UPDATER_MODE === "install" ? autoUpdater.downloadUpdate() : Promise.resolve()),
      quitAndInstall: () => {
        if (UPDATER_MODE !== "install") throw new Error("This package must be updated with the system package manager")
        setAppQuitting()
        try {
          autoUpdater.quitAndInstall()
        } catch (error) {
          setAppQuitting(false)
          throw error
        }
      },
    },
    persistence: {
      get() {
        const value = store.get(key)
        if (!value || typeof value !== "object" || !("version" in value) || typeof value.version !== "string") return
        return {
          version: value.version,
          ...("notes" in value && typeof value.notes === "string" ? { notes: value.notes } : {}),
        } satisfies UpdaterReadyRecord
      },
      set: (value) => store.set(key, value),
      clear: () => store.delete(key),
    },
    stop,
    log: (message, data) => logger.log(message, data),
  })
}

export async function showUpdaterDialog(controller: ReturnType<typeof setupAutoUpdater>, alertOnFail: boolean) {
  const state = await controller.check()
  if (state.status === "error") {
    if (!alertOnFail) return
    await dialog.showMessageBox({ type: "error", message: "Update check failed.", title: "Update Error" })
    return
  }
  if (state.status === "up-to-date") {
    if (!alertOnFail) return
    await dialog.showMessageBox({ type: "info", message: "You're up to date.", title: "No Updates" })
    return
  }
  if (state.status !== "ready") return

  if (UPDATER_MODE === "notify") {
    const response = await dialog.showMessageBox({
      type: "info",
      message: `KoteCode ${state.version} is available.`,
      detail:
        `${state.notes ? `${state.notes}\n\n` : ""}` +
        "This Linux package is managed by apt/dnf. Open Releases to download the matching .deb or .rpm package.",
      title: "Update Available",
      buttons: ["Open Releases", "Later"],
      defaultId: 0,
      cancelId: 1,
    })
    if (response.response === 0) await shell.openExternal(releases)
    return
  }

  const response = await dialog.showMessageBox({
    type: "info",
    message: `Update ${state.version} downloaded. Restart now?`,
    detail: state.notes,
    title: "Update Ready",
    buttons: ["Restart", "Later"],
    defaultId: 0,
    cancelId: 1,
  })
  if (response.response === 0) await controller.install()
}

async function checkLinuxPackageUpdate() {
  const response = await fetch(
    CHANNEL === "beta"
      ? "https://api.github.com/repos/koteyye/KoteCode/releases?per_page=30"
      : "https://api.github.com/repos/koteyye/KoteCode/releases/latest",
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `KoteCode/${app.getVersion()}`,
      },
      signal: AbortSignal.timeout(5_000),
    },
  )
  if (!response.ok) throw new Error(`GitHub update check failed: HTTP ${response.status}`)

  const data: unknown = await response.json()
  const release = CHANNEL === "beta" && Array.isArray(data) ? data.find(isBetaRelease) : data
  if (!release || typeof release !== "object") return { isUpdateAvailable: false }
  if (!("tag_name" in release) || typeof release.tag_name !== "string") return { isUpdateAvailable: false }

  const version = release.tag_name.replace(/^v/, "")
  if (!semver.valid(version) || !semver.gt(version, app.getVersion())) return { isUpdateAvailable: false }
  return {
    isUpdateAvailable: true,
    updateInfo: {
      version,
      releaseNotes: "body" in release && typeof release.body === "string" ? release.body : undefined,
    },
  }
}

function isBetaRelease(value: unknown) {
  if (!value || typeof value !== "object") return false
  if (!("draft" in value) || value.draft !== false) return false
  if (!("prerelease" in value) || value.prerelease !== true) return false
  if (!("tag_name" in value) || typeof value.tag_name !== "string") return false
  return semver.prerelease(value.tag_name.replace(/^v/, ""))?.includes("beta") === true
}

function normalizeReleaseNotes(value: unknown) {
  if (typeof value === "string") return value
  if (!Array.isArray(value)) return
  return value
    .flatMap((item) =>
      item && typeof item === "object" && "note" in item && typeof item.note === "string" ? [item.note] : [],
    )
    .join("\n\n")
}
