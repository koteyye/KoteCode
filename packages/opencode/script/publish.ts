#!/usr/bin/env bun

import { $ } from "bun"
import semver from "semver"
import { fileURLToPath } from "node:url"

import pkg from "../package.json"

process.chdir(fileURLToPath(new URL("..", import.meta.url)))

const scope = process.env.KOTECODE_NPM_SCOPE ?? "@kotecode-ai"
const dryRun = process.argv.includes("--dry-run")
const packages = await Promise.all(
  Array.from(new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })).map(async (filepath) => ({
    directory: `./dist/${filepath.slice(0, -"/package.json".length)}`,
    manifest: await Bun.file(`./dist/${filepath}`).json(),
  })),
)
const platformPackages = packages.filter((item) => item.manifest.name.startsWith(`${scope}/`))

if (platformPackages.length === 0) throw new Error(`No ${scope} platform packages found in packages/opencode/dist`)

const versions = [...new Set(platformPackages.map((item) => item.manifest.version))]
if (versions.length !== 1) throw new Error(`Platform package versions differ: ${versions.join(", ")}`)

const expected = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"].map(
  (target) => `${scope}/${target}`,
)
const missing = expected.filter((name) => !platformPackages.some((item) => item.manifest.name === name))
if (missing.length > 0) throw new Error(`Missing platform packages: ${missing.join(", ")}`)

const version = versions[0]
if (!semver.valid(version)) throw new Error(`Invalid package version: ${version}`)

await $`mkdir -p ./dist/${pkg.name}/bin`
await Bun.file(`./dist/${pkg.name}/bin/kotecode`).write(
  (await Bun.file("./bin/kotecode").text()).replaceAll("@kotecode-ai", scope),
)
await Bun.file(`./dist/${pkg.name}/LICENSE`).write(await Bun.file("../../LICENSE").text())
await Bun.file(`./dist/${pkg.name}/README.md`).write(await Bun.file("../../README.md").text())
await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: pkg.name,
      version,
      description: pkg.description,
      license: pkg.license,
      homepage: pkg.homepage,
      repository: pkg.repository,
      bugs: pkg.bugs,
      bin: {
        kotecode: "./bin/kotecode",
      },
      files: ["bin", "LICENSE", "README.md"],
      engines: {
        node: ">=18",
      },
      os: ["darwin", "linux", "win32"],
      cpu: ["arm64", "x64"],
      optionalDependencies: Object.fromEntries(
        platformPackages.map((item) => [item.manifest.name, item.manifest.version]),
      ),
      publishConfig: {
        access: "public",
        provenance: true,
      },
    },
    null,
    2,
  ),
)

const tag = semver.prerelease(version) ? "beta" : "latest"

async function published(name: string) {
  return (await $`npm view ${`${name}@${version}`} version`.quiet().nothrow()).exitCode === 0
}

async function publish(directory: string, name: string) {
  if (process.platform !== "win32") await $`chmod -R 755 ./bin`.cwd(directory)
  await $`npm pack --dry-run`.cwd(directory)
  if (dryRun) return
  if (await published(name)) {
    console.log(`Already published ${name}@${version}`)
    return
  }
  await $`npm publish --provenance --access public --tag ${tag}`.cwd(directory)
}

for (const item of platformPackages) {
  await publish(item.directory, item.manifest.name)
}
await publish(`./dist/${pkg.name}`, pkg.name)
