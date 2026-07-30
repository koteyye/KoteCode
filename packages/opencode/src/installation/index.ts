import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"
import { Effect, Layer, Schema, Context, Stream } from "effect"
import { serviceUse } from "@opencode-ai/core/effect/service-use"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { withTransientReadRetry } from "@/util/effect-http-client"
import { errorMessage } from "@/util/error"
import { ChildProcess } from "effect/unstable/process"
import { AppProcess } from "@opencode-ai/core/process"
import path from "path"
import { makeRuntime } from "@opencode-ai/core/effect/runtime"
import semver from "semver"
import { InstallationChannel, KoteCodeVersion } from "@opencode-ai/core/installation/version"
import { InstallationEvent } from "@opencode-ai/schema/installation-event"

export type Method = "curl" | "npm" | "yarn" | "pnpm" | "bun" | "brew" | "unknown"

export type ReleaseType = "patch" | "minor" | "major"

export const Event = InstallationEvent
export const UpdatesEnabled = true
export const UpdatesDisabledMessage = "KoteCode update checks are disabled"

export function getReleaseType(current: string, latest: string): ReleaseType {
  const currMajor = semver.major(current)
  const currMinor = semver.minor(current)
  const newMajor = semver.major(latest)
  const newMinor = semver.minor(latest)

  if (newMajor > currMajor) return "major"
  if (newMinor > currMinor) return "minor"
  return "patch"
}

export const Info = Schema.Struct({
  version: Schema.String,
  latest: Schema.String,
}).annotate({ identifier: "InstallationInfo" })
export type Info = Schema.Schema.Type<typeof Info>

export function userAgent(client = "cli") {
  return `kotecode/${InstallationChannel}/${KoteCodeVersion}/${client}`
}

export const USER_AGENT = userAgent()

export function isPreview() {
  return InstallationChannel !== "latest"
}

export function isLocal() {
  return InstallationChannel === "local"
}

export class UpgradeFailedError extends Schema.TaggedErrorClass<UpgradeFailedError>()("UpgradeFailedError", {
  stderr: Schema.String,
}) {
  override get message() {
    return this.stderr
  }
}

// Response schemas for external version APIs
const GitHubRelease = Schema.Struct({
  tag_name: Schema.String,
  draft: Schema.Boolean,
  prerelease: Schema.Boolean,
})
const NpmPackage = Schema.Struct({ version: Schema.String })
const BrewInfoV2 = Schema.Struct({
  formulae: Schema.Array(Schema.Struct({ versions: Schema.Struct({ stable: Schema.String }) })),
})

export function validateUpgradeTarget(current: string, target: string, channel: string, allowDowngrade = false) {
  if (!semver.valid(target)) return `Invalid KoteCode version: ${target}`
  if (channel === "latest" && semver.prerelease(target)) return "Stable KoteCode cannot upgrade to a prerelease"
  if (channel === "beta" && !semver.prerelease(target)?.includes("beta")) {
    return "KoteCode Beta can only upgrade within the beta channel"
  }
  if (semver.valid(current) && semver.eq(target, current)) return `KoteCode ${target} is already installed`
  if (!allowDowngrade && semver.valid(current) && semver.lt(target, current)) {
    return `Refusing to downgrade from ${current} to ${target} without --allow-downgrade`
  }
}

export interface Interface {
  readonly info: () => Effect.Effect<Info>
  readonly method: () => Effect.Effect<Method>
  readonly latest: (method?: Method) => Effect.Effect<string>
  readonly upgrade: (
    method: Method,
    target: string,
    options?: { allowDowngrade?: boolean },
  ) => Effect.Effect<void, UpgradeFailedError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Installation") {}

export const use = serviceUse(Service)

const layer: Layer.Layer<Service, never, HttpClient.HttpClient | AppProcess.Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const httpOk = HttpClient.filterStatusOk(withTransientReadRetry(http))
    const appProcess = yield* AppProcess.Service

    const text = Effect.fnUntraced(
      function* (cmd: string[], opts?: { cwd?: string; env?: Record<string, string> }) {
        const result = yield* appProcess.run(
          ChildProcess.make(cmd[0], cmd.slice(1), {
            cwd: opts?.cwd,
            env: opts?.env,
            extendEnv: true,
          }),
        )
        return result.stdout.toString("utf8")
      },
      Effect.catch(() => Effect.succeed("")),
    )

