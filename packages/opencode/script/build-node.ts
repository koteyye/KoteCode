#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { KoteCodeVersion as DefaultKoteCodeVersion, UpstreamBaseVersion } from "@opencode-ai/core/installation/version"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const generated = await import("./generate.ts")
const channel = process.env.KOTECODE_CHANNEL ?? (Script.channel === "prod" ? "latest" : Script.channel)

await Bun.build({
  target: "node",
  entrypoints: ["./src/node.ts"],
  outdir: "./dist/node",
  format: "esm",
  sourcemap: "linked",
  external: ["jsonc-parser", "@lydell/node-pty"],
  define: {
    OPENCODE_MODELS_DEV: generated.modelsData,
    OPENCODE_VERSION: JSON.stringify(process.env.OPENCODE_VERSION ?? UpstreamBaseVersion),
    KOTECODE_VERSION: JSON.stringify(process.env.KOTECODE_VERSION ?? DefaultKoteCodeVersion),
    OPENCODE_CHANNEL: JSON.stringify(channel),
  },
  files: {
    "opencode-web-ui.gen.ts": "",
  },
})

console.log("Build complete")
