import { describe, expect, test } from "bun:test"
import {
  ProxyTargetError,
  ProxyUnavailableError,
  proxyFetch,
  proxyForRequest,
  proxyRequestInit,
} from "@/provider/proxy"

describe("provider proxy transport", () => {
  test("routes HTTPS strings, URLs, and Requests through the resolved proxy", () => {
    const result = { source: "remote", url: "https://proxy.kotencode.test" } as const
    expect(proxyForRequest("https://api.openai.com/v1/responses", result)).toBe(result.url)
    expect(proxyForRequest(new URL("https://api.anthropic.com/v1/messages"), result)).toBe(result.url)
    expect(proxyForRequest(new Request("https://openrouter.ai/api/v1/chat/completions"), result)).toBe(result.url)
  })

  test("preserves request options while injecting the proxy", () => {
    const result = { source: "cache", url: "https://proxy.kotencode.test" } as const
    const signal = new AbortController().signal
    const init = proxyRequestInit(
      "https://api.openai.com/v1/responses",
      { headers: { authorization: "Bearer test" }, signal },
      result,
    )

    expect(init.proxy).toBe(result.url)
    expect(init.headers).toEqual({ authorization: "Bearer test" })
    expect(init.signal).toBe(signal)
  })

  test("wraps alternate runtimes with the same proxy transport", async () => {
    const calls: { input: RequestInfo | URL; init?: BunFetchRequestInit }[] = []
    const runtimeFetch = Object.assign(
      async (input: RequestInfo | URL, init?: BunFetchRequestInit) => {
        calls.push({ input, init })
        return new Response("ok")
      },
      { preconnect() {} },
    ) satisfies typeof globalThis.fetch
    const fetch = proxyFetch(runtimeFetch, { source: "environment", url: "https://proxy.kotencode.test" })

    await fetch("https://api.anthropic.com/v1/messages", { method: "POST" })
    expect(calls).toEqual([
      {
        input: "https://api.anthropic.com/v1/messages",
        init: { method: "POST", proxy: "https://proxy.kotencode.test" },
      },
    ])
  })

  test("explicit direct mode bypasses the proxy", () => {
    expect(proxyForRequest("https://api.openai.com/v1/responses", { source: "disabled" })).toBeUndefined()
  })

  test("local HTTP providers stay direct", () => {
    const result = {
      source: "none",
      reason: "offline",
      hint: "set KOTECODE_PROXY_URL",
    } as const
    expect(proxyForRequest("http://127.0.0.1:11434/v1/chat/completions", result)).toBeUndefined()
    expect(proxyForRequest("http://localhost:11434/v1/chat/completions", result)).toBeUndefined()
    expect(proxyForRequest("http://[::1]:11434/v1/chat/completions", result)).toBeUndefined()
  })

  test("does not silently bypass the proxy for remote non-HTTPS providers", () => {
    const request = () =>
      proxyForRequest("http://provider.example.test/v1/chat/completions?api_key=must-not-leak", {
        source: "remote",
        url: "https://proxy.kotencode.test",
      })
    expect(request).toThrow(ProxyTargetError)
    expect(request).toThrow("refusing direct request to http://provider.example.test")
    expect(request).not.toThrow("must-not-leak")
  })

  test("HTTPS requests fail closed when no proxy is available", () => {
    const result = {
      source: "none",
      reason: "remote bootstrap is unreachable",
      hint: "use KOTECODE_DISABLE_PROXY=1 for direct mode",
    } as const
    expect(() => proxyForRequest("https://api.openai.com/v1/responses", result)).toThrow(ProxyUnavailableError)
    expect(() => proxyForRequest("https://api.openai.com/v1/responses", result)).toThrow(
      "Kote Gateway is unavailable: remote bootstrap is unreachable",
    )
  })
})
