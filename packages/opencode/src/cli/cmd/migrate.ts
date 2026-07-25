import type { Argv } from "yargs"
import { UI } from "../ui"
import { Global } from "@opencode-ai/core/global"
import fs from "fs/promises"
import path from "path"
import { exists as existsAsync } from "@/util/filesystem"

// Keys/values that are considered secrets and are NOT copied unless --with-secrets is given.
// Matches the keys OpenCode itself treats as credentials in provider options / auth.
const SECRET_KEY_PATTERNS = [/key/i, /token/i, /secret/i, /password/i, /credential/i, /apikey/i]

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((re) => re.test(key))
}

/** Strip secret-looking values from an arbitrary config object (deep). */
function stripSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v)) as unknown as T
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(k) && (typeof v === "string" || typeof v === "number")) {
        out[k] = "<redacted: re-enter after migration>"
      } else {
        out[k] = stripSecrets(v)
      }
    }
    return out as T
  }
  return value
}

/** Recursively count secret-looking string values that would be dropped. */
function countSecrets(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((n, v) => n + countSecrets(v), 0)
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce((n, [k, v]) => {
      if (isSecretKey(k) && (typeof v === "string" || typeof v === "number") && String(v).trim() !== "") return n + 1
      return n + countSecrets(v)
    }, 0)
  }
  return 0
}

const CONFIG_FILENAMES = ["kotencode.jsonc", "kotencode.json", "config.json", "opencode.jsonc", "opencode.json"]

interface MigrateArgs {
  withSecrets: boolean
  dryRun: boolean
  force: boolean
}

/**
 * `kotencode migrate-from-opencode`
 *
 * Detects an existing OpenCode configuration and copies user settings into the
 * KoteCode config directory. Per the KoteCode spec (ТЗ §8.3):
 *   - never modifies or deletes the original OpenCode files
 *   - copies only non-secret settings by default
 *   - secrets require an explicit --with-secrets opt-in
 */
export const MigrateCommand = {
  command: "migrate-from-opencode",
  describe: "import non-secret settings from an existing OpenCode installation",
  builder: (yargs: Argv) =>
    yargs
      .option("with-secrets", {
        type: "boolean",
        describe: "also copy API keys / tokens (explicit opt-in)",
        default: false,
      })
      .option("dry-run", {
        type: "boolean",
        describe: "show what would be copied without writing",
        default: false,
      })
      .option("force", {
        alias: "f",
        type: "boolean",
        describe: "overwrite an existing KoteCode config if present",
        default: false,
      }),
  handler: async (args: MigrateArgs) => {
    // Resolve the OpenCode config dir: the OpenCode default is the sibling "opencode"
    // directory under the same XDG root as KoteCode's "kotencode" directory.
    const koteConfigDir = Global.Path.config
    const opencodeConfigDir = (() => {
      const koteDir = path.basename(koteConfigDir)
      if (koteDir === "kotencode") return path.join(path.dirname(koteConfigDir), "opencode")
      // If the user overrode KOTECODE_CONFIG_DIR to something custom, fall back to the
      // platform-default opencode location via the OPENCODE_CONFIG_DIR flag if present.
      const flag = process.env.OPENCODE_CONFIG_DIR
      if (flag) return flag
      return path.join(path.dirname(koteConfigDir), "opencode")
    })()

    if (!(await existsAsync(opencodeConfigDir))) {
      UI.println(`${UI.Style.TEXT_WARNING}No OpenCode configuration found at ${opencodeConfigDir}${UI.Style.TEXT_NORMAL}`)
      UI.println(`${UI.Style.TEXT_DIM}Nothing to migrate.${UI.Style.TEXT_NORMAL}`)
      return
    }

    // Find the first OpenCode config file present.
    let sourceFile: string | null = null
    for (const name of ["config.json", "opencode.json", "opencode.jsonc"]) {
      const candidate = path.join(opencodeConfigDir, name)
      if (await existsAsync(candidate)) {
        sourceFile = candidate
        break
      }
    }

    if (!sourceFile) {
      UI.println(`${UI.Style.TEXT_WARNING}OpenCode directory found, but no config file inside it.${UI.Style.TEXT_NORMAL}`)
      UI.println(`${UI.Style.TEXT_DIM}Looked for: config.json, opencode.json, opencode.jsonc${UI.Style.TEXT_NORMAL}`)
      return
    }

    const raw = await fs.readFile(sourceFile, "utf8")
    let parsed: unknown
    try {
      // opencode.jsonc may contain comments; strip single-line // comments for a best-effort parse.
      const cleaned = raw.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
      parsed = JSON.parse(cleaned)
    } catch (e) {
      UI.error(`Failed to parse OpenCode config at ${sourceFile}: ${(e as Error).message}`)
      process.exitCode = 1
      return
    }

    const secretCount = countSecrets(parsed)
    const output = args.withSecrets ? parsed : stripSecrets(parsed)

    // Resolve the destination KoteCode config file.
    let destFile = path.join(koteConfigDir, "kotencode.jsonc")
    if (!args.force) {
      for (const name of CONFIG_FILENAMES) {
        const candidate = path.join(koteConfigDir, name)
        if (await existsAsync(candidate)) {
          destFile = candidate
          UI.println(`${UI.Style.TEXT_WARNING}KoteCode config already exists at ${candidate}${UI.Style.TEXT_NORMAL}`)
          UI.println(`${UI.Style.TEXT_DIM}Use --force to overwrite.${UI.Style.TEXT_NORMAL}`)
          return
        }
      }
    }

    const action = args.dryRun ? "Would write" : "Wrote"
    UI.println(`${UI.Style.TEXT_SUCCESS}${action} KoteCode config to ${destFile}${UI.Style.TEXT_NORMAL}`)
    UI.println(`${UI.Style.TEXT_DIM}Source: ${sourceFile} (left untouched)${UI.Style.TEXT_NORMAL}`)
    if (secretCount > 0 && !args.withSecrets) {
      UI.println(
        `${UI.Style.TEXT_WARNING}Redacted ${secretCount} secret value(s); re-enter API keys after migration.${UI.Style.TEXT_NORMAL}`,
      )
      UI.println(`${UI.Style.TEXT_DIM}Pass --with-secrets to copy them too.${UI.Style.TEXT_NORMAL}`)
    } else if (secretCount > 0 && args.withSecrets) {
      UI.println(`${UI.Style.TEXT_WARNING}Copied ${secretCount} secret value(s) as requested.${UI.Style.TEXT_NORMAL}`)
    }

    if (args.dryRun) {
      UI.println(`${UI.Style.TEXT_DIM}--- preview (redacted secrets shown as <redacted>) ---${UI.Style.TEXT_NORMAL}`)
      process.stderr.write(JSON.stringify(output, null, 2) + "\n")
      return
    }

    await fs.mkdir(koteConfigDir, { recursive: true })
    await fs.writeFile(destFile, JSON.stringify(output, null, 2) + "\n", "utf8")
  },
}
