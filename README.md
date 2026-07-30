```
█  █ █▀▀█ █▀▀█ █▀▀█  █▀▀▀ █▀▀█ █▀▀█ █▀▀█
█▀█  █  █  ██  █▀▀▀  █    █  █ █  █ █▀▀▀
█ ▀█ ▀▀▀▀  ▀▀  ▀▀▀▀  ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀
```

[English](README.md) | [Русский](README.ru.md)

# KoteCode

**KoteCode — AI coding agent based on OpenCode.**

KoteCode is an independent fork of [OpenCode](https://github.com/anomalyco/opencode). It is
**not** affiliated with, endorsed by, or an official product of the OpenCode team. It is a
separate project that builds on OpenCode's MIT-licensed source code.

> **Status:** preparing `v0.1.0`, the first public KoteCode release. Based on OpenCode `1.18.5`.

---

## What is KoteCode?

KoteCode is an AI coding agent you run from the terminal (TUI) or as a desktop app. It keeps
all of OpenCode's core capabilities — multi-provider chat, tool calling, sessions, the `build`
and `plan` agents — and adds:

- **Kote Gateway**, a network gateway for stable connectivity to API providers. Its
  endpoint is resolved from a **signed bootstrap configuration**.
- KoteCode-specific config directories and `KOTECODE_*` environment variables.
- A `kotecode` CLI command and KoteCode branding.

See [`docs/FORK_AUDIT.md`](./docs/FORK_AUDIT.md) for the full audit of what changed.

## ⚠️ Cost & data warning

Running KoteCode sends your prompts, code, and file contents to the AI provider you select.

- **API costs:** Most providers bill per token. Review your provider's pricing. KoteCode
  itself is free; the model usage is not.
- **Data:** Whatever you ask KoteCode to read or write is transmitted to the selected
  provider. With Kote Gateway enabled, provider traffic remains protected by end-to-end TLS:
  the gateway sees the destination hostname and transport metadata, but not your API key,
  prompts, code, or responses.

## Provider transport

You connect OpenAI, Anthropic, OpenRouter, and other providers exactly as in OpenCode,
using your own API key or the provider's supported authorization flow. You pay the provider;
KoteCode and Kote Gateway do not provide model credits.

By default, HTTPS model requests use Kote Gateway as a standard `CONNECT` tunnel:

```text
KoteCode ── CONNECT through Kote Gateway ── end-to-end TLS ── selected provider
```

The original provider URL, authentication, SDK, model catalog, streaming, tools, reasoning,
and multimodal behavior stay unchanged. Local HTTP providers such as Ollama remain direct.
In the Desktop app, routing is selected separately for each provider during connection
and can be changed later under **Settings → Providers**.

### How the Kote Gateway endpoint is resolved

The real Kote Gateway address is **not** hardcoded in KoteCode. At startup KoteCode:

1. Fetches a small, **Ed25519-signed** bootstrap configuration (over HTTPS, with a size cap
   and timeout — no redirects to unknown domains, no code execution from the config).
2. Verifies the signature against a public key baked into the binary.
3. Checks `config_version`, `issued_at`, and `expires_at`.
4. Uses the signed `proxy.url` for HTTPS provider requests.

This lets the gateway address change **without rebuilding KoteCode**. See
[`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md) for the format and signing process.

**Override for local development / diagnostics:** you can force a specific gateway address
without touching the bootstrap flow:

```bash
KOTECODE_PROXY_URL=https://kote-proxy.kotey-ye.ru kotecode
```

To explicitly bypass Kote Gateway and contact providers directly:

```bash
KOTECODE_DISABLE_PROXY=1 kotecode
```

KoteCode never silently falls back to a direct HTTPS request when the configured gateway is
unavailable.

## Installation

Install the CLI with npm:

```bash
npm install -g kotecode
kotecode --version
```

Or with the KoteCode Homebrew tap:

```bash
brew install koteyye/tap/kotecode
```

The checksum-verifying installers are also available:

```bash
# Linux or macOS
curl -fsSL https://raw.githubusercontent.com/koteyye/KoteCode/dev/install | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/koteyye/KoteCode/dev/install.ps1 | iex
```

Or build from source (requires [Bun](https://bun.sh) ≥ 1.3):

```bash
git clone https://github.com/koteyye/KoteCode.git
cd KoteCode
bun install
bun run packages/opencode/script/build.ts --single # produces dist/kotecode-*/bin/kotecode
```

### Supported release platforms

| Component | Platforms                                               |
| --------- | ------------------------------------------------------- |
| CLI       | Windows x64; Linux x64/ARM64; macOS Intel/Apple Silicon |
| Desktop   | Windows x64; Linux x64 (`AppImage`, `.deb`, `.rpm`)     |

macOS Desktop and Windows/Linux Desktop ARM64 are not included in `v0.1.0`.

> **Unsigned Windows builds:** the publisher is shown as unknown and SmartScreen may warn.
> Smart App Control or corporate policy can block execution. KoteCode is not distributed as
> MSIX or through Microsoft Store. Verify the downloaded file against `SHA256SUMS`.

### Updating and uninstalling

```bash
kotecode upgrade

npm uninstall -g kotecode
# or
brew uninstall koteyye/tap/kotecode
# direct installer
rm ~/.local/bin/kotecode
```

Remove Windows Desktop from **Installed apps**. Remove Linux packages with
`sudo apt remove kotecode` or `sudo dnf remove kotecode`; delete the AppImage for a portable install.
Application settings are retained so an update or reinstall does not discard them.

To verify a release download:

```bash
sha256sum -c SHA256SUMS --ignore-missing
```

On Windows, compare `(Get-FileHash <file> -Algorithm SHA256).Hash` with `SHA256SUMS`.
See [`RELEASING.md`](./RELEASING.md) for the release and approval process.

## Minimal configuration

KoteCode reads config from its own directories (separate from OpenCode's):

| OS      | Config dir                               |
| ------- | ---------------------------------------- |
| Linux   | `~/.config/kotecode`                     |
| macOS   | `~/Library/Application Support/kotecode` |
| Windows | `%APPDATA%\kotecode`                     |

Provider configuration remains OpenCode-compatible. For example:

```jsonc
{
  // Your own provider credentials and models; Kote Gateway is transport, not a provider.
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
kotecode migrate-from-opencode            # copies non-secret settings only
kotecode migrate-from-opencode --with-secrets   # also imports keys (explicit opt-in)
```

Your original OpenCode files are left untouched.

## Environment variables

KoteCode adds `KOTECODE_*` variables on top of OpenCode's `OPENCODE_*` (both still work):

| Variable                        | Purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| `KOTECODE_CONFIG`               | Path to a config file                                  |
| `KOTECODE_CONFIG_DIR`           | Override the config directory                          |
| `KOTECODE_DATA_DIR`             | Override the data directory                            |
| `KOTECODE_CACHE_DIR`            | Override the cache directory                           |
| `KOTECODE_BOOTSTRAP_URL`        | Override the bootstrap config URL (dev/testing)        |
| `KOTECODE_PROXY_URL`            | Force the HTTPS Proxy origin (priority over bootstrap) |
| `KOTECODE_DISABLE_PROXY`        | Explicitly use direct provider transport               |
| `KOTECODE_DISABLE_UPDATE_CHECK` | Disable the cached, non-blocking update notification   |
| `KOTECODE_LANG`                 | Terminal UI language: `ru` or `en`                     |

The terminal interface defaults to Russian. It can be switched only between Russian and English
in `tui.json` inside the configuration directory:

```json
{
  "language": "en"
}
```

For a one-off Russian launch:

```bash
KOTECODE_LANG=ru kotecode
```

Full reference: [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md).

## Documentation

- [`docs/FORK_AUDIT.md`](./docs/FORK_AUDIT.md) — audit of the OpenCode base
- [`docs/UPSTREAM.md`](./docs/UPSTREAM.md) — syncing from upstream OpenCode
- [`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md) — signed bootstrap config format & signing
- [`docs/NETWORK.md`](./docs/NETWORK.md) — every network call KoteCode makes
- [`docs/PROXY_COMPATIBILITY.md`](./docs/PROXY_COMPATIBILITY.md) — verified and pending provider paths
- [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md) — directories, env vars, modes
- [`docs/BUILD.md`](./docs/BUILD.md) — building from source
- [`RELEASING.md`](./RELEASING.md) — release, npm, Homebrew, and signing procedure
- [`docs/TZ-2-KOTE-PROXY.md`](./docs/TZ-2-KOTE-PROXY.md) — Kote Gateway contract and threat model

## License

MIT — see [`LICENSE`](./LICENSE). KoteCode is based on OpenCode (© 2025 opencode, MIT); see
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for attribution.