    const run = Effect.fnUntraced(
      function* (cmd: string[], opts?: { cwd?: string; env?: Record<string, string> }) {
        const result = yield* appProcess.run(
          ChildProcess.make(cmd[0], cmd.slice(1), {
            cwd: opts?.cwd,
            env: opts?.env,
            extendEnv: true,
          }),
        )
        return {
          code: result.exitCode,
          stdout: result.stdout.toString("utf8"),
          stderr: result.stderr.toString("utf8"),
        }
      },
      Effect.catch((err) => Effect.succeed({ code: 1, stdout: "", stderr: errorMessage(err) })),
    )

    const getBrewFormula = Effect.fnUntraced(function* () {
      const formula = "koteyye/tap/kotecode"
      const installed = yield* text(["brew", "list", "--formula", formula])
      if (installed.includes("kotecode")) return formula
      return formula
    })

    const upgradeFailure = (method: Method, result?: { code: number; stdout: string; stderr: string }) => {
      if (result) {
        return `Upgrade failed for ${method} (exit code ${result.code}).`
      }
      return `Upgrade failed for ${method}.`
    }

    const upgradeDirect = Effect.fnUntraced(
      function* (target: string) {
        const windows = process.platform === "win32"
        const script = windows ? "install.ps1" : "install"
        const response = yield* httpOk.execute(
          HttpClientRequest.get(`https://raw.githubusercontent.com/koteyye/KoteCode/v${target}/${script}`),
        )
        const body = yield* response.text
        const bodyBytes = new TextEncoder().encode(body)
        const powershell = windows
          ? (yield* text(["pwsh", "-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion"])) && "pwsh"
          : undefined
        const command = windows ? powershell || "powershell" : (yield* text(["bash", "--version"])) ? "bash" : "sh"
        const args = windows ? ["-NoProfile", "-NonInteractive", "-Command", "-"] : []
        const result = yield* appProcess.run(
          ChildProcess.make(command, args, {
            stdin: Stream.make(bodyBytes),
            env: {
              VERSION: target,
              KOTECODE_UPGRADE_PID: String(process.pid),
            },
            extendEnv: true,
          }),
        )
        return {
          code: result.exitCode,
          stdout: result.stdout.toString("utf8"),
          stderr: result.stderr.toString("utf8"),
        }
      },
      Effect.mapError(() => new UpgradeFailedError({ stderr: upgradeFailure("curl") })),
    )

