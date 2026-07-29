import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { getPublicKeyAsync } from "@noble/ed25519"
import { randomBytes } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  cachePath,
  canonicalJson,
  fetchRemote,
  isCacheUsable,
  parseConfig,
  readCache,
  resolveProxy,
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
    proxy: { url: "https://proxy.example.kote" },
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

const originalProxyUrl = process.env.KOTECODE_PROXY_URL
const originalDisableProxy = process.env.KOTECODE_DISABLE_PROXY

beforeEach(() => {
  delete process.env.KOTECODE_PROXY_URL
  delete process.env.KOTECODE_DISABLE_PROXY
})

afterEach(() => {
  if (originalProxyUrl === undefined) delete process.env.KOTECODE_PROXY_URL
  else process.env.KOTECODE_PROXY_URL = originalProxyUrl
  if (originalDisableProxy === undefined) delete process.env.KOTECODE_DISABLE_PROXY
  else process.env.KOTECODE_DISABLE_PROXY = originalDisableProxy
})

describe("kote bootstrap canonical form", () => {
  it("sorts keys deterministically and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: 2, c: undefined, nested: { z: 1, y: 2 } })).toBe(
      '{"a":2,"b":1,"nested":{"y":2,"z":1}}',
    )
  })

  it("excludes the signature from the signed message", () => {
    const message = signingMessage({ ...unsigned(), signature: "deadbeef" })
    expect(message).not.toContain("signature")
    expect(message).toContain('"proxy"')
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

  it("normalizes the Proxy origin before signing", async () => {
    const keys = await keypair()
    const config = await signConfig(
      {
        ...unsigned(),
        proxy: { url: "https://proxy.example.kote:443/" },
      },
      keys.privateKey,
    )
    expect(config.proxy.url).toBe("https://proxy.example.kote")
    expect(
      await verifyConfig(config, { publicKeyHex: keys.publicKey, now: new Date("2026-07-15T00:00:00.000Z") }),
    ).toEqual({ ok: true, config })
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

  it("rejects unsafe proxy URLs and invalid time windows", () => {
    expect(() => parseConfig({ ...unsigned(), proxy: { url: "http://proxy.example" }, signature: "00" })).toThrow(
      "must use HTTPS",
    )
    expect(() =>
      parseConfig({ ...unsigned(), proxy: { url: "https://user:pass@proxy.example" }, signature: "00" }),
    ).toThrow("must not contain credentials")
    expect(() => parseConfig({ ...unsigned(), proxy: { url: "https://proxy.example/path" }, signature: "00" })).toThrow(
      "without path",
    )
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

    const result = await resolveProxy({
      fetch: async () => ({ invalid: true }),
      cacheFile: cache.file,
      now,
      publicKeyHex: fixture.publicKey,
    })
    expect(result).toMatchObject({ source: "cache", url: fixture.config.proxy.url })
    expect(JSON.parse(await fs.readFile(cache.file, "utf8"))).toEqual(fixture.config)
  })

  it("persists a verified remote config as LKG", async () => {
    const fixture = await signed()
    const cache = await temporaryCache()
    directories.push(cache.directory)

    const result = await resolveProxy({
      fetch: async () => fixture.config,
      cacheFile: cache.file,
      now: new Date("2026-07-15T00:00:00.000Z"),
      publicKeyHex: fixture.publicKey,
    })
    expect(result).toMatchObject({ source: "remote", url: fixture.config.proxy.url })
    expect(JSON.parse(await fs.readFile(cache.file, "utf8"))).toEqual(fixture.config)
  })
})

describe("kote bootstrap resolution", () => {
  it("gives explicit direct mode highest priority", async () => {
    process.env.KOTECODE_DISABLE_PROXY = "1"
    process.env.KOTECODE_PROXY_URL = "https://override.example"
    expect(
      await resolveProxy({
        fetch: async () => {
          throw new Error("must not fetch")
        },
      }),
    ).toEqual({ source: "disabled" })
  })

  it("gives KOTECODE_PROXY_URL priority over bootstrap", async () => {
    process.env.KOTECODE_PROXY_URL = "https://override.example"
    expect(
      await resolveProxy({
        fetch: async () => {
          throw new Error("must not fetch")
        },
      }),
    ).toMatchObject({ source: "environment", url: "https://override.example" })
  })

  it("uses a selected custom HTTP proxy before bootstrap", async () => {
    expect(
      await resolveProxy({
        customUrl: "http://user:secret@proxy.example:8080/",
        fetch: async () => {
          throw new Error("must not fetch")
        },
      }),
    ).toMatchObject({ source: "custom", url: "http://user:secret@proxy.example:8080" })
  })

  it("fails closed when the selected custom proxy is invalid", async () => {
    const result = await resolveProxy({
      customUrl: "https://proxy.example/path",
      fetch: async () => {
        throw new Error("must not fetch")
      },
    })
    expect(result).toMatchObject({ source: "none" })
    if (result.source === "none") expect(result.reason).toContain("custom proxy URL is invalid")
  })

  it("rejects an unsafe environment override without fetching", async () => {
    process.env.KOTECODE_PROXY_URL = "file:///tmp/proxy"
    const result = await resolveProxy({
      fetch: async () => {
        throw new Error("must not fetch")
      },
    })
    expect(result).toMatchObject({ source: "none" })
    if (result.source === "none") expect(result.reason).toContain("must use HTTPS")
  })

  it("returns a diagnostic failure when remote and cache are unavailable", async () => {
    const cache = await temporaryCache()
    await fs.rm(cache.directory, { recursive: true, force: true })
    const result = await resolveProxy({
      fetch: async () => {
        throw new Error("offline")
      },
      cacheFile: cache.file,
    })
    expect(result).toMatchObject({ source: "none" })
    if (result.source === "none") {
      expect(result.reason).toContain("remote bootstrap is unreachable")
      expect(result.hint).toContain("KOTECODE_PROXY_URL")
    }
  })

  it("keeps the production cache below the KoteCode cache directory", () => {
    expect(cachePath()).toContain(path.join("kotencode", "kote", "bootstrap.json"))
  })
})

describe("kote bootstrap transport", () => {
  it("rejects non-HTTPS bootstrap URLs before making a request", async () => {
    const message = await fetchRemote("http://bootstrap.example.test/bootstrap.json").then(
      () => "resolved unexpectedly",
      (error) => (error instanceof Error ? error.message : String(error)),
    )
    expect(message).toBe("bootstrap URL must use HTTPS")
  })

  it("rejects credentials embedded in the bootstrap URL", async () => {
    const message = await fetchRemote("https://user:secret@bootstrap.example.test/bootstrap.json").then(
      () => "resolved unexpectedly",
      (error) => (error instanceof Error ? error.message : String(error)),
    )
    expect(message).toBe("bootstrap URL must not contain credentials")
  })
})
