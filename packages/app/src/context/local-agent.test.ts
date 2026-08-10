import { describe, expect, test } from "bun:test"
import { hasCustomAgent, resolveAgent, sameServerAgentState, serverAgentState } from "./local-agent"

describe("hasCustomAgent", () => {
  test("detects explicitly custom agents", () => {
    expect(hasCustomAgent([{ native: true }, { native: false }])).toBe(true)
  })

  test("ignores built-in and unclassified agents", () => {
    expect(hasCustomAgent([{ native: true }, {}])).toBe(false)
  })
})

describe("resolveAgent", () => {
  const agents = [{ name: "plan" }, { name: "build" }, { name: "custom" }]

  test("uses the requested available agent", () => {
    expect(resolveAgent(agents, "custom")?.name).toBe("custom")
  })

  test("defaults to build", () => {
    expect(resolveAgent(agents)?.name).toBe("build")
    expect(resolveAgent(agents, "missing")?.name).toBe("build")
  })

  test("uses the first agent when build is unavailable", () => {
    expect(resolveAgent([{ name: "custom" }], "missing")?.name).toBe("custom")
  })
})

describe("serverAgentState", () => {
  test("preserves the active model when only the agent changes", () => {
    const current = { model: { providerID: "provider", modelID: "active" }, variant: "high" }

    expect(serverAgentState(current, "plan")).toEqual({ agent: "plan", ...current })
  })

  test("uses the exact server model and clears its default variant", () => {
    const current = { model: { providerID: "provider", modelID: "old" }, variant: "high" }

    expect(
      serverAgentState(current, "build", {
        model: { providerID: "provider", modelID: "active" },
        variant: undefined,
      }),
    ).toEqual({
      agent: "build",
      model: { providerID: "provider", modelID: "active" },
      variant: undefined,
    })
  })

  test("recognizes an unchanged server selection without relying on object identity", () => {
    const current = {
      agent: "build",
      model: { providerID: "provider", modelID: "active" },
      variant: "high",
    }

    expect(sameServerAgentState(current, serverAgentState(current, "build"))).toBe(true)
    expect(
      sameServerAgentState(current, {
        ...current,
        model: { providerID: "provider", modelID: "other" },
      }),
    ).toBe(false)
  })
})
