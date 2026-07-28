# KoteCode fork audit

This document records the structure of the OpenCode repository at the fork
base (`v1.18.5`, `e5cc278`) and identifies every user-visible place that
mentions the OpenCode brand, plus the extension points KoteCode uses.

It is the audit required by the KoteCode specification (ТЗ §5) and the
reference for the upstream-sync procedure in [`UPSTREAM.md`](./UPSTREAM.md).

Fork base: OpenCode `1.18.5` — see [`../UPSTREAM_STATE.md`](../UPSTREAM_STATE.md).

---

## 1. Tech stack and build tools

- **Runtime:** Bun `1.3.14` (declared as root `packageManager`).
- **Language:** TypeScript (strict, `effect` 4.0.0-beta ecosystem).
- **Monorepo:** Bun workspaces + Turborepo (`bun turbo typecheck`).
- **Linting:** `oxlint` (+ `oxlint-tsgolint`).
- **Type checking:** `tsgo` (the TypeScript native preview) per package — never `tsc` from root.
- **Single binary:** produced by `Bun.build` with `compile.target` — **not** a Go binary.
- **Desktop app:** Electron (`electron-vite` + `electron-builder`), `@opencode-ai/desktop`.
- **Storage:** `drizzle-orm` + SQLite.
- **AI integration:** Vercel AI SDK (`ai` v6), `@ai-sdk/*` provider packages.

## 2. Entry points

### CLI / TUI

- **CLI entrypoint:** `packages/opencode/src/index.ts` — yargs-based, registers ~24 commands,
  handles `-h`/`--help` (custom `show()` prepends the ASCII logo), `--version` (uses
  `InstallationVersion`), and forces `process.exit()` in `finally`.
- **Launcher shim:** `packages/opencode/bin/opencode` (Node script, `#!/usr/bin/env node`) —
  detects platform/arch (AVX2, musl), resolves the platform binary from a sibling
  `opencode-<platform>-<arch>` npm sub-package, execs it. Honors `OPENCODE_BIN_PATH`.
- **Commands:** `packages/opencode/src/cli/cmd/` (`run`, `serve`, `tui`, `agent`, `mcp`,
  `github`, `pr`, `providers`, `models`, `session`, `generate`, `export`, `import`, `attach`,
  `plug`, `upgrade`, `uninstall`, `stats`, `web`, `db`, `account`, `acp`, …) + `debug/`, `run/`.

### Desktop

- `packages/desktop/` — Electron app (`@opencode-ai/desktop`), config in
  `electron-builder.config.ts` (channel-driven `appId`/`productName`/URL scheme).

## 3. Packages in the monorepo

Root `workspaces`: `packages/*`, `packages/console/*`, `packages/stats/*`,
`packages/sdk/js`, `packages/slack`. Notable packages:

- `opencode` — core CLI app (depends on `@opencode-ai/core`)
- `core` — the engine (`@opencode-ai/core`): config, providers plumbing, accounts, installation,
  global paths, plugins, models, observability
- `tui` — terminal UI; the ASCII logo lives at `packages/tui/src/logo.ts`
- `app` / `web` — web/desktop UI (SolidJS)
- `desktop` — Electron app (`@opencode-ai/desktop`)
- `sdk` / `sdk/js` / `sdk-next` — published JS SDK (`@opencode-ai/sdk`)
- `plugin` — plugin SDK (`@opencode-ai/plugin`)
- `schema`, `protocol`, `server`, `client`, `function`, `identity`, `enterprise`, `containers`,
  `console`, `stats`, `slack`, `session-ui`, `storybook`, `ui`, `codemode`, `http-recorder`,
  `httpapi-codegen`, `effect-drizzle-sqlite`, `effect-sqlite-node`, `llm`, `script`

Architecture (per `AGENTS.md`): Schema → Core/Protocol → Server → Client; `sdk_next` composes
Client+Core+Server. Client never depends on Core/Server.

## 4. User-visible OpenCode brand (rebrand surface)

This is the **complete** list of places the brand string appears to end users. Most are a
single constant (see [`UPSTREAM.md`](./UPSTREAM.md) "expected-diff files").

