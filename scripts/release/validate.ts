#!/usr/bin/env bun

import semver from "semver"

export function releaseInfo(input: string) {
  const version = input.replace(/^v/, "")
  if (semver.valid(version) !== version) throw new Error(`Release tag is not exact SemVer: ${input}`)

  const prerelease = semver.prerelease(version)
  return {
    version,
    tag: `v${version}`,
    channel: prerelease ? "beta" : "latest",
    prerelease: Boolean(prerelease),
    stable: !prerelease,
  } as const
}

if (import.meta.main) {
  const info = releaseInfo(process.argv[2] ?? "")
  console.log(JSON.stringify(info, null, 2))

  if (process.env.GITHUB_OUTPUT) {
    const existing = await Bun.file(process.env.GITHUB_OUTPUT)
      .text()
      .catch(() => "")
    await Bun.write(
      process.env.GITHUB_OUTPUT,
      existing +
        [
          `version=${info.version}`,
          `tag=${info.tag}`,
          `channel=${info.channel}`,
          `prerelease=${info.prerelease}`,
          `stable=${info.stable}`,
          "",
        ].join("\n"),
    )
  }
}
