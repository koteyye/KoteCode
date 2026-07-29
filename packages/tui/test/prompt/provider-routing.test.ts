import { describe, expect, test } from "bun:test"
import { resolvePromptProviderRouting } from "../../src/component/prompt/provider-routing"

describe("prompt provider routing", () => {
  test("defaults providers to Kote Gateway", () => {
    expect(resolvePromptProviderRouting({}, "openai")).toBe("proxy")
    expect(resolvePromptProviderRouting({ provider: {} }, "openai")).toBe("proxy")
  })

  test("reads the selected provider route", () => {
    const config = {
      provider: {
        openai: { routing: "direct" },
        anthropic: { routing: "proxy" },
      },
    }

    expect(resolvePromptProviderRouting(config, "openai")).toBe("direct")
    expect(resolvePromptProviderRouting(config, "anthropic")).toBe("proxy")
    expect(resolvePromptProviderRouting(config, "custom")).toBe("proxy")
  })

  test("omits routing when no model provider is selected", () => {
    expect(resolvePromptProviderRouting({}, undefined)).toBeUndefined()
  })
})
