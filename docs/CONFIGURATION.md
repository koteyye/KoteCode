# Configuration

KoteCode is configured through config files (JSON/JSONC) and environment variables.
It keeps all of OpenCode's `OPENCODE_*` variables working and adds `KOTECODE_*`
on top; when both are set, KoteCode's take precedence.

## Directories

A new KoteCode install uses its own directories (separate from OpenCode's):

| Directory | Linux                      | macOS                                     | Windows                          |
| --------- | -------------------------- | ----------------------------------------- | -------------------------------- |
| config    | `~/.config/kotencode`      | `~/Library/Application Support/kotencode` | `%APPDATA%\kotencode`            |
| data      | `~/.local/share/kotencode` | `~/Library/Application Support/kotencode` | `%LOCALAPPDATA%\kotencode`       |
| cache     | `~/.cache/kotencode`       | `~/Library/Caches/kotencode`              | `%LOCALAPPDATA%\kotencode\cache` |
| state     | `~/.local/state/kotencode` | `~/Library/Application Support/kotencode` | `%LOCALAPPDATA%\kotencode\state` |
| log       | `<data>/log`               | `<data>/log`                              | `<data>\log`                     |

### Overriding directories

Each directory can be overridden by environment variable (KoteCode takes precedence
over the OpenCode equivalent, which takes precedence over the platform default):

| Override env                                           | What it sets     |
| ------------------------------------------------------ | ---------------- |
| `KOTECODE_CONFIG_DIR`                                  | config directory |
| `KOTECODE_DATA_DIR`                                    | data directory   |
| `KOTECODE_CACHE_DIR`                                   | cache directory  |
| (`OPENCODE_CONFIG_DIR` is still honored as a fallback) |                  |

## Config files

KoteCode loads `config.json`, `opencode.json`, `opencode.jsonc`, `kotencode.json`,
and `kotencode.jsonc` from the config directory. Later files override earlier files,
so the KoteCode-branded files have priority. The default write target is
`kotencode.jsonc`.

Project-local config is discovered by walking up from the current directory looking
for the upstream-compatible `.opencode/` folder and JSON/JSONC files inside it.

Set the config file path explicitly:

```bash
KOTECODE_CONFIG=/path/to/my-config.jsonc kotencode
```

### Minimal example

```jsonc
{
  // Configure the normal OpenCode provider. Kote Proxy is transport, not a provider.
  "provider": {
    "openai": {},
  },
}
```

Provide the normal provider credential through its environment variable, auth store,
or supported authorization flow.

## Environment variables

### KoteCode (`KOTECODE_*`)

| Variable                        | Purpose                                                                   |
| ------------------------------- | ------------------------------------------------------------------------- |
| `KOTECODE_CONFIG`               | Path to a config file (merged as local scope)                             |
| `KOTECODE_CONFIG_DIR`           | Override the config directory                                             |
| `KOTECODE_DATA_DIR`             | Override the data directory                                               |
| `KOTECODE_CACHE_DIR`            | Override the cache directory                                              |
| `KOTECODE_BOOTSTRAP_URL`        | Override the bootstrap config URL (dev/testing)                           |
| `KOTECODE_PROXY_URL`            | Force the HTTPS Proxy origin — **priority over bootstrap**                |
| `KOTECODE_DISABLE_PROXY`        | Explicitly send provider requests directly                                |
| `KOTECODE_DISABLE_UPDATE_CHECK` | Reserved update-check kill switch; updates are currently disabled         |
| `KOTECODE_BIN_PATH`             | Point the launcher at a specific binary (also honors `OPENCODE_BIN_PATH`) |
| `KOTECODE_LANG`                 | Terminal UI language: `ru` or `en`                                       |

KoteCode does not perform automatic update checks and rejects manual/API
upgrade requests. Install a newer build explicitly from the KoteCode GitHub Releases
page. The dormant upstream updater must not be enabled until every source and install
method has been replaced with KoteCode-owned release infrastructure.

### OpenCode compatibility (`OPENCODE_*`)

All OpenCode environment variables continue to work (`OPENCODE_CONFIG`,
`OPENCODE_MODELS_URL`, `OPENCODE_DISABLE_AUTOUPDATE`, `OPENCODE_DISABLE_SHARE`,
`OPENCODE_CLIENT`, etc.). They are documented in the OpenCode base. KoteCode does not
remove or rename any of them.

## Terminal language

The terminal UI supports Russian and English only. Russian is the default. Set the
language in `tui.json` inside the KoteCode config directory:

```json
{
  "language": "ru"
}
```

`KOTECODE_LANG=ru|en` selects the language when `language` is not set in the file.
An explicit `tui.json` value takes precedence over the environment variable.

## Provider transport

Kote Proxy wraps existing providers; it does not add a provider ID or credential.

| Transport                | Provider URL and credentials | Network path                                    |
| ------------------------ | ---------------------------- | ----------------------------------------------- |
| **Kote Proxy** (default) | Unchanged                    | HTTPS `CONNECT` tunnel from signed Proxy origin |
| **Direct**               | Unchanged                    | KoteCode connects directly to the provider      |

The Desktop app lets you choose this mode while connecting each provider and change
it later in **Settings → Providers**. The model selector shows the selected mode once
in the provider group heading.

The same choice can be configured manually per provider:

```jsonc
{
  "provider": {
    "openai": {
      "routing": "proxy", // "proxy" (default) or "direct"
    },
    "anthropic": {
      "routing": "direct",
    },
  },
}
```

Providers without an explicit `routing` value use Kote Proxy. The
`KOTECODE_DISABLE_PROXY=1` environment override still forces all providers to use
direct transport.

KoteCode does not silently fall back to direct HTTPS if Proxy resolution or connection
fails. Local plain-HTTP providers remain direct.

Inspect the resolved transport, and optionally the original host for a selected model:

```bash
kotencode debug proxy
kotencode debug proxy --model openai/gpt-5
```

### Local Proxy override

For local development or diagnostics, force a Proxy origin without touching the
bootstrap flow:

```bash
KOTECODE_PROXY_URL=https://kote-proxy.kotey-ye.ru kotencode
```

Use explicit direct transport:

```bash
KOTECODE_DISABLE_PROXY=1 kotencode
```

Resolution order is `disabled` → `environment` → `remote` → `cache` → `none`.
See [`NETWORK.md`](./NETWORK.md) for the full network and privacy model.

## Migrating from OpenCode

KoteCode does **not** touch your OpenCode configuration automatically. To import
non-secret settings on demand:

```bash
kotencode migrate-from-opencode               # copies non-secret settings only
kotencode migrate-from-opencode --with-secrets     # also imports API keys/tokens (explicit opt-in)
kotencode migrate-from-opencode --dry-run          # preview without writing
kotencode migrate-from-opencode --force            # overwrite an existing KoteCode config
```

Your original OpenCode files are **never modified or deleted**. Secret-looking values
(`key`, `token`, `secret`, `password`, `credential`, `apikey`) are redacted unless you
pass `--with-secrets`.

## Desktop isolation

The KoteCode desktop app uses its own application identifiers and user-data roots:

| Channel    | Application ID             |
| ---------- | -------------------------- |
| dev        | `ai.kotecode.desktop.dev`  |
| beta       | `ai.kotecode.desktop.beta` |
| production | `ai.kotecode.desktop`      |

It does not automatically import the OpenCode desktop store. Internal compatibility
keys may retain `opencode` names inside the isolated KoteCode directory so upstream
merges and data formats remain compatible.

WSL integration is disabled for the alpha. The inherited implementation installs and
launches an upstream OpenCode binary inside WSL; it will remain unavailable until
KoteCode publishes and verifies its own Linux sidecar.

## Secrets handling

- Provider API keys are provided through provider-specific variables, the auth store,
  or config exactly as in OpenCode.
- Kote Proxy has no LLM key and does not require a separate client key.
- Provider credentials remain inside the end-to-end TLS tunnel and are not visible
  to Kote Proxy.
- Keys are **never written to logs or error messages.**
- The bootstrap signing **private key** is kept outside the repo (see
  [`BOOTSTRAP.md`](./BOOTSTRAP.md)); only the public verification key ships in the client.