| Surface                                     | File                                                                                                                                   | Change for KoteCode                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| XDG app dir name                            | `packages/core/src/global.ts` — `const app = "opencode"`                                                                               | → `"kotencode"`                                                    |
| Config-dir override                         | `packages/core/src/global.ts` `make()`                                                                                                 | honor `KOTECODE_CONFIG_DIR`                                        |
| CLI `scriptName` / `--help` prefix          | `packages/opencode/src/index.ts`                                                                                                       | `scriptName("kotencode")`                                          |
| ASCII logo (TTY)                            | `packages/tui/src/logo.ts`                                                                                                             | new "KOTECODE" glyphs                                              |
| ASCII wordmark (non-TTY)                    | `packages/opencode/src/cli/ui.ts` `wordmark`                                                                                           | new glyph array                                                    |
| `--version` string                          | via `OPENCODE_VERSION` define → `installation/version.ts`                                                                              | show KoteCode + upstream                                           |
| Binary outfile name                         | `packages/opencode/script/build.ts` (`outfile …/bin/opencode`)                                                                         | → `kotencode`                                                      |
| npm package name (drives sub-package names) | `packages/opencode/package.json` `name`                                                                                                | → `"kotencode"`                                                    |
| Launcher expected names                     | `packages/opencode/bin/opencode`                                                                                                       | `kotencode-…`, `kotencode(.exe)`, `.kotencode`                     |
| User-Agent (models.dev)                     | `packages/core/src/models-dev.ts` `USER_AGENT`                                                                                         | `kotencode/…`                                                      |
| Provider attribution headers                | `packages/opencode/src/provider/provider.ts` (openrouter/llmgateway/nvidia/vercel/zenmux/cerebras/kilo)                                | `kotencode` brand headers                                          |
| Root package identity                       | `package.json` (`name`, `description`, `repository.url`)                                                                               | KoteCode identity                                                  |
| Desktop identity                            | `packages/desktop/{package.json, electron-builder.config.ts}`, `packages/desktop/src/main/{constants,index,logging,server,windows}.ts` | KoteCode app IDs/name/author and isolated runtime data             |
| Desktop WSL bridge                          | `packages/desktop/src/main/wsl/`                                                                                                       | Disabled for alpha; inherited code installs/runs upstream OpenCode |
| Install script                              | `install` (`APP=opencode`, "OpenCode Installer", release URLs, ASCII art)                                                              | KoteCode installer                                                 |
| README                                      | `README.md` (+ 20 translations)                                                                                                        | KoteCode README                                                    |

## 5. Configuration / data / cache / state / log directories

Defined in `packages/core/src/global.ts` via `xdg-basedir` (app name `"opencode"`):

| Directory | Linux/macOS                                            | Windows                         |
| --------- | ------------------------------------------------------ | ------------------------------- |
| config    | `$XDG_CONFIG_HOME/opencode` (`~/.config/opencode`)     | `%APPDATA%\opencode`            |
| data      | `$XDG_DATA_HOME/opencode` (`~/.local/share/opencode`)  | `%LOCALAPPDATA%\opencode`       |
| cache     | `$XDG_CACHE_HOME/opencode` (`~/.cache/opencode`)       | `%LOCALAPPDATA%\opencode\cache` |
| state     | `$XDG_STATE_HOME/opencode` (`~/.local/state/opencode`) | `%LOCALAPPDATA%\opencode\state` |
| log       | `data/log`                                             | `data/log`                      |
| bin       | `cache/bin`                                            | `cache/bin`                     |
| tmp       | `os.tmpdir()/opencode`                                 | `os.tmpdir()/opencode`          |

Config dir is overridable at runtime via `Flag.OPENCODE_CONFIG_DIR ?? Path.config`.
All dirs are `mkdir -p`'d at module import.

**Config files** (`packages/opencode/src/config/`): global dir searched for `config.json`,
`opencode.json`, `opencode.jsonc` (merge order; default write target `opencode.jsonc`). Project
config discovered by walking up from cwd looking for `.opencode/` and `*.json`/`*.jsonc`.

## 6. Environment variables (`OPENCODE_*` prefix)

Canonical list in `packages/core/src/flag/flag.ts`. `Flag` is a plain object literal (not an
Effect service). Key vars: `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG_CONTENT`,
`OPENCODE_MODELS_URL`, `OPENCODE_MODELS_PATH`, `OPENCODE_DB`, `OPENCODE_DISABLE_AUTOUPDATE`,
`OPENCODE_DISABLE_SHARE`, `OPENCODE_DISABLE_MODELS_FETCH`, `OPENCODE_DISABLE_PROJECT_CONFIG`,
`OPENCODE_CLIENT`, `OPENCODE_BIN_PATH`, plus experimental flags and compile-time defines
(`OPENCODE_VERSION`, `OPENCODE_CHANNEL`, `OPENCODE_LIBC`).

**KoteCode keeps all `OPENCODE_*` vars intact** (compatibility layer) and adds `KOTECODE_*`
alongside — see [`CONFIGURATION.md`](./CONFIGURATION.md).

## 7. Network calls

Documented in full in [`NETWORK.md`](./NETWORK.md). Summary:

