#!/usr/bin/env bun

await import("./prebuild")

const pkg = await Bun.file("./package.json").json()
const version = process.env.KOTECODE_VERSION ?? pkg.version
pkg.version = version
await Bun.write("./package.json", JSON.stringify(pkg, null, 2) + "\n")
console.log(`Updated package.json version to ${version}`)
