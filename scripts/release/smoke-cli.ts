#!/usr/bin/env bun

import path from "node:path"
import fs from "node:fs/promises"
import os from "node:os"

const binary = path.resolve(process.argv[2] ?? "")
const version = process.argv[3] ?? ""

if (!(await Bun.file(binary).exists())) throw new Error(`CLI binary does not exist: ${binary}`)

const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kotecode-release-smoke-"))
const env = {
  ...process.env,
  XDG_DATA_HOME: path.join(directory, "data"),
  XDG_CACHE_HOME: path.join(directory, "cache"),
  XDG_CONFIG_HOME: path.join(directory, "config"),
  XDG_STATE_HOME: path.join(directory, "state"),
}

try {
  const versionResult = Bun.spawnSync([binary, "--version"], { stdout: "pipe", stderr: "pipe", env })
  const versionOutput = versionResult.stdout.toString()
  if (versionResult.exitCode !== 0) throw new Error(versionResult.stderr.toString() || `${binary} --version failed`)
  if (!versionOutput.includes(`KoteCode v${version}`)) {
    throw new Error(`Unexpected version output:\n${versionOutput}`)
  }

  const helpResult = Bun.spawnSync([binary, "--help"], { stdout: "pipe", stderr: "pipe", env })
  const helpOutput = helpResult.stdout.toString() + helpResult.stderr.toString()
  if (helpResult.exitCode !== 0) throw new Error(helpOutput || `${binary} --help failed`)
  if (!helpOutput.includes("kotecode")) throw new Error("CLI help does not contain the kotecode command")
  if (/anomalyco\/opencode|opencode\.ai\/install/i.test(helpOutput)) {
    throw new Error(`CLI help contains an upstream release/install URL:\n${helpOutput}`)
  }

  console.log(versionOutput.trim())
  console.log(`Smoke-tested ${binary}`)
} finally {
  await fs.rm(directory, { recursive: true, force: true })
}
