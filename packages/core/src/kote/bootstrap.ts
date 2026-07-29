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
//   - no hidden fallback proxy URL is embedded

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

export interface ProxyInfo {
  url: string
}

export interface BootstrapConfig {
  config_version: number
  proxy: ProxyInfo
  issued_at: string
  expires_at: string
  signature: string
}

function requireIsoDate(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`bootstrap: ${field} not an ISO date`)
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new Error(`bootstrap: ${field} not an ISO date`)
  }
  return value
}

function requireProxyUrl(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`bootstrap: ${field} missing`)
  const url = URL.parse(value)
  if (!url) throw new Error(`bootstrap: ${field} must be a valid URL`)
  if (url.protocol !== "https:") throw new Error(`bootstrap: ${field} must use HTTPS`)
  if (url.username || url.password) throw new Error(`bootstrap: ${field} must not contain credentials`)
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`bootstrap: ${field} must be an HTTPS origin without path, query, or fragment`)
  }
  return url.origin
}

function requireObject(value: unknown, field: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`bootstrap: ${field} missing`)
  }
  return value as Record<string, unknown>
}

function requireVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("bootstrap: config_version missing")
  }
  return value
}

function requireSignature(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") throw new Error("bootstrap: signature missing")
  return value
}

/** Parse + structurally validate a raw object into a BootstrapConfig (throws on malformed). */
export function parseConfig(raw: unknown): BootstrapConfig {
  const obj = requireObject(raw, "config")
  const proxy = requireObject(obj["proxy"], "proxy")
  const issuedAt = requireIsoDate(obj["issued_at"], "issued_at")
  const expiresAt = requireIsoDate(obj["expires_at"], "expires_at")
  if (new Date(expiresAt) <= new Date(issuedAt)) throw new Error("bootstrap: expires_at must be after issued_at")
  return {
    config_version: requireVersion(obj["config_version"]),
    proxy: { url: requireProxyUrl(proxy["url"], "proxy.url") },
    issued_at: issuedAt,
    expires_at: expiresAt,
    signature: requireSignature(obj["signature"]),
  }
}

