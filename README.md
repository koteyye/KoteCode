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

- The **Kote Gateway** as a first-class provider, whose endpoint is resolved at runtime from a
  **signed bootstrap configuration** (no hardcoded gateway URL).
- KoteCode-specific config directories and `KOTECODE_*` environment variables.
- A `kotencode` CLI command and KoteCode branding.

See [`docs/FORK_AUDIT.md`](./docs/FORK_AUDIT.md) for the full audit of what changed.

## ⚠️ Cost & data warning

Running KoteCode sends your prompts, code, and file contents to the AI provider you select.

- **API costs:** Most providers bill per token. Review your provider's pricing. KoteCode
  itself is free; the model usage is not.
- **Data:** Whatever you ask KoteCode to read or write is transmitted to the selected
  provider's endpoint. Understand your provider's data policy before sending sensitive code.

## Connection modes

KoteCode supports three ways to reach a model, and you always know which one is in use:

| Mode | What it is | Endpoint |
|---|---|---|
| **Kote Gateway** | KoteCode's own gateway | Resolved at runtime from a **signed bootstrap config** (see below) |
| **Direct OpenRouter** | Your own OpenRouter account | `openrouter.ai` (your key) |
| **Other providers** | Anthropic, OpenAI, Google, Bedrock, Azure, … | Each provider's own endpoint |

The Kote Gateway is presented explicitly as a provider — it is **not** a hidden substitution
for OpenRouter or any other provider. KoteCode never silently switches you between modes.

### How the Kote Gateway endpoint is resolved

The real Kote Gateway address is **not** hardcoded in KoteCode. At startup KoteCode:

1. Fetches a small, **Ed25519-signed** bootstrap configuration (over HTTPS, with a size cap
   and timeout — no redirects to unknown domains, no code execution from the config).
2. Verifies the signature against a public key baked into the binary.
3. Checks `config_version`, `issued_at`, and `expires_at`.
4. Uses the signed `gateway.base_url` as the provider's `baseURL`.

This lets the gateway address change **without rebuilding KoteCode**. See
[`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md) for the format and signing process.

**Override for local development / diagnostics:** you can force a specific gateway address
without touching the bootstrap flow:

```bash
KOTECODE_GATEWAY_URL=https://your-test-endpoint.example/api/v1 kotencode
```

`KOTECODE_GATEWAY_URL` takes priority over the bootstrap configuration. The source of the
currently active configuration (environment / remote bootstrap / cached bootstrap) is visible
in diagnostics.

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
./packages/opencode/script/build.ts --single     # produces dist/kotecode-*/bin/kotecode
```

## Minimal configuration

KoteCode reads config from its own directories (separate from OpenCode's):

| OS | Config dir |
|---|---|
| Linux | `~/.config/kotecode` |
| macOS | `~/Library/Application Support/kotecode` |
| Windows | `%APPDATA%\kotencode` |

Create `~/.config/kotecode/kotecode.jsonc` (or use env vars):

```jsonc
{
  // Use the Kote Gateway (endpoint resolved from signed bootstrap)
  "provider": {
    "kote-gateway": { "models": { /* your model ids */ } }
  }
}
```

API keys: set `KOTECODE_GATEWAY_API_KEY` (Kote Gateway) or the provider's own env var. Keys
are never written to logs or error messages. See [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md).

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

| Variable | Purpose |
|---|---|
| `KOTECODE_CONFIG` | Path to a config file |
| `KOTECODE_CONFIG_DIR` | Override the config directory |
| `KOTECODE_DATA_DIR` | Override the data directory |
| `KOTECODE_CACHE_DIR` | Override the cache directory |
| `KOTECODE_BOOTSTRAP_URL` | Override the bootstrap config URL (dev/testing) |
| `KOTECODE_GATEWAY_URL` | Force the gateway address (priority over bootstrap) |
| `KOTECODE_GATEWAY_API_KEY` | Provide the gateway key via env (not written to config) |
| `KOTECODE_DISABLE_UPDATE_CHECK` | Disable the update check |

Full reference: [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md).

## Documentation

- [`docs/FORK_AUDIT.md`](./docs/FORK_AUDIT.md) — audit of the OpenCode base
- [`docs/UPSTREAM.md`](./docs/UPSTREAM.md) — syncing from upstream OpenCode
- [`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md) — signed bootstrap config format & signing
- [`docs/NETWORK.md`](./docs/NETWORK.md) — every network call KoteCode makes
- [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md) — directories, env vars, modes
- [`docs/BUILD.md`](./docs/BUILD.md) — building from source

## License

MIT — see [`LICENSE`](./LICENSE). KoteCode is based on OpenCode (© 2025 opencode, MIT); see
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for attribution.