    const result: Interface = {
      info: Effect.fn("Installation.info")(function* () {
        return {
          version: KoteCodeVersion,
          latest: yield* result.latest(),
        }
      }),
      method: Effect.fn("Installation.method")(function* () {
        if (process.execPath.includes(path.join(".kotecode", "bin"))) return "curl" as Method
        if (process.execPath.includes(path.join(".local", "bin"))) return "curl" as Method
        if (process.execPath.toLowerCase().includes(path.join("kotecode", "bin").toLowerCase())) return "curl" as Method
        const exec = process.execPath.toLowerCase()

        const checks: Array<{ name: Method; command: () => Effect.Effect<string> }> = [
          { name: "npm", command: () => text(["npm", "list", "-g", "--depth=0"]) },
          { name: "yarn", command: () => text(["yarn", "global", "list"]) },
          { name: "pnpm", command: () => text(["pnpm", "list", "-g", "--depth=0"]) },
          { name: "bun", command: () => text(["bun", "pm", "ls", "-g"]) },
          { name: "brew", command: () => text(["brew", "list", "--formula", "koteyye/tap/kotecode"]) },
        ]

        checks.sort((a, b) => {
          const aMatches = exec.includes(a.name)
          const bMatches = exec.includes(b.name)
          if (aMatches && !bMatches) return -1
          if (!aMatches && bMatches) return 1
          return 0
        })

        for (const check of checks) {
          const output = yield* check.command()
          if (output.includes("kotecode")) {
            return check.name
          }
        }

        return "unknown" as Method
      }),
      latest: Effect.fn("Installation.latest")(function* (installMethod?: Method) {
        const detectedMethod = installMethod || (yield* result.method())
        const channel = InstallationChannel === "beta" ? "beta" : "latest"

        if (detectedMethod === "brew") {
          const formula = yield* getBrewFormula()
          const infoJson = yield* text(["brew", "info", "--json=v2", formula])
          const info = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(BrewInfoV2))(infoJson)
          return info.formulae[0].versions.stable
        }

        if (["npm", "yarn", "bun", "pnpm"].includes(detectedMethod)) {
          const response = yield* httpOk.execute(
            HttpClientRequest.get(`https://registry.npmjs.org/kotecode/${channel}`).pipe(HttpClientRequest.acceptJson),
          )
          const data = yield* HttpClientResponse.schemaBodyJson(NpmPackage)(response)
          return data.version
        }

        if (channel === "latest") {
          const response = yield* httpOk.execute(
            HttpClientRequest.get("https://api.github.com/repos/koteyye/KoteCode/releases/latest").pipe(
              HttpClientRequest.acceptJson,
            ),
          )
          const data = yield* HttpClientResponse.schemaBodyJson(GitHubRelease)(response)
          return data.tag_name.replace(/^v/, "")
        }

        const response = yield* httpOk.execute(
          HttpClientRequest.get("https://api.github.com/repos/koteyye/KoteCode/releases?per_page=30").pipe(
            HttpClientRequest.acceptJson,
          ),
        )
        const releases = yield* HttpClientResponse.schemaBodyJson(Schema.Array(GitHubRelease))(response)
        const release = releases.find((item) => {
          const version = item.tag_name.replace(/^v/, "")
          return !item.draft && item.prerelease && semver.prerelease(version)?.includes("beta")
        })
        if (!release) return yield* Effect.die(new Error("No KoteCode beta release is available"))
        return release.tag_name.replace(/^v/, "")
      }, Effect.orDie),
      upgrade: Effect.fn("Installation.upgrade")(function* (
        m: Method,
        target: string,
        options?: { allowDowngrade?: boolean },
      ) {
        if (!UpdatesEnabled) return yield* new UpgradeFailedError({ stderr: UpdatesDisabledMessage })
        const validation = validateUpgradeTarget(KoteCodeVersion, target, InstallationChannel, options?.allowDowngrade)
        if (validation) return yield* new UpgradeFailedError({ stderr: validation })
        const upgradeResult = yield* Effect.gen(function* () {
          if (m === "curl") return yield* upgradeDirect(target)
          if (m === "npm") {
            return yield* run(["npm", "install", "-g", `kotecode@${target}`, "--registry=https://registry.npmjs.org"])
          }
          if (m === "yarn") {
            return yield* run([
              "yarn",
              "global",
              "add",
              `kotecode@${target}`,
              "--registry",
              "https://registry.npmjs.org",
            ])
          }
          if (m === "pnpm") {
            return yield* run(["pnpm", "add", "-g", `kotecode@${target}`, "--registry=https://registry.npmjs.org"])
          }
          if (m === "bun") {
            return yield* run([
              "bun",
              "install",
              "-g",
              `kotecode@${target}`,
              "--registry",
              "https://registry.npmjs.org",
            ])
          }
          if (m === "brew") {
            return yield* run(["brew", "upgrade", yield* getBrewFormula()], {
              env: { HOMEBREW_NO_AUTO_UPDATE: "1" },
            })
          }
          return yield* new UpgradeFailedError({
            stderr:
              "Could not determine how KoteCode was installed. Use one of:\n" +
              "  npm install -g kotecode@latest\n" +
              "  brew upgrade koteyye/tap/kotecode\n" +
              "  https://github.com/koteyye/KoteCode/releases",
          })
        })
        if (!upgradeResult || upgradeResult.code !== 0) {
          return yield* new UpgradeFailedError({ stderr: upgradeFailure(m, upgradeResult) })
        }
        yield* Effect.logInfo("upgraded", { method: m, target })
        yield* text([process.execPath, "--version"])
      }),
    }

    return Service.of(result)
  }),
)

export const node = LayerNode.make({ service: Service, layer: layer, deps: [httpClient, AppProcess.node] })

const { runPromise } = makeRuntime(Service, AppNodeBuilder.build(node))

export const latest = (...args: Parameters<Interface["latest"]>) => runPromise((s) => s.latest(...args))
export const method = () => runPromise((s) => s.method())
export const upgrade = (...args: Parameters<Interface["upgrade"]>) => runPromise((s) => s.upgrade(...args))

export * as Installation from "."
