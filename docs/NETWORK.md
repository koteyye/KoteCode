# Network audit

Every network endpoint KoteCode contacts, with what it is for, when it happens, what
data is sent, and whether it can be disabled. There are **no hidden or undocumented**
calls to KoteCode-owned services.

KoteCode inherits OpenCode's network surface and adds the Kote Gateway bootstrap
fetch. The table below covers both. "Infra" marks whether a call uses OpenCode's or
KoteCode's infrastructure.

## Endpoints

| #   | Domain                                                                                 | Purpose                                                                 | When                                                              | Data sent                                                                                                                 | Disable                                                                                                | Infra                         |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 1   | `bootstrap.kotencode.ai` (default; overridable via `KOTECODE_BOOTSTRAP_URL`)           | Fetch the signed Kote Gateway bootstrap config                          | Launch, before the Kote Gateway provider is used                  | GET only; no body; no API key; `accept: application/json` header                                                          | Use `KOTECODE_GATEWAY_URL` to skip bootstrap entirely (direct override)                                | **KoteCode**                  |
| 2   | `<gateway base_url>` (resolved from #1 or `KOTECODE_GATEWAY_URL`)                      | Kote Gateway model calls (chat, tools, streaming)                       | When the user picks the Kote Gateway provider and sends a message | Prompts, code, file contents the user includes; `Authorization`/API key; `X-Title: kotencode`                             | Choose a different provider, or don't use KoteCode                                                     | **KoteCode** (your gateway)   |
| 3   | `<gateway models_url>` (optional, from #1)                                             | List models offered by the gateway                                      | When the user opens model selection for Kote Gateway              | GET only; API key                                                                                                         | Don't configure Kote Gateway                                                                           | **KoteCode**                  |
| 4   | `models.dev` (overridable via `OPENCODE_MODELS_URL`)                                   | Global model catalog (prices, capabilities)                             | Periodically (background refresh) + at launch                     | GET only; `User-Agent: kotencode/<channel>/<version>/<client>`                                                            | `OPENCODE_DISABLE_MODELS_FETCH=1`                                                                      | **OpenCode**                  |
| 5   | Each AI provider's own API (`api.openai.com`, `api.anthropic.com`, `openrouter.ai`, …) | Direct provider calls when the user selects a non-Kote-Gateway provider | When the user picks that provider                                 | Prompts, code, file contents; the provider's API key; attribution headers (`X-Title`, `HTTP-Referer`) branded `kotencode` | Choose a different provider, or `enabled_providers`/`disabled_providers` in config                     | **OpenCode** (the provider's) |
| 6   | KoteCode GitHub Releases (future)                                                      | Version/update checks                                                   | **Disabled in the current alpha; no request is made**             | None while disabled                                                                                                       | Disabled by the alpha safety lock; `KOTECODE_DISABLE_UPDATE_CHECK=1` remains the permanent kill switch | **KoteCode**                  |
| 7   | `opncd.ai` (legacy) or account `url` (authenticated)                                   | Session sharing                                                         | Only when the user explicitly shares a session                    | The shared session content; auth bearer token for authenticated shares                                                    | `OPENCODE_DISABLE_SHARE=1`                                                                             | **OpenCode**                  |
| 8   | Account `url`/`server` (device-code OAuth)                                             | Account login (console/enterprise)                                      | Only when the user runs account login                             | Device-code flow; no password                                                                                             | Don't run account login                                                                                | **OpenCode** (the account's)  |
| 9   | `OTEL_EXPORTER_OTLP_ENDPOINT` (user-configured)                                        | OpenTelemetry traces                                                    | Only if the user configures OTEL                                  | Trace spans the user's exporter expects                                                                                   | Don't set OTEL env                                                                                     | User's own                    |

## The dynamic Kote Gateway endpoint

The Kote Gateway working endpoint is **determined at runtime**; it is not in the source:

- **Where it comes from:** the signed bootstrap config (endpoint #1), or the
  `KOTECODE_GATEWAY_URL` env override.
- **Format received:** see [`BOOTSTRAP.md`](./BOOTSTRAP.md) — `{ config_version, gateway: { base_url, models_url }, issued_at, expires_at, signature }`.
- **Verification:** Ed25519 signature checked against the public key embedded in
  `packages/core/src/kote/keys.ts` before any URL is used.
- **How to see the actually-used endpoint:** the resolved source
  (`environment` | `remote` | `cache`) is surfaced in diagnostics; `KOTECODE_GATEWAY_URL`
  prints through to the provider's `baseURL`.
- **What is sent to the gateway:** the model request (prompts, tool definitions, any
  file contents the user includes), the user's API key, and a `X-Title: kotencode`
  attribution header. **No telemetry, no extra endpoints, no third parties.**

## What KoteCode does NOT do

- It does **not** embed a shared OpenRouter API key.
- It does **not** embed the real gateway URL in source (only the bootstrap URL and
  the public verification key).
- It does **not** send code, prompts, or responses to any endpoint beyond the one the
  user selected (Kote Gateway, a direct provider, etc.).
- It does **not** silently switch the user between direct mode and Kote Gateway.
- It does **not** follow redirects on the bootstrap fetch (`redirect: "error"`).
- It does **not** execute code or commands from the bootstrap config.
- The alpha desktop does **not** install or launch OpenCode inside WSL. The inherited
  WSL integration is disabled until a KoteCode-owned Linux sidecar is available.

## Optional OpenCode services

If a piece of OpenCode functionality depends on OpenCode's official infrastructure
(sharing via `opncd.ai`, account login to an OpenCode-hosted console), KoteCode keeps
it **optional** and clearly marked as an OpenCode service (rows 7–8 above). Nothing is
silently re-pointed at KoteCode infrastructure.

## Reproducibility

`bunfig.toml` pins the package registry to `registry.npmjs.org/` so dependency
installation only ever talks to the official npm registry, regardless of any
machine-local mirror — keeping installs reproducible and auditable.
