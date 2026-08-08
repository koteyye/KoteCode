import { describe, expect, test } from "bun:test"
import type { SessionMessageInfo } from "@opencode-ai/client/promise"
import { createV2SessionReducer } from "./server-session-v2-reducer"
import type { CompatibleOpenCodeEvent } from "@/utils/server-event"

const event = (input: object) => input as CompatibleOpenCodeEvent
const base = { created: 1, location: { directory: "/repo" }, durable: { aggregateID: "ses_1", seq: 1, version: 1 } }

describe("v2 session reducer", () => {
  test("projects canonical agent and model switches", () => {
    const reducer = createV2SessionReducer()
    const agent = reducer.reduce(
      [],
      event({
        id: "evt_agent",
        metadata: { source: "tool" },
        type: "session.next.agent.switched",
        data: { timestamp: 5, sessionID: "ses_1", messageID: "msg_agent", agent: "plan" },
      }),
    )
    const model = reducer.reduce(
      agent?.messages ?? [],
      event({
        id: "evt_model",
        metadata: { source: "tool" },
        type: "session.next.model.switched",
        data: {
          timestamp: 6,
          sessionID: "ses_1",
          messageID: "msg_model",
          model: { id: "sonnet", providerID: "anthropic" },
        },
      }),
    )

    expect(model?.messages).toMatchObject([
      {
        id: "msg_agent",
        type: "agent-switched",
        agent: "plan",
        metadata: { source: "tool" },
        time: { created: 5 },
      },
      {
        id: "msg_model",
        type: "model-switched",
        model: { id: "sonnet", providerID: "anthropic" },
        metadata: { source: "tool" },
        time: { created: 6 },
      },
    ])
  })

  test("projects the canonical prompt and assistant stream", () => {
    const reducer = createV2SessionReducer()
    let messages: SessionMessageInfo[] = []
    const apply = (type: string, data: object) => {
      const result = reducer.reduce(
        messages,
        event({ id: `evt_${type}`, metadata: { source: "canonical" }, type, data: { timestamp: 5, ...data } }),
      )
      if (result) messages = result.messages
    }

    apply("session.next.prompted", {
      sessionID: "ses_1",
      messageID: "msg_user",
      prompt: { text: "hello", tools: { plan_enter: false } },
      delivery: "steer",
    })
    apply("session.next.step.started", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      agent: "build",
      model: { id: "model", providerID: "provider" },
    })
    apply("session.next.text.started", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      textID: "text_1",
    })
    apply("session.next.text.delta", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      textID: "text_1",
      delta: "hel",
    })
    apply("session.next.text.ended", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      textID: "text_1",
      text: "hello",
    })
    apply("session.next.reasoning.started", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      reasoningID: "reasoning_1",
      providerMetadata: { provider: { trace: "start" } },
    })
    apply("session.next.reasoning.delta", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      reasoningID: "reasoning_1",
      delta: "thi",
    })
    apply("session.next.reasoning.ended", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      reasoningID: "reasoning_1",
      text: "think",
      providerMetadata: { provider: { trace: "end" } },
    })
    apply("session.next.tool.input.started", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      callID: "call_1",
      name: "read",
    })
    apply("session.next.tool.input.delta", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      callID: "call_1",
      delta: "{",
    })
    apply("session.next.tool.input.ended", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      callID: "call_1",
      text: '{"path":"README.md"}',
    })
    apply("session.next.tool.called", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      callID: "call_1",
      tool: "read",
      input: { path: "README.md" },
      provider: { executed: true, metadata: { provider: { call: "started" } } },
    })
    apply("session.next.tool.progress", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      callID: "call_1",
      structured: { progress: 50 },
      content: [{ type: "text", text: "reading" }],
    })
    apply("session.next.tool.success", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      callID: "call_1",
      structured: { path: "README.md" },
      content: [{ type: "text", text: "done" }],
      result: { ok: true },
      provider: { executed: true, metadata: { provider: { call: "ended" } } },
    })
    apply("session.next.step.ended", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      finish: "stop",
      cost: 1,
      tokens: { input: 2, output: 3, reasoning: 4, cache: { read: 5, write: 6 } },
    })

    expect(messages).toMatchObject([
      { id: "msg_user", type: "user", text: "hello", time: { created: 5 } },
      {
        id: "msg_assistant",
        type: "assistant",
        finish: "stop",
        cost: 1,
        time: { created: 5, completed: 5 },
        content: [
          { type: "text", text: "hello" },
          {
            type: "reasoning",
            text: "think",
            state: { provider: { trace: "end" } },
            time: { created: 5, completed: 5 },
          },
          {
            type: "tool",
            id: "call_1",
            name: "read",
            executed: true,
            providerState: { provider: { call: "started" } },
            providerResultState: { provider: { call: "ended" } },
            state: {
              status: "completed",
              input: { path: "README.md" },
              structured: { path: "README.md" },
              content: [{ type: "text", text: "done" }],
              result: { ok: true },
            },
          },
        ],
      },
    ])
  })

  test("projects canonical system, synthetic, shell, compaction, and failure boundaries", () => {
    const reducer = createV2SessionReducer()
    let messages: SessionMessageInfo[] = []
    const apply = (type: string, data: object) => {
      const result = reducer.reduce(messages, event({ id: `evt_${type}`, type, data: { timestamp: 7, ...data } }))
      if (result) messages = result.messages
      return result
    }

    apply("session.next.context.updated", { sessionID: "ses_1", messageID: "msg_system", text: "context" })
    apply("session.next.synthetic", { sessionID: "ses_1", messageID: "msg_synthetic", text: "continue" })
    apply("session.next.shell.started", {
      sessionID: "ses_1",
      messageID: "msg_shell",
      callID: "shell_1",
      command: "pwd",
    })
    apply("session.next.shell.ended", { sessionID: "ses_1", callID: "shell_1", output: "/repo\n" })
    apply("session.next.compaction.started", {
      sessionID: "ses_1",
      messageID: "msg_compaction",
      reason: "auto",
    })
    apply("session.next.compaction.delta", {
      sessionID: "ses_1",
      messageID: "msg_compaction",
      text: "partial",
    })
    apply("session.next.compaction.ended", {
      sessionID: "ses_1",
      messageID: "msg_compaction",
      reason: "auto",
      text: "summary",
      recent: "recent",
    })
    apply("session.next.step.started", {
      sessionID: "ses_1",
      assistantMessageID: "msg_failed",
      agent: "build",
      model: { id: "model", providerID: "provider" },
    })
    apply("session.next.tool.input.started", {
      sessionID: "ses_1",
      assistantMessageID: "msg_failed",
      callID: "call_failed",
      name: "bash",
    })
    apply("session.next.tool.called", {
      sessionID: "ses_1",
      assistantMessageID: "msg_failed",
      callID: "call_failed",
      tool: "bash",
      input: { command: "false" },
      provider: { executed: true },
    })
    apply("session.next.tool.failed", {
      sessionID: "ses_1",
      assistantMessageID: "msg_failed",
      callID: "call_failed",
      error: { type: "unknown", message: "failed" },
      provider: { executed: true },
    })
    apply("session.next.step.failed", {
      sessionID: "ses_1",
      assistantMessageID: "msg_failed",
      error: { type: "unknown", message: "failed" },
    })

    expect(messages).toMatchObject([
      { id: "msg_system", type: "system", text: "context" },
      { id: "msg_synthetic", type: "synthetic", text: "continue" },
      {
        id: "msg_shell",
        type: "shell",
        shellID: "shell_1",
        status: "exited",
        output: { output: "/repo\n", truncated: false },
        time: { created: 7, completed: 7 },
      },
      {
        id: "msg_compaction",
        type: "compaction",
        status: "completed",
        summary: "summary",
        recent: "recent",
      },
      {
        id: "msg_failed",
        type: "assistant",
        finish: "error",
        error: { message: "failed" },
        content: [{ id: "call_failed", state: { status: "error", error: { message: "failed" } } }],
      },
    ])

    const ignored = [
      ["session.next.moved", { location: { directory: "/next" } }],
      ["session.next.prompt.admitted", { messageID: "msg_pending", prompt: { text: "queued" }, delivery: "queue" }],
      ["session.next.retried", { attempt: 2, error: { message: "retry", isRetryable: true } }],
      ["session.next.revert.staged", { revert: { messageID: "msg_user" } }],
      ["session.next.revert.cleared", {}],
      ["session.next.revert.committed", { messageID: "msg_user" }],
    ] as const
    ignored.forEach(([type, data]) => {
      const current = messages
      expect(apply(type, { sessionID: "ses_1", ...data })).toBeUndefined()
      expect(messages).toBe(current)
    })
  })

  test("projects promoted input and streaming assistant content", () => {
    const reducer = createV2SessionReducer()
    let messages: SessionMessageInfo[] = []
    const apply = (input: object) => {
      const result = reducer.reduce(messages, event(input))
      if (result) messages = result.messages
      return result
    }

    apply({
      ...base,
      id: "evt_admitted",
      type: "session.input.admitted",
      data: {
        sessionID: "ses_1",
        inputID: "msg_user",
        input: { type: "user", delivery: "steer", data: { text: "hello" } },
      },
    })
    apply({
      ...base,
      id: "evt_promoted",
      type: "session.input.promoted",
      data: { sessionID: "ses_1", inputID: "msg_user" },
    })
    apply({
      ...base,
      id: "evt_step",
      type: "session.step.started",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_assistant",
        agent: "build",
        model: { id: "model", providerID: "provider" },
      },
    })
    apply({
      ...base,
      id: "evt_text_start",
      type: "session.text.started",
      data: { sessionID: "ses_1", assistantMessageID: "msg_assistant", ordinal: 0 },
    })
    apply({
      ...base,
      id: "evt_text_delta",
      type: "session.text.delta",
      data: { sessionID: "ses_1", assistantMessageID: "msg_assistant", ordinal: 0, delta: "hel" },
    })
    apply({
      ...base,
      id: "evt_text_end",
      type: "session.text.ended",
      data: { sessionID: "ses_1", assistantMessageID: "msg_assistant", ordinal: 0, text: "hello" },
    })

    expect(messages[0]).toMatchObject({ id: "msg_user", type: "user", text: "hello" })
    expect(messages[1]).toMatchObject({
      id: "msg_assistant",
      type: "assistant",
      content: [{ type: "text", text: "hello" }],
    })
  })

  test("folds tool, retry, and completion events", () => {
    const reducer = createV2SessionReducer()
    let messages: SessionMessageInfo[] = []
    const apply = (input: object) => {
      const result = reducer.reduce(messages, event(input))
      if (result) messages = result.messages
    }

    apply({
      ...base,
      id: "evt_step",
      type: "session.step.started",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_assistant",
        agent: "build",
        model: { id: "model", providerID: "provider" },
      },
    })
    apply({
      ...base,
      id: "evt_tool_start",
      type: "session.tool.input.started",
      data: { sessionID: "ses_1", assistantMessageID: "msg_assistant", callID: "call_1", name: "bash" },
    })
    apply({
      ...base,
      id: "evt_tool_delta",
      type: "session.tool.input.delta",
      data: { sessionID: "ses_1", assistantMessageID: "msg_assistant", callID: "call_1", delta: "{}" },
    })
    apply({
      ...base,
      id: "evt_tool_called",
      type: "session.tool.called",
      data: { sessionID: "ses_1", assistantMessageID: "msg_assistant", callID: "call_1", input: {}, executed: true },
    })
    apply({
      ...base,
      id: "evt_tool_success",
      type: "session.tool.success",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_assistant",
        callID: "call_1",
        structured: {},
        content: [{ type: "text", text: "done" }],
        executed: true,
      },
    })
    apply({
      ...base,
      id: "evt_retry",
      type: "session.retry.scheduled",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_assistant",
        attempt: 2,
        at: 10,
        error: { type: "ProviderError", message: "retry" },
      },
    })
    apply({ ...base, id: "evt_done", type: "session.execution.succeeded", data: { sessionID: "ses_1" } })

    expect(messages[0]).toMatchObject({
      type: "assistant",
      retry: undefined,
      content: [{ type: "tool", id: "call_1", state: { status: "completed", content: [{ text: "done" }] } }],
    })
  })

  test("requests hydration when promotion admission was missed", () => {
    const result = createV2SessionReducer().reduce(
      [],
      event({
        ...base,
        id: "evt_promoted",
        type: "session.input.promoted",
        data: { sessionID: "ses_1", inputID: "msg_user" },
      }),
    )

    expect(result).toMatchObject({ sessionID: "ses_1", missing: "msg_user", touched: [] })
  })
})
