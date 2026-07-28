import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Global } from "@opencode-ai/core/global"

describe("global paths", () => {
  test("tmp path is under the system temp directory", () => {
    expect(Global.Path.tmp).toBe(path.join(os.tmpdir(), "kotencode"))
    expect(Global.make().tmp).toBe(Global.Path.tmp)
  })

  test("tmp path is created on module load", async () => {
    expect((await fs.stat(Global.Path.tmp)).isDirectory()).toBe(true)
  })

  test("KOTECODE directory overrides drive direct and derived paths", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kotencode-global-test-"))
    const data = path.join(root, "data")
    const cache = path.join(root, "cache")
    const config = path.join(root, "config")
    try {
      const process = Bun.spawn(
        [
          "bun",
          "--conditions=browser",
          "-e",
          'const { Global } = await import("./src/global.ts"); console.log(JSON.stringify(Global.Path))',
        ],
        {
          cwd: path.resolve(import.meta.dir, ".."),
          env: {
            ...Bun.env,
            KOTECODE_DATA_DIR: data,
            KOTECODE_CACHE_DIR: cache,
            KOTECODE_CONFIG_DIR: config,
            OPENCODE_CONFIG_DIR: path.join(root, "opencode-config"),
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const output = await new Response(process.stdout).text()
      const error = await new Response(process.stderr).text()
      expect(await process.exited, error).toBe(0)
      expect(JSON.parse(output)).toMatchObject({
        data,
        cache,
        config,
        bin: path.join(cache, "bin"),
        log: path.join(data, "log"),
        repos: path.join(data, "repos"),
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
