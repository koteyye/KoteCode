# Configuration

KoteCode is configured through config files (JSON/JSONC) and environment variables.
It keeps all of OpenCode's `OPENCODE_*` variables working and adds `KOTECODE_*`
on top; when both are set, KoteCode's take precedence.

## Directories

A new KoteCode install uses its own directories (separate from OpenCode's):

| Directory | Linux | macOS | Windows |
|---|---|---|---|
| config | `~/.config/kotencode` | `~/Library/Application Support/kotencode` | `%APPDATA%\kotencode` |
| data | `~/.local/share/kotencode` | `~/Library/Application Support/kotencode` | `%LOCALAPPDATA%\kotencode` |
| cache | `~/.cache/kotencode` | `~/Library/Caches/kotencode` | `%LOCALAPPDATA%\kotencode\cache` |
| state | `~/.local/state/kotencode` | `~/Library/Application Support/kotencode` | `%LOCALAPPDATA%\kotencode\state` |
| log | `<data>/log` | `<data>/log` | `<data>\log` |

### Overriding directories

Each directory can be overridden by environment variable (KoteCode takes precedence
over the OpenCode equivalent, which takes precedence over the platform default):

| Override env | What it sets |
|---|---|
| `KOTECODE_CONFIG_DIR` | config directory |
| `KOTECODE_DATA_DIR` | data directory |
| `KOTECODE_CACHE_DIR` | cache directory |
| (`OPENCODE_CONFIG_DIR` is still honored as a fallback) | |

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
  // Use the Kote Gateway (endpoint resolved from the signed bootstrap)
  "provider": {
    "kote-gateway": {
      "models": {
        "my-model": { "name": "My Model" }
      }
    }
  }
}
```

## Environment variables

### KoteCode (`KOTECODE_*`)

| Variable | Purpose |
|---|---|
| `KOTECODE_CONFIG` | Path to a config file (merged as local scope) |
| `KOTECODE_CONFIG_DIR` | Override the config directory |
| `KOTECODE_DATA_DIR` | Override the data directory |
| `KOTECODE_CACHE_DIR` | Override the cache directory |
| `KOTECODE_BOOTSTRAP_URL` | Override the bootstrap config URL (dev/testing) |
| `KOTECODE_GATEWAY_URL` | Force the gateway address — **priority over bootstrap** |
| `KOTECODE_GATEWAY_API_KEY` | Provide the gateway key via env (not written to config) |
| `KOTECODE_DISABLE_UPDATE_CHECK` | Reserved update-check kill switch; alpha updates are already disabled |
| `KOTECODE_BIN_PATH` | Point the launcher at a specific binary (also honors `OPENCODE_BIN_PATH`) |

KoteCode alpha does not perform automatic update checks and rejects manual/API
upgrade requests. Install a newer alpha explicitly from the KoteCode GitHub Releases
page. The dormant upstream updater must not be enabled until every source and install
method has been replaced with KoteCode-owned release infrastructure.

### OpenCode compatibility (`OPENCODE_*`)

All OpenCode environment variables continue to work (`OPENCODE_CONFIG`,
`OPENCODE_MODELS_URL`, `OPENCODE_DISABLE_AUTOUPDATE`, `OPENCODE_DISABLE_SHARE`,
`OPENCODE_CLIENT`, etc.). They are documented in the OpenCode base. KoteCode does not
remove or rename any of them.

## Connection modes

| Mode | Provider id | Endpoint | When to use |
|---|---|---|---|
| **Kote Gateway** | `kote-gateway` | Resolved at runtime from the signed bootstrap (or `KOTECODE_GATEWAY_URL`) | Use KoteCode's gateway |
| **Direct OpenRouter** | `openrouter` | `openrouter.ai` (your key) | Your own OpenRouter account |
| **Other providers** | `anthropic`, `openai`, `google`, `azure`, `amazon-bedrock`, … | Each provider's own endpoint | Direct to a model vendor |

You always know which endpoint is in use — the Kote Gateway is never a hidden
substitution for OpenRouter or any other provider. See [`NETWORK.md`](./NETWORK.md)
for the full network audit.

### Local override for the gateway

For local development or diagnostics, force a gateway address without touching the
bootstrap flow:

```bash
KOTECODE_GATEWAY_URL=https://localhost:8443/api/v1 kotencode
```

`KOTECODE_GATEWAY_URL` takes priority over the bootstrap configuration. The source of
the active configuration (`environment` | `remote` | `cache`) is surfaced in diagnostics.

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

## Secrets handling

- API keys are provided via env (`KOTECODE_GATEWAY_API_KEY`, provider-specific vars),
  the auth store, or config — KoteCode uses the mechanisms OpenCode already provides.
- Keys are **never written to logs or error messages.**
- The bootstrap signing **private key** is kept outside the repo (see
  [`BOOTSTRAP.md`](./BOOTSTRAP.md)); only the public verification key ships in the client.