- **models.dev** (`OPENCODE_MODELS_URL`, default `https://models.dev`) — model catalog, branded User-Agent.
- **Version/upgrade checks** — npm registry / Homebrew / Scoop / Chocolatey / GitHub releases APIs.
- **Install script** — downloads from `github.com/anomalyco/opencode/releases/...`.
- **Session sharing** — `https://opncd.ai` (legacy) or account `url` (authenticated).
- **Auth/account** — device-code OAuth to account `url`/`server` (not hardcoded).
- **Provider traffic** — to each AI provider's baseURL with attribution headers.
- **Telemetry** — OpenTelemetry via `OTEL_EXPORTER_OTLP_ENDPOINT` (user-configured).

## 8. Provider mechanism (Kote Gateway extension point)

Registry: `packages/opencode/src/provider/provider.ts`.

- `BUNDLED_PROVIDERS` map: npm package string → dynamic `import(...).then(m => m.createXxx)`
  (covers `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@openrouter/ai-sdk-provider`, etc.).
- `custom(dep)` function: per-provider-ID loader returning
  `{ autoload, options?: { baseURL, apiKey, headers, ... }, getModel?, vars?, discoverModels? }`.
- `resolveSDK`: baseURL precedence is `provider.options.baseURL` > `model.api.url` (catalog),
  with `${VAR}` substitution. apiKey from options or `provider.key`. **This is how Kote Gateway
  injects its bootstrap-resolved baseURL with highest precedence — no separate HTTP client.**
- Closest analogs to Kote Gateway: the `llmgateway`/`openrouter` cases (header-only gateways)
  and `snowflake-cortex` (returns a computed `baseURL` from credentials).

## 9. Plugins and custom tools

- SDK: `packages/plugin` (`@opencode-ai/plugin`); a plugin is `function(input, options): Hooks`.
- Discovery (`packages/opencode/src/config/plugin.ts`): scans `{plugin,plugins}/*.{ts,js}`.
- Loader (`packages/opencode/src/plugin/loader.ts`): resolve → entrypoint → compatibility → import.
- Hooks (`packages/plugin/src/index.ts`): `config`, `event`, `tool`, `provider`, `auth`,
  `chat.headers`, `chat.params`, `chat.message`, `tool.execute.*`, `command.execute.before`,
  `shell.env`, `permission.ask`, plus experimental hooks.

## 10. Bootstrap / signing infrastructure (does **not** exist upstream)

- **No Ed25519 / signature verification / bootstrap-config mechanism** exists in OpenCode
  (grep for `ed25519`, `@noble`, `nacl`, `verifySignature` → 0 matches; `jose` is used only in
  one serverless function for GitHub OIDC JWT verify, unrelated to client runtime).
- The closest "fetch remote config" mechanism is the account service
  (`packages/opencode/src/account/account.ts`) GET `${account.url}/api/config`, decoded as a
  generic `RemoteConfig = { config: Record<string, Json> }` — **not** signed.

**Conclusion:** KoteCode builds the signed bootstrap resolver, last-known-good cache, and
Ed25519 verification **from scratch** in `packages/core/src/kote/`, adding `@noble/ed25519`.

## 11. Build / release process (Windows, macOS, Linux)

- Build script: `packages/opencode/script/build.ts` — 12 compile targets
  (darwin/linux/win32 × arm64/x64 + `-baseline` for non-AVX2 + `-musl` for Alpine).
- Defines injected at compile time: `OPENCODE_VERSION`, `OPENCODE_CHANNEL`, `OPENCODE_LIBC`,
  `OPENCODE_WORKER_PATH`, `OTUI_TREE_SITTER_WORKER_PATH`. Output: `dist/<name>/bin/opencode`.
- Release workflow: `.github/workflows/publish.yml` (triggers on `ci`/`dev`/`beta`/`snapshot-*`).
  Jobs: `version`, `build-cli` (Ubuntu), `sign-cli-windows` (Azure Trusted Signing),
  `build-electron` (6-target matrix, Apple codesign), `publish` (npm, `gh release`, Docker/AUR/Tauri).
- **Upstream pipeline does not transfer to a fork** (Blacksmith runners, Azure/Apple signing,
  Tauri keys, npm secrets). KoteCode's draft release builds **unsigned** CLI artifacts for
  Windows x64, Linux x64, macOS arm64 — see [`BUILD.md`](./BUILD.md).

## 12. Conclusion and scope decisions

- Kote Gateway plugs into the existing `custom()` provider registry — **no new architecture**,
  scope is not extended beyond ТЗ.
- Public rebrand touches a small, mostly-constant set of files (audit §4).
- The signed bootstrap subsystem is genuinely new code (audit §10), localized to `packages/core/src/kote/`.
