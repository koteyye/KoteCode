import { afterEach, describe, expect, it } from "bun:test"
import { getPublicKeyAsync } from "@noble/ed25519"
import { randomBytes } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  cachePath,
  canonicalJson,
  isCacheUsable,
  parseConfig,
  readCache,
  resolveGateway,
  signConfig,
  signingMessage,
  verifyConfig,
  writeCache,
  type BootstrapConfig,
} from "../src/kote/bootstrap"

async function keypair() {
  const privateKey = randomBytes(32)
  return {
    privateKey: privateKey.toString("hex"),
    publicKey: Buffer.from(await getPublicKeyAsync(privateKey)).toString("hex"),
  }
}

function unsigned(
  issuedAt = new Date("2026-07-01T00:00:00.000Z"),
  expiresAt = new Date("2026-08-01T00:00:00.000Z"),
): Omit<BootstrapConfig, "signature"> {
  return {
    config_version: 1,
    gateway: {
      base_url: "https://gw.example.kote/api/v1",
      models_url: "https://gw.example.kote/api/v1/models",
    },
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  }
}

async function signed(
  input: Omit<BootstrapConfig, "signature"> = unsigned(),
): Promise<{ config: BootstrapConfig; publicKey: string }> {
  const keys = await keypair()
  return {
    config: await signConfig(input, keys.privateKey),
    publicKey: keys.publicKey,
  }
}

async function temporaryCache() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kote-cache-test-"))
  return {
    directory,
    file: path.join(directory, "bootstrap.json"),
  }
}

describe("kote bootstrap canonical form", () => {
  it("sorts keys deterministically and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: 2, c: undefined, nested: { z: 1, y: 2 } })).toBe(
      '{"a":2,"b":1,"nested":{"y":2,"z":1}}',
    )
  })

  it("excludes the signature from the signed message", () => {
    const message = signingMessage({ ...unsigned(), signature: "deadbeef" })
    expect(message).not.toContain("signature")
    expect(message).toContain('"base_url"')
  })
})

describe("kote bootstrap validation", () => {
  it("accepts a config signed by the supplied verification key", async () => {
    const fixture = await signed()
    const result = await verifyConfig(fixture.config, {
      publicKeyHex: fixture.publicKey,
      now: new Date("2026-07-15T00:00:00.000Z"),
    })
    expect(result).toEqual({ ok: true, config: fixture.config })
  })

  it("rejects malformed input and unknown versions", async () => {
    expect(await verifyConfig({ garbage: true })).toMatchObject({ ok: false, error: { _tag: "Malformed" } })

    const fixture = await signed({ ...unsigned(), config_version: 9 })
    expect(
      await verifyConfig(fixture.config, {
        publicKeyHex: fixture.publicKey,
        now: new Date("2026-07-15T00:00:00.000Z"),
      }),
    ).toMatchObject({ ok: false, error: { _tag: "UnknownConfigVersion" } })
  })

  it("rejects wrong, tampered, and malformed signatures", async () => {
    const fixture = await signed()
    const other = await keypair()
    const options = { now: new Date("2026-07-15T00:00:00.000Z") }

    expect(await verifyConfig(fixture.config, { ...options, publicKeyHex: other.publicKey })).toMatchObject({
      ok: false,
      error: { _tag: "BadSignature" },
    })
    expect(
      await verifyConfig(
        { ...fixture.config, signature: "ab".repeat(64) },
        { ...options, publicKeyHex: fixture.publicKey },
      ),
    ).toMatchObject({ ok: false, error: { _tag: "BadSignature" } })
    expect(
      await verifyConfig({ ...fixture.config, signature: "not-hex" }, { ...options, publicKeyHex: fixture.publicKey }),
    ).toMatchObject({ ok: false, error: { _tag: "BadSignature" } })
  })

  it("rejects non-HTTPS gateway URLs and invalid time windows", () => {
    expect(() =>
      parseConfig({ ...unsigned(), gateway: { base_url: "http://gateway.example/api" }, signature: "00" }),
    ).toThrow("must use HTTPS")
    expect(() =>
      parseConfig({
        ...unsigned(),
        issued_at: "2026-08-01T00:00:00.000Z",
        expires_at: "2026-07-01T00:00:00.000Z",
        signature: "00",
      }),
    ).toThrow("expires_at must be after issued_at")
  })
})

