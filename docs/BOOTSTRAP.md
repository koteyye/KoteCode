# Kote Proxy bootstrap configuration

The Kote Proxy address is not hardcoded in KoteCode. KoteCode fetches a small
Ed25519-signed bootstrap configuration, verifies it, and applies the signed Proxy
origin to HTTPS provider requests.

The selected provider does not change. KoteCode still sends the original provider
URL and the user's own credentials through an HTTPS `CONNECT` tunnel with end-to-end
TLS.

## Format

```json
{
  "config_version": 1,
  "proxy": {
    "url": "https://kote-proxy.kotey-ye.ru"
  },
  "issued_at": "2026-07-28T00:00:00.000Z",
  "expires_at": "2026-08-27T00:00:00.000Z",
  "signature": "<64-byte Ed25519 signature, hex-encoded>"
}
```

| Field            | Type            | Notes                                                          |
| ---------------- | --------------- | -------------------------------------------------------------- |
| `config_version` | number          | Must equal `1`; unknown versions are rejected                  |
| `proxy.url`      | string          | HTTPS origin without credentials, path, query, or fragment     |
| `issued_at`      | ISO 8601 string | Must be less than or equal to the current time                 |
| `expires_at`     | ISO 8601 string | Must be later than `issued_at` and the current time            |
| `signature`      | hex string      | Detached Ed25519 signature over the object without `signature` |

An old `{ gateway: { base_url, models_url } }` document is invalid under this
schema. The change is intentional and happened before the first public release.

## Canonical signing message

The signed message is the config without `signature`, serialized as deterministic
JSON:

- object keys sorted recursively by UTF-16 code unit order;
- no insignificant whitespace;
- `undefined` fields omitted;
- arrays preserved in order.

`canonicalJson()` and `signingMessage()` in
`packages/core/src/kote/bootstrap.ts` are the source of truth.

## Cryptography

- Algorithm: Ed25519 via `@noble/ed25519`.
- Key pair: 32-byte private key and 32-byte public key.
- The client contains only `KOTE_BOOTSTRAP_PUBLIC_KEY_HEX`.
- The private key stays outside both the KoteCode and Kote Proxy repositories,
  builds, CI logs, and release artifacts.

## Signing

```bash
bun run scripts/sign-bootstrap.ts \
  --key /path/outside/repos/ed25519-private.key \
  --proxy-url https://kote-proxy.kotey-ye.ru \
  --days 30 \
  --out bootstrap.signed.json
```

The key path can also come from `KOTE_BOOTSTRAP_PRIVATE_KEY`. The signer verifies its
own output before writing and never prints the private key.

Publish the JSON at `https://kote-bootstrap.kotey-ye.ru/bootstrap.json`. Development and
tests can override that URL with `KOTECODE_BOOTSTRAP_URL`. The bootstrap endpoint is
separate from `https://kote-proxy.kotey-ye.ru`: the Proxy intentionally exposes only
`CONNECT` and `GET /health`.

## Resolution order

`resolveProxy()` uses this order:

1. `KOTECODE_DISABLE_PROXY=1` — explicit direct mode (`disabled`);
2. `KOTECODE_PROXY_URL` — explicit HTTPS Proxy origin (`environment`);
3. fresh signed remote bootstrap (`remote`);
4. signed last-known-good cache (`cache`);
5. descriptive failure (`none`).

An invalid `KOTECODE_PROXY_URL` fails closed. An unavailable remote bootstrap can
use the verified cache, but KoteCode never silently sends an HTTPS provider request
directly when Proxy resolution failed.

Local plain-HTTP provider requests are not passed to the remote Proxy.

## Client-side security

- 10-second bootstrap timeout;
- 64 KiB maximum response size;
- redirects rejected;
- signature verified before `proxy.url` is used;
- version and time window checked;
- Proxy URL must be an HTTPS origin;
- credentials, path, query, and fragment are rejected in the Proxy URL;
- no `eval`, command execution, or executable config;
- invalid remote data never overwrites the valid cache;
- a corrupted cache does not crash KoteCode;
- no hidden fallback Proxy address is embedded.

## Cache and emergency operation

The last verified config is stored at `<cache>/kote/bootstrap.json`.

When the remote bootstrap is unreachable, an expired cache may be used for seven
days after `expires_at`. After that grace period, Proxy resolution fails until the
bootstrap is restored or the user explicitly selects direct mode.

## Rotating the Proxy address

1. Deploy and verify the new HTTPS `CONNECT` endpoint.
2. Sign a new bootstrap with `--proxy-url`.
3. Publish the signed JSON.
4. Keep the old Proxy available during rollout and the cache grace window.

No KoteCode rebuild is required.

## Rotating the signing key

1. Generate a new key pair outside the repositories.
2. Replace `KOTE_BOOTSTRAP_PUBLIC_KEY_HEX` in KoteCode.
3. Sign new configs with the new private key.
4. Build and ship KoteCode with the new public key.
5. Publish the newly signed config according to the release cutover plan.

The current client accepts one public key, so overlapping old/new signatures require
a future multi-key client change.