// The unsigned message that gets signed: the config object WITHOUT `signature`,
// serialized as deterministic (canonically-keyed) JSON. This is stable across
// platforms/JSON libraries so the signer and verifier agree byte-for-byte.
export function signingMessage(input: BootstrapConfig): string {
  return canonicalJson({
    config_version: input.config_version,
    proxy: { url: input.proxy.url },
    issued_at: input.issued_at,
    expires_at: input.expires_at,
  } satisfies Omit<BootstrapConfig, "signature">)
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

export interface VerifyConfigOptions {
  now?: Date
  publicKeyHex?: string
  allowExpired?: boolean
}

/** Validate structure, version, time window, and signature. Returns the config on success. */
export async function verifyConfig(
  raw: unknown,
  options: VerifyConfigOptions = {},
): Promise<{ ok: true; config: BootstrapConfig } | { ok: false; error: VerifyError }> {
  let config: BootstrapConfig
  try {
    config = parseConfig(raw)
  } catch (e) {
    return { ok: false, error: { _tag: "Malformed", message: (e as Error).message } }
  }

  if (config.config_version !== KOTE_BOOTSTRAP_CONFIG_VERSION) {
    return { ok: false, error: { _tag: "UnknownConfigVersion", got: config.config_version } }
  }

  const now = options.now ?? new Date()
  const issued = new Date(config.issued_at)
  const expires = new Date(config.expires_at)
  if (issued > now) return { ok: false, error: { _tag: "NotYetValid", issuedAt: config.issued_at, now } }
  if (!options.allowExpired && expires <= now) {
    return { ok: false, error: { _tag: "Expired", expiresAt: config.expires_at, now } }
  }

  // Verify the detached signature over the canonical unsigned message.
  // The signature must be valid hex decoding to 64 bytes; anything else is a
  // bad signature (not a crash). Wrap verifyAsync so a malformed signature or
  // an internal library throw is reported as BadSignature.
  const msg = new TextEncoder().encode(signingMessage(config))
  const pub = Buffer.from(options.publicKeyHex ?? KOTE_BOOTSTRAP_PUBLIC_KEY_HEX, "hex")
  let valid = false
  try {
    if (!/^[0-9a-f]{128}$/i.test(config.signature)) throw new Error("invalid Ed25519 signature")
    const sig = Buffer.from(config.signature, "hex")
    if (sig.length !== 64 || pub.length !== 32) throw new Error("invalid Ed25519 key material")
    valid = await verifyAsync(sig, msg, pub)
  } catch {
    valid = false
  }
  if (!valid) return { ok: false, error: { _tag: "BadSignature" } }

  return { ok: true, config }
}

// ── Sign (used by scripts/sign-bootstrap.ts and tests; never in the client runtime) ──

/** Sign an unsigned config with the project's private key, returning a complete signed config. */
export async function signConfig(
  unsigned: Omit<BootstrapConfig, "signature">,
  privateKeyHex: string,
): Promise<BootstrapConfig> {
  const normalized = parseConfig({ ...unsigned, signature: "unsigned" })
  const msg = new TextEncoder().encode(signingMessage(normalized))
  const priv = Buffer.from(privateKeyHex, "hex")
  const sig = await signAsync(msg, priv)
  return { ...normalized, signature: Buffer.from(sig).toString("hex") }
}

// ── Cache (last-known-good) ─────────────────────────────────────────────────

export function cachePath(): string {
  return path.join(Global.Path.cache, "kote", "bootstrap.json")
}

/** Read the cached config. Corrupt/unreadable cache never throws — returns null. */
export async function readCache(
  file = cachePath(),
  options: Pick<VerifyConfigOptions, "now" | "publicKeyHex"> = {},
): Promise<BootstrapConfig | null> {
  try {
    const raw = await fs.readFile(file, "utf8")
    const parsed = JSON.parse(raw)
    // Expiry is evaluated by isCacheUsable so the documented emergency grace
    // period remains reachable. Structure, signature and issued_at are still
    // revalidated here to defend against an edited cache file.
    const result = await verifyConfig(parsed, { ...options, allowExpired: true })
    return result.ok ? result.config : null
  } catch {
    return null
  }
}

/** Persist a verified config as last-known-good. Never throws. */
export async function writeCache(config: BootstrapConfig, file = cachePath()): Promise<void> {
  const temporary = `${file}.tmp-${process.pid}`
  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(temporary, JSON.stringify(config, null, 2), "utf8")
    await fs.rename(temporary, file)
  } catch {
    // Swallow: cache write failure must not crash the app.
    await fs.rm(temporary, { force: true }).catch(() => {})
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

const DEFAULT_BOOTSTRAP_URL = "https://kote-bootstrap.kotey-ye.ru/bootstrap.json"

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
export async function fetchRemote(
  url: string = Flag.KOTECODE_BOOTSTRAP_URL ?? DEFAULT_BOOTSTRAP_URL,
): Promise<unknown> {
  const target = URL.parse(url)
  if (!target || target.protocol !== "https:") throw new Error("bootstrap URL must use HTTPS")
  if (target.username || target.password) throw new Error("bootstrap URL must not contain credentials")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), KOTE_BOOTSTRAP_TIMEOUT_MS)
  try {
    const res = await fetch(target, {
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

export interface ResolvedProxy {
  url: string
  source: Exclude<ConfigSource, "disabled" | "none">
  config?: BootstrapConfig
}

/**
 * Resolve the Kote Gateway endpoint:
 *   1. KOTECODE_DISABLE_PROXY — explicit direct mode
 *   2. KOTECODE_PROXY_URL — explicit proxy override
 *   3. fresh remote bootstrap (signature + window verified)
 *   4. last-known-good cache (still usable, incl. grace period)
 *   5. none — returns a descriptive error
 *
 * A verified remote config is persisted to the cache (invalid ones never overwrite it).
 */
export interface DisabledProxy {
  source: "disabled"
}

export interface ResolveFailure {
  source: "none"
  reason: string
  hint?: string
}

export type ConfigSource = "disabled" | "environment" | "custom" | "remote" | "cache" | "none"
export type ResolveProxyResult = DisabledProxy | ResolvedProxy | ResolveFailure

export interface ResolveProxyOptions {
  fetch?: () => Promise<unknown>
  cacheFile?: string
  now?: Date
  publicKeyHex?: string
  customUrl?: string
}

export async function resolveProxy(options: ResolveProxyOptions = {}): Promise<ResolveProxyResult> {
  if (Flag.KOTECODE_DISABLE_PROXY) return { source: "disabled" }

  const envUrl = Flag.KOTECODE_PROXY_URL
  if (envUrl) {
    try {
      return {
        url: requireProxyUrl(envUrl, "KOTECODE_PROXY_URL"),
        source: "environment",
      }
    } catch (error) {
      return {
        source: "none",
        reason: error instanceof Error ? error.message : "KOTECODE_PROXY_URL is invalid.",
        hint: "Set KOTECODE_PROXY_URL to a valid HTTPS proxy origin or use KOTECODE_DISABLE_PROXY=1.",
      }
    }
  }

  if (options.customUrl) {
    const value = customProxyUrl(options.customUrl)
    if (value) return { url: value, source: "custom" }
    return {
      source: "none",
      reason: "The selected custom proxy URL is invalid.",
      hint: "Set the custom proxy to an HTTP or HTTPS origin without a path, query, or fragment.",
    }
  }

  let remoteReason = "remote bootstrap is unreachable"
  try {
    const raw = await (options.fetch ?? fetchRemote)()
    const result = await verifyConfig(raw, { now: options.now, publicKeyHex: options.publicKeyHex })
    if (result.ok) {
      await writeCache(result.config, options.cacheFile) // persist last-known-good
      return {
        url: result.config.proxy.url,
        source: "remote",
        config: result.config,
      }
    }
    remoteReason = `remote bootstrap was rejected (${result.error._tag})`
    // Invalid new config does NOT overwrite the cache. Fall through to cache.
  } catch {
    // Remote unreachable or malformed — fall through to cache.
  }

  // 4. Last-known-good cache.
  const cached = await readCache(options.cacheFile, { now: options.now, publicKeyHex: options.publicKeyHex })
  if (cached && isCacheUsable(cached, options.now)) {
    return {
      url: cached.proxy.url,
      source: "cache",
      config: cached,
    }
  }

  // 5. Nothing available.
  return {
    source: "none",
    reason: `Kote Gateway endpoint could not be resolved: ${remoteReason}, and no usable cached bootstrap exists.`,
    hint:
      "Set KOTECODE_PROXY_URL to an HTTPS proxy origin, use KOTECODE_DISABLE_PROXY=1 for explicit direct mode, " +
      "or restore the bootstrap service/cache.",
  }
}

export function customProxyUrl(value: string): string | undefined {
  const url = URL.parse(value)
  if (!url) return undefined
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
  if (url.pathname !== "/" || url.search || url.hash) return undefined
  const credentials = url.username || url.password ? `${url.username}${url.password ? `:${url.password}` : ""}@` : ""
  return `${url.protocol}//${credentials}${url.host}`
}