describe("kote bootstrap cache", () => {
  const directories: string[] = []

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
  })

  it("uses a signed expired config inside the documented grace period", async () => {
    const now = new Date("2026-07-15T00:00:00.000Z")
    const fixture = await signed(unsigned(new Date("2026-06-01T00:00:00.000Z"), new Date("2026-07-12T00:00:00.000Z")))
    const cache = await temporaryCache()
    directories.push(cache.directory)
    await writeCache(fixture.config, cache.file)

    const loaded = await readCache(cache.file, { now, publicKeyHex: fixture.publicKey })
    expect(loaded).toEqual(fixture.config)
    expect(isCacheUsable(loaded!, now)).toBe(true)
  })

  it("rejects a cache past the grace period and tolerates corruption", async () => {
    const now = new Date("2026-07-15T00:00:00.000Z")
    const fixture = await signed(unsigned(new Date("2026-06-01T00:00:00.000Z"), new Date("2026-07-01T00:00:00.000Z")))
    const cache = await temporaryCache()
    directories.push(cache.directory)
    await writeCache(fixture.config, cache.file)

    const loaded = await readCache(cache.file, { now, publicKeyHex: fixture.publicKey })
    expect(loaded).toEqual(fixture.config)
    expect(isCacheUsable(loaded!, now)).toBe(false)

    await fs.writeFile(cache.file, "{ broken json", "utf8")
    expect(await readCache(cache.file, { now, publicKeyHex: fixture.publicKey })).toBe(null)
  })

  it("writes through an atomic temporary file and leaves no temporary artifact", async () => {
    const fixture = await signed()
    const cache = await temporaryCache()
    directories.push(cache.directory)
    await writeCache(fixture.config, cache.file)

    expect(JSON.parse(await fs.readFile(cache.file, "utf8"))).toEqual(fixture.config)
    expect((await fs.readdir(cache.directory)).filter((file) => file.includes(".tmp-"))).toEqual([])
  })

  it("keeps a valid LKG when a new remote config is invalid", async () => {
    const now = new Date("2026-07-15T00:00:00.000Z")
    const fixture = await signed()
    const cache = await temporaryCache()
    directories.push(cache.directory)
    await writeCache(fixture.config, cache.file)

    const result = await resolveGateway({
      fetch: async () => ({ invalid: true }),
      cacheFile: cache.file,
      now,
      publicKeyHex: fixture.publicKey,
    })
    expect(result).toMatchObject({ source: "cache", baseUrl: fixture.config.gateway.base_url })
    expect(JSON.parse(await fs.readFile(cache.file, "utf8"))).toEqual(fixture.config)
  })

  it("persists a verified remote config as LKG", async () => {
    const fixture = await signed()
    const cache = await temporaryCache()
    directories.push(cache.directory)

    const result = await resolveGateway({
      fetch: async () => fixture.config,
      cacheFile: cache.file,
      now: new Date("2026-07-15T00:00:00.000Z"),
      publicKeyHex: fixture.publicKey,
    })
    expect(result).toMatchObject({ source: "remote", baseUrl: fixture.config.gateway.base_url })
    expect(JSON.parse(await fs.readFile(cache.file, "utf8"))).toEqual(fixture.config)
  })
})

describe("kote bootstrap resolution", () => {
  const originalGatewayUrl = process.env.KOTECODE_GATEWAY_URL

  afterEach(() => {
    delete process.env.KOTECODE_GATEWAY_URL
    if (originalGatewayUrl !== undefined) process.env.KOTECODE_GATEWAY_URL = originalGatewayUrl
  })

  it("gives KOTECODE_GATEWAY_URL highest priority", async () => {
    process.env.KOTECODE_GATEWAY_URL = "https://override.example/api/v1"
    expect(
      await resolveGateway({
        fetch: async () => {
          throw new Error("must not fetch")
        },
      }),
    ).toMatchObject({ source: "environment", baseUrl: "https://override.example/api/v1" })
  })

  it("rejects an unsafe environment override without fetching", async () => {
    process.env.KOTECODE_GATEWAY_URL = "file:///tmp/gateway"
    const result = await resolveGateway({
      fetch: async () => {
        throw new Error("must not fetch")
      },
    })
    expect(result).toMatchObject({ source: "none" })
    if (!("baseUrl" in result)) expect(result.reason).toContain("must use HTTPS")
  })

  it("returns a diagnostic failure when remote and cache are unavailable", async () => {
    const cache = await temporaryCache()
    await fs.rm(cache.directory, { recursive: true, force: true })
    const result = await resolveGateway({
      fetch: async () => {
        throw new Error("offline")
      },
      cacheFile: cache.file,
    })
    expect(result).toMatchObject({ source: "none" })
    if (!("baseUrl" in result)) {
      expect(result.reason).toContain("remote bootstrap is unreachable")
      expect(result.hint).toContain("KOTECODE_GATEWAY_URL")
    }
  })

  it("keeps the production cache below the KoteCode cache directory", () => {
    expect(cachePath()).toContain(path.join("kotencode", "kote", "bootstrap.json"))
  })
})
