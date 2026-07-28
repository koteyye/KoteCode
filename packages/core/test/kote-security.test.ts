import { describe, expect, it } from "bun:test"
import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { KOTE_BOOTSTRAP_PUBLIC_KEY_HEX } from "../src/kote/keys"

// Security guard tests (ТЗ §13.1): the bootstrap signing private key must never
// be present in the repository or in build artifacts. These run against the
// working tree via git.

const repoRoot = path.resolve(__dirname, "..", "..", "..")

describe("kote security: private key never in repo", () => {
  it("the private key file is not tracked by git", () => {
    const tracked = execSync("git ls-files", { cwd: repoRoot, encoding: "utf8" }).split("\n")
    const offenders = tracked.filter(
      (f) =>
        /private.*\.key$|\.pem$|ed25519-private|bootstrap-private|KoteCode-secret/i.test(f) &&
        // allow unrelated upstream files that happen to match the pattern
        !/infra\/secret|migration|snapshot|folder-private|packages\/ui\/src\/assets/.test(f),
    )
    expect(offenders).toEqual([])
  })

  it("the embedded hex is a 32-byte public key (64 hex chars), not a private key", () => {
    expect(KOTE_BOOTSTRAP_PUBLIC_KEY_HEX).toMatch(/^[0-9a-f]{64}$/)
    expect(KOTE_BOOTSTRAP_PUBLIC_KEY_HEX.length).toBe(64)
  })

  it("no 64-hex private-key-looking string matching the secret file appears in tracked source", () => {
    // Read the actual private key (if present on this machine) and assert it is
    // nowhere in the tracked tree. In environments without the key, this is a no-op pass.
    const secretPath = process.env.KOTE_TEST_PRIVATE_KEY_FILE ?? "F:/projects/KoteCode-secret/ed25519-private.key"
    let privHex: string | null = null
    try {
      privHex = fs.readFileSync(secretPath, "utf8").trim()
    } catch {
      // Key not present in this environment — nothing to assert against.
      return
    }
    if (!privHex || !/^[0-9a-f]{64}$/.test(privHex)) return

    const tracked = execSync("git ls-files", { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.(ts|js|json|md|yml|yaml|toml)$/.test(f))
    for (const file of tracked) {
      if (!file) continue
      const full = path.join(repoRoot, file)
      try {
        const content = fs.readFileSync(full, "utf8")
        if (content.includes(privHex)) {
          throw new Error(`PRIVATE KEY LEAK in tracked file: ${file}`)
        }
      } catch (e) {
        // Re-throw leaks; ignore unreadable/binary files.
        if ((e as Error).message.startsWith("PRIVATE KEY LEAK")) throw e
      }
    }
  }, 30_000)
})
