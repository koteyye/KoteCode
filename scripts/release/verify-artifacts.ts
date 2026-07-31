#!/usr/bin/env bun

import path from "node:path"

const directory = path.resolve(process.argv[2] ?? "artifacts")
const channel = process.argv[3] ?? "latest"
if (channel !== "latest" && channel !== "beta") throw new Error(`Unsupported release channel: ${channel}`)
const required = [
  "kotecode-windows-x64.zip",
  "kotecode-linux-x64.zip",
  "kotecode-linux-arm64.zip",
  "kotecode-darwin-arm64.zip",
  "kotecode-darwin-x64.zip",
  "KoteCode-desktop-windows-x64-setup.exe",
  "KoteCode-desktop-windows-x64-setup.exe.blockmap",
  "KoteCode-desktop-windows-x64-portable.zip",
  "KoteCode-desktop-linux-x64.AppImage",
  "KoteCode-desktop-linux-x64.deb",
  "KoteCode-desktop-linux-x64.rpm",
  "KoteCode-desktop-macos-x64.dmg",
  "KoteCode-desktop-macos-x64.zip",
  "KoteCode-desktop-macos-arm64.dmg",
  "KoteCode-desktop-macos-arm64.zip",
  `${channel}.yml`,
  `${channel}-linux.yml`,
  "SHA256SUMS",
]
const files = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: directory }))
const missing = required.filter((file) => !files.includes(file))
if (missing.length > 0) throw new Error(`Missing release artifacts:\n${missing.join("\n")}`)

const sums = Object.fromEntries(
  (await Bun.file(path.join(directory, "SHA256SUMS")).text())
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+\*?/, 2))
    .map(([sha256, file]) => [file, sha256]),
)

for (const file of required.filter((item) => item !== "SHA256SUMS")) {
  const hasher = new Bun.CryptoHasher("sha256")
  for await (const chunk of Bun.file(path.join(directory, file)).stream()) hasher.update(chunk)
  if (hasher.digest("hex") !== sums[file]) throw new Error(`Checksum verification failed for ${file}`)
}

console.log(`Verified ${required.length - 1} release artifacts`)
