// KoteCode signed bootstrap configuration resolver.
//
// Resolves the Kote Gateway endpoint address from an Ed25519-signed remote
// config, with a local last-known-good cache and clear precedence rules.
//
// Spec: ТЗ §9.2–9.4. See docs/BOOTSTRAP.md for the format and signing process,
// and docs/NETWORK.md for the bootstrap network call.
//
// Security properties enforced here:
//   - signature verified BEFORE any URL is used
//   - config_version / issued_at / expires_at validated
//   - HTTP timeout + max response size enforced
//   - no redirect to unknown domains
//   - no code/command execution from config
//   - invalid new config never overwrites last-known-good
//   - corrupted cache never crashes the app
//   - no hidden fallback gateway URL is embedded

import { signAsync, verifyAsync } from "@noble/ed25519"
import { Global } from "../global"
import { Flag } from "../flag/flag"
import path from "path"
import fs from "fs/promises"
import {
  KOTE_BOOTSTRAP_CONFIG_VERSION,
  KOTE_BOOTSTRAP_GRACE_PERIOD_MS,
  KOTE_BOOTSTRAP_MAX_BYTES,
  KOTE_BOOTSTRAP_PUBLIC_KEY_HEX,
  KOTE_BOOTSTRAP_TIMEOUT_MS,
} from "./keys"

// ── Schema (the wire format) ────────────────────────────────────────────────
// Matches the example in ТЗ §9.2. The `signature` field is detached during
// verification (it is NOT part of the signed message).

export interface GatewayInfo {
  base_url: string
  models_url?: string
}

export interface BootstrapConfig {
  config_version: number
  gateway: GatewayInfo
  issued_at: string
  expires_at: string
  signature: string
}

/** Parse + structurally validate a raw object into a BootstrapConfig (throws on malformed). */
export function parseConfig(raw: unknown): BootstrapConfig {
  if (typeof raw !== "object" || raw === null) throw new Error("bootstrap: not an object")
  const obj = raw as Record<string, unknown>
  const config_version = obj["config_version"]
  const gateway = obj["gateway"]
  const issued_at = obj["issued_at"]
  const expires_at = obj["expires_at"]
  const signature = obj["signature"]
  if (typeof config_version !== "number" || !Number.isFinite(config_version)) throw new Error("bootstrap: config_version missing")
  if (typeof gateway !== "object" || gateway === null) throw new Error("bootstrap: gateway missing")
  const g = gateway as Record<string, unknown>
  if (typeof g["base_url"] !== "string" || g["base_url"].trim() === "") throw new Error("bootstrap: gateway.base_url missing")
  if (g["models_url"] !== undefined && typeof g["models_url"] !== "string") throw new Error("bootstrap: gateway.models_url must be a string")
  if (typeof issued_at !== "string" || Number.isNaN(Date.parse(issued_at))) throw new Error("bootstrap: issued_at not an ISO date")
  if (typeof expires_at !== "string" || Number.isNaN(Date.parse(expires_at))) throw new Error("bootstrap: expires_at not an ISO date")
  if (typeof signature !== "string" || signature.trim() === "") throw new Error("bootstrap: signature missing")
  return {
    config_version,
    gateway: { base_url: g["base_url"], ...(typeof g["models_url"] === "string" ? { models_url: g["models_url"] } : {}) },
    issued_at,
    expires_at,
    signature,
  }
}

// The unsigned message that gets signed: the config object WITHOUT `signature`,
// serialized as deterministic (canonically-keyed) JSON. This is stable across
// platforms/JSON libraries so the signer and verifier agree byte-for-byte.
export function signingMessage(input: BootstrapConfig): string {
  const unsigned: Omit<BootstrapConfig, "signature"> = {
    config_version: input.config_version,
    gateway: { base_url: input.gateway.base_url },
    issued_at: input.issued_at,
    expires_at: input.expires_at,
  }
  if (input.gateway.models_url !== undefined) {
    unsigned.gateway.models_url = input.gateway.models_url
  }
  return canonicalJson(unsigned)
}

