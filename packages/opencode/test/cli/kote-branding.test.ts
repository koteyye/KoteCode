import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

describe("KoteCode CLI branding", () => {
  test("the package bin points at the checked-in kotecode launcher", async () => {
    const root = path.resolve(import.meta.dir, "../..")
    const pkg = await Bun.file(path.join(root, "package.json")).json()
    expect(pkg.bin).toEqual({ kotecode: "./bin/kotecode" })
    expect((await fs.stat(path.join(root, pkg.bin.kotecode))).isFile()).toBe(true)
  })

  test("--version writes the KoteCode and upstream versions to stdout", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kotecode-version-test-"))
    try {
      const child = Bun.spawn(["bun", "--conditions=browser", "./src/index.ts", "--version"], {
        cwd: path.resolve(import.meta.dir, "../.."),
        env: {
          ...Bun.env,
          XDG_CONFIG_HOME: path.join(directory, "config"),
          XDG_DATA_HOME: path.join(directory, "data"),
          XDG_CACHE_HOME: path.join(directory, "cache"),
          XDG_STATE_HOME: path.join(directory, "state"),
        },
        stdout: "pipe",
        stderr: "pipe",
      })
      const stdout = await new Response(child.stdout).text()
      const stderr = await new Response(child.stderr).text()
      expect(await child.exited, stderr).toBe(0)
      expect(stdout).toContain("KoteCode v0.1.0-dev")
      expect(stdout).toContain("Based on OpenCode")
      expect(stderr).toBe("")
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})
