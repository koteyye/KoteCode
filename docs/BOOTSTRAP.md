# Kote Gateway bootstrap configuration

The Kote Gateway endpoint is **not** hardcoded in KoteCode. At startup KoteCode fetches
a small, **Ed25519-signed** bootstrap configuration over HTTPS, verifies it, and uses
the signed `gateway.base_url` as the provider's address. This lets the gateway move
without rebuilding or redistributing KoteCode.

This document covers the format, the signing process, and the safe procedure for
rotating the gateway address or the signing key.

## Format

The bootstrap config is a JSON object (concrete example with placeholder values):

```json
{
  "config_version": 1,
  "gateway": {
    "base_url": "https://<current-kote-gateway>/api/v1",
    "models_url": "https://<current-kote-gateway>/api/v1/models"
  },
  "issued_at": "2026-07-25T00:00:00Z",
  "expires_at": "2026-08-25T00:00:00Z",
  "signature": "<64-byte Ed25519 signature, hex-encoded>"
}
```

Fields:

| Field | Type | Notes |
|---|---|---|
| `config_version` | number | Must equal `1`. Unknown versions are rejected. |
| `gateway.base_url` | string | Required. Becomes the provider `baseURL`. Must be `https://`. |
| `gateway.models_url` | string | Optional. Used to list available models. |
| `issued_at` | ISO 8601 string | Must be ≤ now. |
| `expires_at` | ISO 8601 string | Must be > now (or within the grace window, see §Cache). |
| `signature` | hex string | Detached Ed25519 signature over the canonical JSON of the object **without** `signature`. |

### Signing message (canonical form)

The signed message is the config object with the `signature` field removed, serialized
as deterministic JSON:

- object keys sorted recursively (UTF-16 code unit order)
- no insignificant whitespace
- `undefined` fields omitted
- arrays preserved in order

See `canonicalJson()` / `signingMessage()` in `packages/core/src/kote/bootstrap.ts`.

## Cryptography

- **Algorithm:** Ed25519 (RFC 8032), via [`@noble/ed25519`](https://github.com/paulmillr/noble-curves).
- **Key pair:** 32-byte private key + 32-byte public key.
- **Embedded in KoteCode (public, in the repo):** `KOTE_BOOTSTRAP_PUBLIC_KEY_HEX` in
  `packages/core/src/kote/keys.ts`. Only the public key is shipped.
- **Private key (secret):** kept by the project owner **outside** the repo. It never
  enters the client, the build, CI logs, or release artifacts. `.gitignore` blocks
  `*.key`, `*.pem`, `KoteCode-secret/`, `bootstrap-private*`.

## Signing a new config (project owner only)

Use `scripts/sign-bootstrap.ts`:

```bash
bun run scripts/sign-bootstrap.ts \
  --key /path/to/ed25519-private.key \
  --base-url https://<current-kote-gateway>/api/v1 \
  --models-url https://<current-kote-gateway>/api/v1/models \
  --days 30 \
  --out bootstrap.signed.json
```

The key path defaults to the `KOTE_BOOTSTRAP_PRIVATE_KEY` env var. The script
self-verifies the output before writing, so a bad key or bug never ships a broken
config. It never prints the private key.

Publish the signed JSON at your bootstrap HTTPS endpoint. The default URL the client
fetches is `https://bootstrap.kotencode.ai/bootstrap.json`; override per-environment
with `KOTECODE_BOOTSTRAP_URL` (mainly for local dev and tests).

## How the client uses it

Resolution order (`resolveGateway()` in `packages/core/src/kote/bootstrap.ts`):

1. **`KOTECODE_GATEWAY_URL`** env — explicit override, highest priority (source: `environment`).
2. **Fresh remote bootstrap** — fetched, signature + version + time-window verified
   (source: `remote`). A verified remote config is persisted to the cache.
3. **Cached last-known-good** — used when remote is unreachable (source: `cache`).
4. **None** — returns a descriptive error with a diagnostic hint (source: `none`).

The source of the active configuration is surfaced so the user always knows where the
endpoint came from.

### Security enforced by the client

- HTTP **timeout** (10 s) and **max response size** (64 KiB).
- `redirect: "error"` — no redirect following; the bootstrap URL is pinned and trusted.
- Signature verified **before** any URL is used.
- `config_version`, `issued_at`, `expires_at` validated.
- No `eval`, no command execution, no code from the config.
- No hidden fallback gateway URL embedded in the client.
- An **invalid new config never overwrites** the last-known-good cache.
- A **corrupted cache never crashes** the app (re-verification; parse errors swallowed).

## Cache and emergency operation

The last successfully verified config is stored at `<cache>/kote/bootstrap.json`
(`~/.cache/kotencode/kote/bootstrap.json` on Linux). When the remote bootstrap is
unreachable, the cache is used.

An **expired** cached config may still be used for a limited **grace period** after
expiry — **7 days** (`KOTE_BOOTSTRAP_GRACE_PERIOD_MS`). This bounds emergency
operation: the client will not use an expired config indefinitely. Beyond the grace
period, resolution fails with a clear error.

`isCacheUsable()` implements: non-expired → usable; within grace → usable; past grace → unusable.

## Rotating the gateway address

To change where KoteCode sends Kote Gateway traffic **without** a new build:

1. Stand up the new gateway endpoint.
2. Sign a new bootstrap config with the existing private key (`--base-url <new>`).
3. Publish it at the bootstrap HTTPS endpoint.
4. Clients pick it up on next launch (fresh fetch takes priority over cache).

No client rebuild or redistribution is required.

## Rotating the signing key

Key compromise rotation is a larger operation:

1. Generate a new Ed25519 keypair (keep the new private key outside the repo).
2. Update `KOTE_BOOTSTRAP_PUBLIC_KEY_HEX` in `packages/core/src/kote/keys.ts` to the new public key.
3. Sign new configs with the new private key.
4. Build and ship a KoteCode release that embeds the new public key.
5. (Optional overlap) You can serve both old- and new-signed configs during the
   transition only if the client accepts multiple keys — the current client accepts
   exactly one, so plan a clean cutover.

> **Security note:** relying on the gateway address being secret is **not** a security
> measure (spec ТЗ §9.7). Even if the address becomes known, access is controlled by
> API keys, tokens, and rate limiting on the gateway itself.
