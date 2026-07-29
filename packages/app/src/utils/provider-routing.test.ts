import { describe, expect, test } from "bun:test"
import type { Config } from "@opencode-ai/sdk/v2/client"
import { providerRouting, withProviderRouting } from "./provider-routing"

describe("providerRouting", () => {
  test("defaults existing providers to Kote Proxy", () => {
    expect(providerRouting({} as Config, "openai")).toBe("proxy")
  })

  test("reads and updates one provider without changing the others", () => {
    const config = {
      provider: {
        openai: { name: "OpenAI", routing: "proxy" },
        anthropic: { name: "Anthropic", routing: "direct" },
      },
    } as Config

    const next = withProviderRouting(config, "openai", "direct")

    expect(providerRouting(next, "openai")).toBe("direct")
    expect(providerRouting(next, "anthropic")).toBe("direct")
    expect(next.provider?.openai?.name).toBe("OpenAI")
  })
})
