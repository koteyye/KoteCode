# Kote Gateway compatibility

This matrix describes KoteCode client transport support. It does not claim
end-to-end provider compatibility until the production Proxy and its allowlist are
available for smoke testing.

The production Proxy origin is `https://kote-proxy.kotey-ye.ru`.

| Provider/runtime path                                    | Client transport status                                    | End-to-end status                    |
| -------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------ |
| OpenAI-compatible AI SDK over HTTPS                      | Proxy option injected into the shared provider fetch       | Pending Proxy deployment             |
| Anthropic AI SDK over HTTPS                              | Proxy option injected into the shared provider fetch       | Pending Proxy deployment             |
| OpenRouter AI SDK over HTTPS                             | Proxy option injected into the shared provider fetch       | Pending Proxy deployment             |
| OpenAI native runtime with API key                       | Proxy-aware Effect fetch transport                         | Pending Proxy deployment             |
| OpenAI native runtime with OAuth                         | Proxy-aware provider override covered by an automated test | Pending Proxy deployment             |
| Anthropic native runtime                                 | Proxy-aware Effect fetch transport                         | Pending Proxy deployment             |
| Vertex/Snowflake custom fetch wrappers                   | Proxy option is preserved by the wrapper                   | Pending provider-specific smoke test |
| Local HTTP endpoints (`localhost`, `127.0.0.0/8`, `::1`) | Explicitly direct                                          | Not applicable                       |
| Remote plain HTTP endpoint                               | Rejected to prevent silent direct bypass                   | Unsupported                          |
| WebSocket transport                                      | Disabled while Kote Gateway is active                      | HTTP streaming selected              |
| gRPC or SDK-owned socket transport                       | No fetch-based Proxy injection                             | Unsupported pending separate design  |

## Automated client checks

- signed `proxy.url` bootstrap verification, cache, grace period, and precedence;
- unsafe Proxy and bootstrap URLs rejected;
- HTTPS provider requests receive the Bun `proxy` option;
- API-key/OAuth request options and cancellation signals are preserved;
- native OpenAI OAuth fetch receives the Proxy option;
- OpenAI WebSocket transport is available only in explicit direct mode;
- explicit direct mode bypasses Kote Gateway;
- loopback HTTP stays direct;
- unavailable Proxy and remote plain HTTP fail closed.

## Alpha smoke-test checklist

After the Proxy repository is deployed with its production allowlist, promote a row
from “Pending” only after verifying:

1. provider authentication with the user's own credentials;
2. streaming output without buffering;
3. tool-call continuation;
4. cancellation closes the tunnel;
5. original provider hostname and TLS certificate validation;
6. Proxy logs contain transport metadata only.
