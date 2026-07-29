#!/usr/bin/env bun

import { $ } from "bun"
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"

const repo = resolve(import.meta.dir, "../../..")
const source = join(repo, "packages/ui/src/assets/favicon/favicon-v3.svg")
const uiAssets = join(repo, "packages/ui/src/assets/favicon")
const desktopIcons = join(repo, "packages/desktop/icons")
const tempRoot = await mkdtemp(join(tmpdir(), "kotecode-icons-"))

const sizes = [16, 32, 48, 50, 64, 71, 89, 96, 107, 128, 142, 150, 180, 192, 256, 284, 310, 512, 1024]
const renders = new Map<number, string>()

async function render(size: number) {
  const cached = renders.get(size)
  if (cached) return cached
  const output = join(tempRoot, `${size}.png`)
  await $`rsvg-convert -w ${size} -h ${size} ${source} -o ${output}`.quiet()
  renders.set(size, output)
  return output
}

async function writeIco(output: string) {
  const icoSizes = [16, 32, 48, 64, 128, 256]
  const images = await Promise.all(icoSizes.map(async (size) => Buffer.from(await Bun.file(await render(size)).arrayBuffer())))
  const headerSize = 6 + images.length * 16
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  let offset = headerSize
  for (const [index, image] of images.entries()) {
    const size = icoSizes[index]
    const entry = 6 + index * 16
    header.writeUInt8(size === 256 ? 0 : size, entry)
    header.writeUInt8(size === 256 ? 0 : size, entry + 1)
    header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(image.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += image.length
  }

  await Bun.write(output, Buffer.concat([header, ...images]))
}

async function writeIcns(output: string) {
  const iconset = join(tempRoot, `${basename(output, ".icns")}-${Date.now()}.iconset`)
  await mkdir(iconset)
  const entries = [
    ["icon_16x16.png", 16],
    ["icon_16x16@2x.png", 32],
    ["icon_32x32.png", 32],
    ["icon_32x32@2x.png", 64],
    ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256],
    ["icon_256x256.png", 256],
    ["icon_256x256@2x.png", 512],
    ["icon_512x512.png", 512],
    ["icon_512x512@2x.png", 1024],
  ] as const

  for (const [name, size] of entries) await copyFile(await render(size), join(iconset, name))
  await $`iconutil -c icns ${iconset} -o ${output}`.quiet()
}

try {
  await Promise.all(sizes.map(render))

  const webRasters = [
    ["favicon-96x96.png", 96],
    ["favicon-96x96-v3.png", 96],
    ["apple-touch-icon.png", 180],
    ["apple-touch-icon-v3.png", 180],
    ["web-app-manifest-192x192.png", 192],
    ["web-app-manifest-512x512.png", 512],
  ] as const
  for (const [name, size] of webRasters) await copyFile(await render(size), join(uiAssets, name))

  await writeIco(join(uiAssets, "favicon.ico"))
  await writeIco(join(uiAssets, "favicon-v3.ico"))

  const desktopRasters = [
    ["32x32.png", 32],
    ["64x64.png", 64],
    ["128x128.png", 128],
    ["128x128@2x.png", 256],
    ["Square30x30Logo.png", 30],
    ["Square44x44Logo.png", 44],
    ["Square71x71Logo.png", 71],
    ["Square89x89Logo.png", 89],
    ["Square107x107Logo.png", 107],
    ["Square142x142Logo.png", 142],
    ["Square150x150Logo.png", 150],
    ["Square284x284Logo.png", 284],
    ["Square310x310Logo.png", 310],
    ["StoreLogo.png", 50],
    ["dock.png", 256],
    ["icon.png", 512],
  ] as const

  for (const channel of ["dev", "beta", "prod"]) {
    const channelDir = join(desktopIcons, channel)
    for (const [name, size] of desktopRasters) await copyFile(await render(size), join(channelDir, name))
    await writeIco(join(channelDir, "icon.ico"))
    await writeIcns(join(channelDir, "icon.icns"))
  }

  console.log("Generated KoteCode web and desktop icons from", source)
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
