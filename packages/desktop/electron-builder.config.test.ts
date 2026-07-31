import { expect, test } from "bun:test"
import type { Configuration } from "electron-builder"
import { APP_IDS } from "./src/main/constants"

const channels = [
  { channel: "dev", appId: APP_IDS.dev },
  { channel: "beta", appId: APP_IDS.beta },
  { channel: "prod", appId: APP_IDS.prod },
] as const

for (const channel of channels) {
  test(`uses one Linux desktop identity for ${channel.channel}`, async () => {
    const previous = process.env.OPENCODE_CHANNEL
    process.env.OPENCODE_CHANNEL = channel.channel

    const module = await import(`./electron-builder.config.ts?channel=${channel.channel}`)
    const config = module.default as Configuration

    if (previous === undefined) delete process.env.OPENCODE_CHANNEL
    else process.env.OPENCODE_CHANNEL = previous

    expect(config.appId).toBe(channel.appId)
    expect(config.extraMetadata?.desktopName).toBe(`${channel.appId}.desktop`)
    expect(config.linux?.executableName).toBe("kotecode-desktop")
    expect(config.linux?.desktop?.entry?.StartupWMClass).toBe(channel.appId)
  })
}

test("does not package an OpenCode launcher into KoteCode Linux artifacts", async () => {
  const previous = process.env.OPENCODE_CHANNEL
  process.env.OPENCODE_CHANNEL = "prod"

  const module = await import("./electron-builder.config.ts?compat=prod")
  const config = module.default as Configuration

  if (previous === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = previous

  expect(config.deb?.fpm ?? []).toEqual([])
  expect(config.rpm?.fpm ?? []).toEqual([])
  expect(JSON.stringify(config)).not.toContain("opencode-desktop.desktop")
})

test("uses the public v0.1.0 artifact names and unsigned Desktop policy", async () => {
  const previous = process.env.OPENCODE_CHANNEL
  process.env.OPENCODE_CHANNEL = "prod"

  const module = await import("./electron-builder.config.ts?artifacts=prod")
  const config = module.default as Configuration

  if (previous === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = previous

  expect(config.nsis?.artifactName).toBe("KoteCode-desktop-windows-${arch}-setup.${ext}")
  expect(config.artifactName).toBe("KoteCode-desktop-windows-${arch}-portable.${ext}")
  expect(config.appImage?.artifactName).toBe("KoteCode-desktop-linux-${arch}.${ext}")
  expect(config.deb?.artifactName).toBe("KoteCode-desktop-linux-${arch}.${ext}")
  expect(config.rpm?.artifactName).toBe("KoteCode-desktop-linux-${arch}.${ext}")
  expect(config.win?.verifyUpdateCodeSignature).toBe(false)
  expect(config.mac?.artifactName).toBe("KoteCode-desktop-macos-${arch}.${ext}")
  expect(config.mac?.target).toEqual(["dmg", "zip"])
  expect(config.mac?.identity).toBeNull()
  expect(config.mac?.notarize).toBe(false)
})

test("uses the release architecture label for Linux artifacts", async () => {
  const previous = process.env.KOTECODE_ARTIFACT_ARCH
  process.env.KOTECODE_ARTIFACT_ARCH = "x64"

  const module = await import("./electron-builder.config.ts?artifacts=x64")
  const config = module.default as Configuration

  if (previous === undefined) delete process.env.KOTECODE_ARTIFACT_ARCH
  else process.env.KOTECODE_ARTIFACT_ARCH = previous

  expect(config.appImage?.artifactName).toBe("KoteCode-desktop-linux-x64.${ext}")
  expect(config.deb?.artifactName).toBe("KoteCode-desktop-linux-x64.${ext}")
  expect(config.rpm?.artifactName).toBe("KoteCode-desktop-linux-x64.${ext}")
})
