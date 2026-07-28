```
█  █ █▀▀█ █▀▀█ █▀▀█  █▀▀▀ █▀▀█ █▀▀█ █▀▀█
█▀█  █  █  ██  █▀▀▀  █    █  █ █  █ █▀▀▀
█ ▀█ ▀▀▀▀  ▀▀  ▀▀▀▀  ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀
```

# KoteCode

**KoteCode — AI coding agent based on OpenCode.**

KoteCode is an independent fork of [OpenCode](https://github.com/anomalyco/opencode). It is
**not** affiliated with, endorsed by, or an official product of the OpenCode team. It is a
separate project that builds on OpenCode's MIT-licensed source code.

> **Status:** `0.1.0-alpha.1` — internal testing only. Based on OpenCode `1.18.5`.

---

## What is KoteCode?

KoteCode is an AI coding agent you run from the terminal (TUI) or as a desktop app. It keeps
all of OpenCode's core capabilities — multi-provider chat, tool calling, sessions, the `build`
and `plan` agents — and adds:

- The **Kote Proxy**, a transparent HTTPS `CONNECT` transport for the existing OpenCode
  providers. Its endpoint is resolved from a **signed bootstrap configuration**.
- KoteCode-specific config directories and `KOTECODE_*` environment variables.
- A `kotencode` CLI command and KoteCode branding.

See [`docs/FORK_AUDIT.md`](./docs/FORK_AUDIT.md) for the full audit of what changed.

## ⚠️ Cost & data warning

Running KoteCode sends your prompts, code, and file contents to the AI provider you select.

- **API costs:** Most providers bill per token. Review your provider's pricing. KoteCode
  itself is free; the model usage is not.
- **Data:** Whatever you ask KoteCode to read or write is transmitted to the selected
  provider. With Kote Proxy enabled, provider traffic remains protected by end-to-end TLS:
  the Proxy sees the destination hostname and transport metadata, but not your API key,
  prompts, code, or responses.

## Provider transport

You connect OpenAI, Anthropic, OpenRouter, and other providers exactly as in OpenCode,
using your own API key or the provider's supported authorization flow. You pay the provider;
KoteCode and Kote Proxy do not provide model credits.

By default, HTTPS model requests use Kote Proxy as a standard `CONNECT` tunnel:

```text
KoteCode ── CONNECT through Kote Proxy ── end-to-end TLS ── selected provider
```

The original provider URL, authentication, SDK, model catalog, streaming, tools, reasoning,
and multimodal behavior stay unchanged. Local HTTP providers such as Ollama remain direct.

### How the Kote Proxy endpoint is resolved

The real Kote Proxy address is **not** hardcoded in KoteCode. At startup KoteCode:

1. Fetches a small, **Ed25519-signed** bootstrap configuration (over HTTPS, with a size cap
   and timeout — no redirects to unknown domains, no code execution from the config).
2. Verifies the signature against a public key baked into the binary.
3. Checks `config_version`, `issued_at`, and `expires_at`.
4. Uses the signed `proxy.url` for HTTPS provider requests.

This lets the Proxy address change **without rebuilding KoteCode**. See
[`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md) for the format and signing process.

**Override for local development / diagnostics:** you can force a specific Proxy address
without touching the bootstrap flow:

```bash
KOTECODE_PROXY_URL=https://proxy.example:443 kotencode
```

To explicitly bypass Kote Proxy and contact providers directly:

```bash
KOTECODE_DISABLE_PROXY=1 kotencode
```

KoteCode never silently falls back to a direct HTTPS request when the configured Proxy is
unavailable.

## Installation

> Alpha builds are produced by the draft release workflow. See [`docs/BUILD.md`](./docs/BUILD.md)
> for building from source.

```bash
# From a GitHub release (once published)
curl -fsSL https://github.com/koteyye/KoteCode/raw/main/install | bash
```

Or build from source (requires [Bun](https://bun.sh) ≥ 1.3):

```bash
git clone https://github.com/koteyye/KoteCode.git
cd KoteCode
bun install
bun run packages/opencode/script/build.ts --single # produces dist/kotencode-*/bin/kotencode
```

## Minimal configuration

KoteCode reads config from its own directories (separate from OpenCode's):

| OS      | Config dir                                |
| ------- | ----------------------------------------- |
| Linux   | `~/.config/kotencode`                     |
| macOS   | `~/Library/Application Support/kotencode` |
| Windows | `%APPDATA%\kotencode`                     |

Provider configuration remains OpenCode-compatible. For example:

```jsonc
{
  // Your own provider credentials and models; Kote Proxy is transport, not a provider.
  "provider": {
    "openai": {},
  },
}
```

Provide the normal provider credential (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
`OPENROUTER_API_KEY`, or the built-in authorization command). Credentials remain inside the
end-to-end TLS tunnel and are never sent as Proxy authentication. See
[`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md).

### Migrating from an existing OpenCode install

KoteCode does **not** touch your OpenCode configuration automatically. To import non-secret
settings on demand:

```bash
kotencode migrate-from-opencode            # copies non-secret settings only
kotencode migrate-from-opencode --with-secrets   # also imports keys (explicit opt-in)
```

Your original OpenCode files are left untouched.

## Environment variables

KoteCode adds `KOTECODE_*` variables on top of OpenCode's `OPENCODE_*` (both still work):

| Variable                        | Purpose                                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| `KOTECODE_CONFIG`               | Path to a config file                                                 |
| `KOTECODE_CONFIG_DIR`           | Override the config directory                                         |
| `KOTECODE_DATA_DIR`             | Override the data directory                                           |
| `KOTECODE_CACHE_DIR`            | Override the cache directory                                          |
| `KOTECODE_BOOTSTRAP_URL`        | Override the bootstrap config URL (dev/testing)                       |
| `KOTECODE_PROXY_URL`            | Force the HTTPS Proxy origin (priority over bootstrap)                |
| `KOTECODE_DISABLE_PROXY`        | Explicitly use direct provider transport                              |
| `KOTECODE_DISABLE_UPDATE_CHECK` | Reserved update-check kill switch; alpha updates are already disabled |

Full reference: [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md).

## Documentation

- [`docs/FORK_AUDIT.md`](./docs/FORK_AUDIT.md) — audit of the OpenCode base
- [`docs/UPSTREAM.md`](./docs/UPSTREAM.md) — syncing from upstream OpenCode
- [`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md) — signed bootstrap config format & signing
- [`docs/NETWORK.md`](./docs/NETWORK.md) — every network call KoteCode makes
- [`docs/PROXY_COMPATIBILITY.md`](./docs/PROXY_COMPATIBILITY.md) — verified and pending provider paths
- [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md) — directories, env vars, modes
- [`docs/BUILD.md`](./docs/BUILD.md) — building from source
- [`docs/TZ-2-KOTE-PROXY.md`](./docs/TZ-2-KOTE-PROXY.md) — Kote Proxy contract and threat model

## License

MIT — see [`LICENSE`](./LICENSE). KoteCode is based on OpenCode (© 2025 opencode, MIT); see
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for attribution.
