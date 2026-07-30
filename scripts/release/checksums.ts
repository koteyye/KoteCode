#!/usr/bin/env bun

import path from "node:path"

const directory = path.resolve(process.argv[2] ?? "artifacts")
const files = (await Array.fromAsync(new Bun.Glob("*").scan({ cwd: directory })))
  .filter((file) => file !== "SHA256SUMS")
  .sort()

if (files.length === 0) throw new Error(`No release files found in ${directory}`)

const lines = await Promise.all(
  files.map(async (file) => {
    const hasher = new Bun.CryptoHasher("sha256")
    for await (const chunk of Bun.file(path.join(directory, file)).stream()) hasher.update(chunk)
    return `${hasher.digest("hex")}  ${file}`
  }),
)

await Bun.write(path.join(directory, "SHA256SUMS"), lines.join("\n") + "\n")
console.log(`Wrote ${lines.length} checksums to ${path.join(directory, "SHA256SUMS")}`)
