import { describe, expect, test } from "bun:test"
import { ProviderRouting } from "@opencode-ai/core/kote/provider-routing"

describe("ProviderRouting", () => {
  test("defaults to Kote Proxy", () => {
    expect(ProviderRouting.read(undefined)).toBe("proxy")
    expect(ProviderRouting.read("unknown")).toBe("proxy")
  })

  test("turns direct routing into an explicitly disabled proxy transport", () => {
    expect(
      ProviderRouting.transport("direct", {
        source: "remote",
        url: "https://proxy.kotencode.test",
      }),
    ).toEqual({ source: "disabled" })
  })

  test("keeps the resolved proxy transport in proxy mode", () => {
    const proxy = {
      source: "cache",
      url: "https://proxy.kotencode.test",
    } as const
    expect(ProviderRouting.transport("proxy", proxy)).toBe(proxy)
  })
})
