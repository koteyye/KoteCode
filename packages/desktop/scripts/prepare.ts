#!/usr/bin/env bun

await import("./prebuild")
console.log(`Prepared KoteCode Desktop ${process.env.KOTECODE_VERSION ?? "development"}`)