/** Deterministic JSON: keys sorted recursively, no whitespace. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]"
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return "{" + entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",") + "}"
}

// ── Verification ────────────────────────────────────────────────────────────

export type VerifyError =
  | { _tag: "BadSignature" }
  | { _tag: "UnknownConfigVersion"; got: number }
  | { _tag: "NotYetValid"; issuedAt: string; now: Date }
  | { _tag: "Expired"; expiresAt: string; now: Date }
  | { _tag: "Malformed"; message: string }

/** Validate structure, version, time window, and signature. Returns the config on success. */
export async function verifyConfig(raw: unknown): Promise<{ ok: true; config: BootstrapConfig } | { ok: false; error: VerifyError }> {
  let config: BootstrapConfig
  try {
    config = parseConfig(raw)
  } catch (e) {
    return { ok: false, error: { _tag: "Malformed", message: (e as Error).message } }
  }

  if (config.config_version !== KOTE_BOOTSTRAP_CONFIG_VERSION) {
    return { ok: false, error: { _tag: "UnknownConfigVersion", got: config.config_version } }
  }

  const now = new Date()
  const issued = new Date(config.issued_at)
  const expires = new Date(config.expires_at)
  if (issued > now) return { ok: false, error: { _tag: "NotYetValid", issuedAt: config.issued_at, now } }
  if (expires <= now) return { ok: false, error: { _tag: "Expired", expiresAt: config.expires_at, now } }

  // Verify the detached signature over the canonical unsigned message.
  const msg = new TextEncoder().encode(signingMessage(config))
  const sig = Buffer.from(config.signature, "hex")
  const pub = Buffer.from(KOTE_BOOTSTRAP_PUBLIC_KEY_HEX, "hex")
  const valid = await verifyAsync(sig, msg, pub)
  if (!valid) return { ok: false, error: { _tag: "BadSignature" } }

  return { ok: true, config }
}

// ── Sign (used by scripts/sign-bootstrap.ts and tests; never in the client runtime) ──

/** Sign an unsigned config with the project's private key, returning a complete signed config. */
export async function signConfig(
  unsigned: Omit<BootstrapConfig, "signature">,
  privateKeyHex: string,
): Promise<BootstrapConfig> {
  const withPlaceholder: BootstrapConfig = { ...unsigned, signature: "" }
  const msg = new TextEncoder().encode(signingMessage(withPlaceholder))
  const priv = Buffer.from(privateKeyHex, "hex")
  const sig = await signAsync(msg, priv)
  return { ...unsigned, signature: Buffer.from(sig).toString("hex") }
}

// ── Cache (last-known-good) ─────────────────────────────────────────────────

export function cachePath(): string {
  return path.join(Global.Path.cache, "kote", "bootstrap.json")
}

/** Read the cached config. Corrupt/unreadable cache never throws — returns null. */
export async function readCache(): Promise<BootstrapConfig | null> {
  try {
    const raw = await fs.readFile(cachePath(), "utf8")
    const parsed = JSON.parse(raw)
    // The cache stores verified configs, but we re-validate (cheap, and defends
    // against a cache file edited after it was written).
    const result = await verifyConfig(parsed)
    return result.ok ? result.config : null
  } catch {
    return null
  }
}

/** Persist a verified config as last-known-good. Never throws. */
export async function writeCache(config: BootstrapConfig): Promise<void> {
  try {
    await fs.mkdir(path.dirname(cachePath()), { recursive: true })
    await fs.writeFile(cachePath(), JSON.stringify(config, null, 2), "utf8")
  } catch {
    // Swallow: cache write failure must not crash the app.
  }
}

/**
 * Is a cached config still usable when the remote bootstrap is unreachable?
 * Rule: within the grace period after expiry (see docs/BOOTSTRAP.md).
 * A non-expired config is always usable.
 */
export function isCacheUsable(config: BootstrapConfig, now: Date = new Date()): boolean {
  const expires = new Date(config.expires_at)
  if (expires > now) return true
  const graceEnd = new Date(expires.getTime() + KOTE_BOOTSTRAP_GRACE_PERIOD_MS)
  return now < graceEnd
}

