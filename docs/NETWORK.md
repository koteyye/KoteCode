# Network audit

KoteCode inherits OpenCode's provider surface and adds one KoteCode-owned service:
Kote Proxy. The Proxy is a standard HTTPS `CONNECT` transport; it is not an LLM
provider and has no provider API key.

## Endpoints

| #   | Endpoint                                                                         | Purpose                         | Data visible to endpoint                                                  | Disable                                                                     |
| --- | -------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `bootstrap.kotencode.ai`                                                         | Fetch signed Proxy bootstrap    | GET, no body or API key                                                   | Set `KOTECODE_PROXY_URL`, or use `KOTECODE_DISABLE_PROXY=1`                 |
| 2   | Signed Proxy origin                                                              | Open an HTTPS `CONNECT` tunnel  | Client IP, target hostname/port, timing and byte counts                   | `KOTECODE_DISABLE_PROXY=1`                                                  |
| 3   | Selected AI provider (`api.openai.com`, `api.anthropic.com`, `openrouter.ai`, …) | Model request                   | User API key/OAuth token, prompts, code, tools, attachments and responses | Select another provider or do not send a request                            |
| 4   | `models.dev` or `OPENCODE_MODELS_URL`                                            | Model catalog                   | GET and branded User-Agent                                                | `OPENCODE_DISABLE_MODELS_FETCH=1`                                           |
| 5   | KoteCode GitHub Releases                                                         | Future update checks            | Disabled in the current alpha                                             | Already disabled; `KOTECODE_DISABLE_UPDATE_CHECK=1` remains the kill switch |
| 6   | `opncd.ai` or authenticated account URL                                          | Explicit session sharing        | Shared session and account bearer token                                   | `OPENCODE_DISABLE_SHARE=1`                                                  |
| 7   | Provider/account authorization endpoints                                         | API-key/OAuth login and refresh | Provider-specific auth data                                               | Do not run the authorization flow                                           |
| 8   | User-configured `OTEL_EXPORTER_OTLP_ENDPOINT`                                    | OpenTelemetry                   | Trace data expected by the user's exporter                                | Do not configure OTEL                                                       |

## End-to-end TLS through Kote Proxy

For an HTTPS provider request, KoteCode asks the Proxy to connect to the original
provider host:

```text
CONNECT api.openai.com:443
```

After the Proxy returns `200 Connection Established`, KoteCode creates TLS directly
with `api.openai.com` through the byte tunnel. Therefore:

- Kote Proxy sees the client IP, provider hostname, timing, and traffic volume;
- Kote Proxy does not see the provider URL path/query;
- Kote Proxy does not see the user's API key or OAuth token;
- Kote Proxy does not see prompts, code, tools, attachments, or responses;
- the provider sees the same authenticated request it would receive in direct mode;
- KoteCode validates the provider's TLS certificate;
- no KoteCode CA is installed and no TLS interception is performed.

The Proxy server enforces a provider host/port allowlist so it cannot be used as an
arbitrary public relay.

## What is proxied

Only runtime requests made by a selected provider SDK receive the Kote Proxy option.
The following remain direct:

- bootstrap fetch, avoiding a circular dependency;
- `models.dev`;
- npm/GitHub/update traffic;
- MCP and plugin network calls;
- session sharing;
- browser authorization pages;
- local plain-HTTP providers such as Ollama.

OAuth acquisition can remain direct while subsequent bearer-authenticated model
requests use the Proxy tunnel.

## Failure and direct mode

KoteCode does not silently fall back to direct HTTPS when the signed Proxy is
unavailable. The provider request fails with a Proxy diagnostic.

The user can explicitly choose direct transport:

```bash
KOTECODE_DISABLE_PROXY=1 kotencode
```

The active source and sanitized endpoint are available without exposing credentials:

```bash
kotencode debug proxy
kotencode debug proxy --model openai/gpt-5
```

For development, a Proxy origin can be forced without changing bootstrap:

```bash
KOTECODE_PROXY_URL=https://proxy.example:443 kotencode
```

## Dynamic Proxy address

The Proxy origin comes from:

1. explicit direct mode;
2. `KOTECODE_PROXY_URL`;
3. verified remote bootstrap;
4. verified cached bootstrap.

The bootstrap format is documented in [`BOOTSTRAP.md`](./BOOTSTRAP.md). It contains
`{ config_version, proxy: { url }, issued_at, expires_at, signature }`.

## What KoteCode does not do

- It does not embed a provider API key.
- It does not give users free LLM credits.
- It does not send provider credentials as Proxy authentication.
- It does not replace OpenAI/OpenRouter/Anthropic with a KoteCode provider.
- It does not decrypt Proxy tunnel traffic.
- It does not silently switch between Proxy and direct transport.
- It does not follow redirects while fetching bootstrap.
- It does not execute code or commands from bootstrap.
- The alpha desktop does not install or launch OpenCode inside WSL.

## Optional inherited OpenCode services

Session sharing and OpenCode-hosted account services remain optional inherited
features. They are not silently redirected to KoteCode infrastructure.

## Reproducibility

`bunfig.toml` pins dependency installation to `registry.npmjs.org`.
