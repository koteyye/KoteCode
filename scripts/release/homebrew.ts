#!/usr/bin/env bun

import path from "node:path"
import fs from "node:fs/promises"
import semver from "semver"

const version = (process.argv[2] ?? "").replace(/^v/, "")
const sumsPath = path.resolve(process.argv[3] ?? "artifacts/SHA256SUMS")
const output = path.resolve(process.argv[4] ?? "artifacts/Formula/kotecode.rb")

if (semver.valid(version) !== version || semver.prerelease(version)) {
  throw new Error(`Homebrew Formula requires a stable SemVer version: ${version}`)
}

const sums = Object.fromEntries(
  (await Bun.file(sumsPath).text())
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+\*?/, 2))
    .map(([sha256, file]) => [file, sha256]),
)
const targets = {
  darwinArm64: "kotecode-darwin-arm64.zip",
  darwinX64: "kotecode-darwin-x64.zip",
  linuxArm64: "kotecode-linux-arm64.zip",
  linuxX64: "kotecode-linux-x64.zip",
}

Object.values(targets).forEach((file) => {
  if (!/^[0-9a-f]{64}$/.test(sums[file] ?? "")) throw new Error(`Missing SHA-256 for ${file}`)
})

const url = (file: string) => `https://github.com/koteyye/KoteCode/releases/download/v${version}/${file}`

const formula = `# typed: false
# frozen_string_literal: true

class Kotecode < Formula
  desc "AI coding agent based on OpenCode"
  homepage "https://github.com/koteyye/KoteCode"
  version "${version}"
  license "MIT"

  on_macos do
    on_arm do
      url "${url(targets.darwinArm64)}"
      sha256 "${sums[targets.darwinArm64]}"
    end
    on_intel do
      url "${url(targets.darwinX64)}"
      sha256 "${sums[targets.darwinX64]}"
    end
  end

  on_linux do
    on_arm do
      url "${url(targets.linuxArm64)}"
      sha256 "${sums[targets.linuxArm64]}"
    end
    on_intel do
      url "${url(targets.linuxX64)}"
      sha256 "${sums[targets.linuxX64]}"
    end
  end

  def install
    bin.install "kotecode"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/kotecode --version")
  end
end
`

await fs.mkdir(path.dirname(output), { recursive: true })
await Bun.write(output, formula)
console.log(`Generated ${output}`)
