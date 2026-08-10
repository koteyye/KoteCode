import { describe, expect, test } from "bun:test"
import { jsonSchema, tool, type ToolExecutionOptions } from "ai"
import { SessionTools } from "@/session/tools"

const options = {
  toolCallId: "call",
  messages: [],
  abortSignal: new AbortController().signal,
} satisfies ToolExecutionOptions

function tools(calls: string[]) {
  const make = (name: string) =>
    tool({
      description: name,
      inputSchema: jsonSchema({ type: "object", properties: {}, additionalProperties: false }),
      execute: async () => {
        calls.push(name)
        return name
      },
    })
  return SessionTools.isolateTransitions({ read: make("read"), plan_enter: make("plan_enter") })
}

function execute(tools: ReturnType<typeof SessionTools.isolateTransitions>, name: string) {
  const run = tools[name]?.execute
  if (!run) throw new Error(`Tool is not executable: ${name}`)
  return run({}, options)
}

describe("SessionTools.isolateTransitions", () => {
  test("rejects ordinary calls after a transition", async () => {
    const calls: string[] = []
    const isolated = tools(calls)

    await execute(isolated, "plan_enter")
    expect(() => execute(isolated, "read")).toThrow("Agent transition requires a new provider turn")
    expect(calls).toEqual(["plan_enter"])
  })

  test("rejects a transition after an ordinary call", async () => {
    const calls: string[] = []
    const isolated = tools(calls)

    await execute(isolated, "read")
    expect(() => execute(isolated, "plan_enter")).toThrow("Agent transition tools must run alone")
    expect(calls).toEqual(["read"])
  })
})