// ── Remote fetch (hardened) ─────────────────────────────────────────────────

const DEFAULT_BOOTSTRAP_URL = "https://bootstrap.kotencode.ai/bootstrap.json"

/**
 * Fetch a bootstrap config over HTTPS with size/timeout/redirect guards.
 * Returns the parsed JSON object (NOT yet signature-verified).
 *
 * Security:
 *   - max KOTE_BOOTSTRAP_MAX_BYTES response size
 *   - KOTE_BOOTSTRAP_TIMEOUT_MS timeout
 *   - redirects followed only to HTTPS and only within the same host family
 *     (no off-domain redirect chains)
 *   - no eval / no code execution
 */
export async function fetchRemote(url: string = Flag.KOTECODE_BOOTSTRAP_URL ?? DEFAULT_BOOTSTRAP_URL): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), KOTE_BOOTSTRAP_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "error", // reject any redirect: bootstrap URL is pinned and trusted
      headers: { accept: "application/json" },
    })
    if (!res.ok) throw new Error(`bootstrap HTTP ${res.status}`)
    const contentLength = Number(res.headers.get("content-length") ?? 0)
    if (contentLength > KOTE_BOOTSTRAP_MAX_BYTES) throw new Error("bootstrap response too large (content-length)")

    // Read with a streaming size cap (defends against a server that omits content-length).
    const reader = res.body?.getReader()
    if (!reader) throw new Error("bootstrap: no response body")
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > KOTE_BOOTSTRAP_MAX_BYTES) throw new Error("bootstrap response too large (streamed)")
      chunks.push(value)
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks))
    return JSON.parse(text)
  } finally {
    clearTimeout(timer)
  }
}

// ── Resolution (the public entry point) ─────────────────────────────────────

export type ConfigSource = "environment" | "remote" | "cache" | "none"

export interface ResolvedGateway {
  baseUrl: string
  modelsUrl?: string
  source: ConfigSource
  config?: BootstrapConfig
}

/**
 * Resolve the Kote Gateway endpoint per the precedence rules (ТЗ §9.4):
 *   1. KOTECODE_GATEWAY_URL (explicit env) — highest priority
 *   2. fresh remote bootstrap (signature + window verified)
 *   3. last-known-good cache (still usable, incl. grace period)
 *   4. none — returns a descriptive error
 *
 * A verified remote config is persisted to the cache (invalid ones never overwrite it).
 * Returns source = "environment" | "remote" | "cache".
 */
export interface ResolveFailure {
  source: "none"
  reason: string
  hint?: string
}

export async function resolveGateway(): Promise<ResolvedGateway | ResolveFailure> {
  // 1. Explicit env override.
  const envUrl = Flag.KOTECODE_GATEWAY_URL
  if (envUrl) {
    return {
      baseUrl: envUrl,
      modelsUrl: undefined,
      source: "environment",
    }
  }

  // 2. Remote bootstrap.
  try {
    const raw = await fetchRemote()
    const result = await verifyConfig(raw)
    if (result.ok) {
      await writeCache(result.config) // persist last-known-good
      return {
        baseUrl: result.config.gateway.base_url,
        modelsUrl: result.config.gateway.models_url,
        source: "remote",
        config: result.config,
      }
    }
    // Invalid new config does NOT overwrite the cache. Fall through to cache.
  } catch {
    // Remote unreachable or malformed — fall through to cache.
  }

  // 3. Last-known-good cache.
  const cached = await readCache()
  if (cached && isCacheUsable(cached)) {
    return {
      baseUrl: cached.gateway.base_url,
      modelsUrl: cached.gateway.models_url,
      source: "cache",
      config: cached,
    }
  }

  // 4. Nothing available.
  return {
    source: "none",
    reason: "Kote Gateway endpoint could not be resolved.",
    hint:
      "Set KOTECODE_GATEWAY_URL to point at a gateway directly, " +
      "or ensure the bootstrap service is reachable and the local cache is valid.",
  }
}
