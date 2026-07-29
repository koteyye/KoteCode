import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import path from "path"
import { resolveProviderRoutingID } from "@/cli/cmd/providers"
import { cliIt } from "../lib/cli-process"

describe("opencode providers routing", () => {
  test("accepts provider ids, names, and explicit custom ids", () => {
    const options = [{ value: "openai", label: "OpenAI" }]

    expect(resolveProviderRoutingID("openai", options)).toBe("openai")
    expect(resolveProviderRoutingID("OPENAI", options)).toBe("openai")
    expect(resolveProviderRoutingID("custom-provider", options)).toBe("custom-provider")
    expect(resolveProviderRoutingID("invalid provider", options)).toBeUndefined()
  })

  cliIt.concurrent(
    "updates one provider route in the global config",
    ({ home, opencode }) =>
      Effect.gen(function* () {
        const direct = yield* opencode.spawn(["providers", "routing", "openai", "direct"])
        opencode.expectExit(direct, 0)

        const file = path.join(home, ".config", "kotencode", "kotencode.jsonc")
        expect((yield* Effect.promise(() => Bun.file(file).json())).provider.openai.routing).toBe("direct")

        const proxy = yield* opencode.spawn(["providers", "routing", "openai", "gateway"])
        opencode.expectExit(proxy, 0)
        expect((yield* Effect.promise(() => Bun.file(file).json())).provider.openai.routing).toBe("proxy")
      }),
    60_000,
  )
})
