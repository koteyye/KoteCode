import { Config } from "@/config/config"
import { AppRuntime } from "@/effect/app-runtime"
import { Installation } from "@/installation"
import { GlobalBus } from "@/bus/global"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Global } from "@opencode-ai/core/global"
import { InstallationChannel, KoteCodeVersion } from "@opencode-ai/core/installation/version"

const interval = 24 * 60 * 60 * 1000
const timeout = 5_000

export async function upgrade() {
  if (!Installation.UpdatesEnabled || Flag.KOTECODE_DISABLE_UPDATE_CHECK || Flag.OPENCODE_DISABLE_AUTOUPDATE) return
  const config = await AppRuntime.runPromise(Config.Service.use((cfg) => cfg.getGlobal()))
  if (config.autoupdate === false) return

  const cachePath = `${Global.Path.cache}/update-check.json`
  const cached = (await Bun.file(cachePath)
    .json()
    .catch(() => ({}))) as { checkedAt?: number; latest?: string }
  if (cached.checkedAt && Date.now() - cached.checkedAt < interval) {
    if (cached.latest && !Installation.validateUpgradeTarget(KoteCodeVersion, cached.latest, InstallationChannel)) {
      notify(cached.latest)
    }
    return
  }

  const method = await Installation.method()
  const latest = await Promise.race([
    Installation.latest(method).catch(() => undefined),
    new Promise<undefined>((resolve) => setTimeout(resolve, timeout)),
  ])
  await Bun.write(cachePath, JSON.stringify({ checkedAt: Date.now(), latest }))
  if (!latest || Installation.validateUpgradeTarget(KoteCodeVersion, latest, InstallationChannel)) return
  notify(latest)
}

function notify(version: string) {
  GlobalBus.emit("event", {
    directory: "global",
    payload: {
      type: Installation.Event.UpdateAvailable.type,
      properties: { version },
    },
  })
}
