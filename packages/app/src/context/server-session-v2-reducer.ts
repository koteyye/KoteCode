import type { JsonValue, SessionMessageInfo, SessionPendingMessage } from "@opencode-ai/client/promise"
import type { CompatibleOpenCodeEvent } from "@/utils/server-event"

type Assistant = Extract<SessionMessageInfo, { type: "assistant" }>
type Compaction = Extract<SessionMessageInfo, { type: "compaction" }>
type Shell = Extract<SessionMessageInfo, { type: "shell" }>

export type V2SessionReduction = {
  sessionID: string
  messages: SessionMessageInfo[]
  touched: string[]
  missing?: string
}

export function createV2SessionReducer() {
  const pending = new Map<string, SessionPendingMessage>()
  const contentOrdinals = new Map<string, number>()

  const reduce = (
    source: readonly SessionMessageInfo[],
    event: CompatibleOpenCodeEvent,
  ): V2SessionReduction | undefined => {
    if (!("data" in event) || !("sessionID" in event.data) || typeof event.data.sessionID !== "string") return
    const sessionID = event.data.sessionID
    const metadata = event.metadata as Record<string, JsonValue> | undefined
    const result = (messages: SessionMessageInfo[], touched: string[] = []): V2SessionReduction => ({
      sessionID,
      messages,
      touched,
    })
    const append = (message: SessionMessageInfo) =>
      result(source.some((item) => item.id === message.id) ? [...source] : [...source, message], [message.id])
    const registerOrdinal = (messageID: string, type: "text" | "reasoning", contentID: string) => {
      const id = contentKey(sessionID, messageID, type, contentID)
      const current = contentOrdinals.get(id)
      if (current !== undefined) return current
      const assistant = source.find((item): item is Assistant => item.type === "assistant" && item.id === messageID)
      const ordinal = assistant?.content.filter((item) => item.type === type).length ?? 0
      contentOrdinals.set(id, ordinal)
      return ordinal
    }
    const findOrdinal = (messageID: string, type: "text" | "reasoning", contentID: string) =>
      contentOrdinals.get(contentKey(sessionID, messageID, type, contentID))

    switch (event.type) {
      case "session.input.admitted":
        pending.set(key(sessionID, event.data.inputID), event.data.input)
        return result([...source])
      case "session.input.promoted": {
        const input = pending.get(key(sessionID, event.data.inputID))
        pending.delete(key(sessionID, event.data.inputID))
        if (!input) return { ...result([...source]), missing: event.data.inputID }
        if (input.type === "user")
          return append({
            id: event.data.inputID,
            type: "user",
            metadata: input.data.metadata,
            text: input.data.text,
            files: input.data.files,
            agents: input.data.agents,
            time: { created: event.created },
          })
        return append({
          id: event.data.inputID,
          type: "synthetic",
          metadata: input.data.metadata,
          text: input.data.text,
          description: input.data.description,
          time: { created: event.created },
        })
      }
      case "session.agent.selected":
      case "session.next.agent.switched":
        return append({
          id: event.type === "session.next.agent.switched" ? event.data.messageID : messageID(event.id),
          type: "agent-switched",
          metadata,
          agent: event.data.agent,
          time: { created: event.type === "session.next.agent.switched" ? event.data.timestamp : event.created },
        })
      case "session.model.selected":
      case "session.next.model.switched":
        return append({
          id: event.type === "session.next.model.switched" ? event.data.messageID : messageID(event.id),
          type: "model-switched",
          metadata,
          model: event.data.model,
          previous: source.findLast(
            (item): item is Extract<SessionMessageInfo, { type: "model-switched" | "assistant" }> =>
              item.type === "model-switched" || item.type === "assistant",
          )?.model,
          time: { created: event.type === "session.next.model.switched" ? event.data.timestamp : event.created },
        })
      case "session.next.moved":
      case "session.next.prompt.admitted":
      case "session.next.retried":
      case "session.next.revert.staged":
      case "session.next.revert.cleared":
      case "session.next.revert.committed":
        return
      case "session.next.prompted":
        return append({
          id: event.data.messageID,
          type: "user",
          metadata,
          text: event.data.prompt.text,
          files: event.data.prompt.files?.map((file) => {
            const inline = /^data:[^,]*;base64,(.*)$/s.exec(file.uri)
            return {
              data: inline?.[1] ?? "",
              mime: file.mime,
              name: file.name,
              description: file.description,
              source: inline ? ({ type: "inline" } as const) : ({ type: "uri", uri: file.uri } as const),
              mention: file.source,
            }
          }),
          agents: event.data.prompt.agents?.map((agent) => ({
            name: agent.name,
            mention: agent.source,
          })),
          time: { created: event.data.timestamp },
        })
      case "session.next.context.updated":
        return append({
          id: event.data.messageID,
          type: "system",
          metadata,
          text: event.data.text,
          time: { created: event.data.timestamp },
        })
      case "session.next.synthetic":
        return append({
          id: event.data.messageID,
          type: "synthetic",
          metadata,
          text: event.data.text,
          time: { created: event.data.timestamp },
        })
      case "session.synthetic":
        return append({
          id: messageID(event.id),
          type: "synthetic",
          metadata: event.data.metadata,
          text: event.data.text,
          description: event.data.description,
          time: { created: event.created },
        })
      case "session.skill.activated":
        return append({
          id: messageID(event.id),
          type: "skill",
          metadata,
          skill: event.data.id,
          name: event.data.name,
          text: event.data.text,
          time: { created: event.created },
        })
      case "session.next.shell.started":
        return append({
          id: event.data.messageID,
          type: "shell",
          metadata,
          shellID: event.data.callID,
          command: event.data.command,
          status: "running",
          time: { created: event.data.timestamp },
        })
      case "session.next.shell.ended":
        return updateMessage<Shell>(
          source,
          (item): item is Shell => item.type === "shell" && item.shellID === event.data.callID,
          (item) => ({
            ...item,
            status: "exited",
            output: {
              output: event.data.output,
              cursor: event.data.output.length,
              size: event.data.output.length,
              truncated: false,
            },
            time: { ...item.time, completed: event.data.timestamp },
          }),
          sessionID,
        )
      case "session.shell.started":
        return append({
          id: messageID(event.id),
          type: "shell",
          metadata,
          shellID: event.data.shell.id,
          command: event.data.shell.command,
          status: event.data.shell.status,
          exit: event.data.shell.exit,
          time: { created: event.created },
        })
      case "session.shell.ended":
        return updateMessage<Shell>(
          source,
          (item): item is Shell => item.type === "shell" && item.shellID === event.data.shell.id,
          (item) => ({
            ...item,
            status: event.data.shell.status,
            exit: event.data.shell.exit,
            output: event.data.output,
            time: { ...item.time, completed: event.created },
          }),
          sessionID,
        )
      case "session.step.started":
      case "session.next.step.started": {
        const timestamp = event.type === "session.next.step.started" ? event.data.timestamp : event.created
        const current = source.findLast((item): item is Assistant => item.type === "assistant" && !item.time.completed)
        const completed =
          current && current.id !== event.data.assistantMessageID
            ? update(source, current.id, (item) =>
                item.type === "assistant"
                  ? { ...item, retry: undefined, time: { ...item.time, completed: timestamp } }
                  : item,
              )
            : [...source]
        const existing = completed.find((item) => item.id === event.data.assistantMessageID)
        if (existing?.type === "assistant")
          return result(
            update(completed, existing.id, (item) =>
              item.type === "assistant"
                ? {
                    ...item,
                    agent: event.data.agent,
                    model: event.data.model,
                    retry: undefined,
                    error: undefined,
                    finish: undefined,
                    snapshot: event.data.snapshot ? { ...item.snapshot, start: event.data.snapshot } : item.snapshot,
                    time: { ...item.time, completed: undefined },
                  }
                : item,
            ),
            current && current.id !== existing.id ? [current.id, existing.id] : [existing.id],
          )
        return result(
          [
            ...completed,
            {
              id: event.data.assistantMessageID,
              type: "assistant",
              metadata,
              agent: event.data.agent,
              model: event.data.model,
              content: [],
              snapshot: event.data.snapshot ? { start: event.data.snapshot } : undefined,
              time: { created: timestamp },
            },
          ],
          current ? [current.id, event.data.assistantMessageID] : [event.data.assistantMessageID],
        )
      }
      case "session.step.ended":
      case "session.next.step.ended":
        return updateAssistant(source, event.data.assistantMessageID, sessionID, (item) => ({
          ...item,
          finish: event.data.finish as Assistant["finish"],
          cost: event.data.cost,
          tokens: event.data.tokens,
          snapshot:
            event.data.snapshot || event.data.files
              ? { ...item.snapshot, end: event.data.snapshot, files: event.data.files }
              : item.snapshot,
          time: {
            ...item.time,
            completed: event.type === "session.next.step.ended" ? event.data.timestamp : event.created,
          },
        }))
      case "session.step.failed":
      case "session.next.step.failed":
        return updateAssistant(source, event.data.assistantMessageID, sessionID, (item) => ({
          ...item,
          finish: "error",
          error: event.data.error,
          retry: undefined,
          cost: event.type === "session.step.failed" ? (event.data.cost ?? item.cost) : item.cost,
          tokens: event.type === "session.step.failed" ? (event.data.tokens ?? item.tokens) : item.tokens,
          snapshot:
            event.type === "session.step.failed" && (event.data.snapshot || event.data.files)
              ? { ...item.snapshot, end: event.data.snapshot, files: event.data.files }
              : item.snapshot,
          time: {
            ...item.time,
            completed: event.type === "session.next.step.failed" ? event.data.timestamp : event.created,
          },
        }))
      case "session.text.started":
      case "session.next.text.started": {
        const ordinal =
          event.type === "session.next.text.started"
            ? registerOrdinal(event.data.assistantMessageID, "text", event.data.textID)
            : event.data.ordinal
        return updateAssistant(source, event.data.assistantMessageID, sessionID, (item) => ({
          ...item,
          content: insertOrdinal(item.content, "text", ordinal, { type: "text", text: "" }),
        }))
      }
      case "session.text.delta":
      case "session.next.text.delta": {
        const ordinal =
          event.type === "session.next.text.delta"
            ? findOrdinal(event.data.assistantMessageID, "text", event.data.textID)
            : event.data.ordinal
        if (ordinal === undefined) return
        return updateContent(source, event.data.assistantMessageID, sessionID, "text", ordinal, (item) => ({
          ...item,
          text: item.text + event.data.delta,
        }))
      }
      case "session.text.ended":
      case "session.next.text.ended": {
        const ordinal =
          event.type === "session.next.text.ended"
            ? findOrdinal(event.data.assistantMessageID, "text", event.data.textID)
            : event.data.ordinal
        if (ordinal === undefined) return
        return updateContent(source, event.data.assistantMessageID, sessionID, "text", ordinal, (item) => ({
          ...item,
          text: event.data.text,
        }))
      }
      case "session.reasoning.started":
      case "session.next.reasoning.started": {
        const ordinal =
          event.type === "session.next.reasoning.started"
            ? registerOrdinal(event.data.assistantMessageID, "reasoning", event.data.reasoningID)
            : event.data.ordinal
        return updateAssistant(source, event.data.assistantMessageID, sessionID, (item) => ({
          ...item,
          content: insertOrdinal(item.content, "reasoning", ordinal, {
            type: "reasoning",
            text: "",
            state:
              event.type === "session.next.reasoning.started"
                ? (event.data.providerMetadata as Record<string, JsonValue> | undefined)
                : event.data.state,
            time: {
              created: event.type === "session.next.reasoning.started" ? event.data.timestamp : event.created,
            },
          }),
        }))
      }
      case "session.reasoning.delta":
      case "session.next.reasoning.delta": {
        const ordinal =
          event.type === "session.next.reasoning.delta"
            ? findOrdinal(event.data.assistantMessageID, "reasoning", event.data.reasoningID)
            : event.data.ordinal
        if (ordinal === undefined) return
        return updateContent(source, event.data.assistantMessageID, sessionID, "reasoning", ordinal, (item) => ({
          ...item,
          text: item.text + event.data.delta,
        }))
      }
      case "session.reasoning.ended":
      case "session.next.reasoning.ended": {
        const ordinal =
          event.type === "session.next.reasoning.ended"
            ? findOrdinal(event.data.assistantMessageID, "reasoning", event.data.reasoningID)
            : event.data.ordinal
        if (ordinal === undefined) return
        return updateContent(source, event.data.assistantMessageID, sessionID, "reasoning", ordinal, (item) => ({
          ...item,
          text: event.data.text,
          state:
            (event.type === "session.next.reasoning.ended"
              ? (event.data.providerMetadata as Record<string, JsonValue> | undefined)
              : event.data.state) ?? item.state,
          time: {
            created:
              item.time?.created ??
              (event.type === "session.next.reasoning.ended" ? event.data.timestamp : event.created),
            completed: event.type === "session.next.reasoning.ended" ? event.data.timestamp : event.created,
          },
        }))
      }
      case "session.tool.input.started":
      case "session.next.tool.input.started":
        return updateAssistant(source, event.data.assistantMessageID, sessionID, (item) => ({
          ...item,
          content: item.content.some((content) => content.type === "tool" && content.id === event.data.callID)
            ? item.content
            : [
                ...item.content,
                {
                  type: "tool",
                  id: event.data.callID,
                  name: event.data.name,
                  state: { status: "streaming", input: "" },
                  time: {
                    created: event.type === "session.next.tool.input.started" ? event.data.timestamp : event.created,
                  },
                },
              ],
        }))
      case "session.tool.input.delta":
      case "session.next.tool.input.delta":
        return updateTool(source, event.data.assistantMessageID, event.data.callID, sessionID, (tool) =>
          tool.state.status === "streaming"
            ? { ...tool, state: { ...tool.state, input: tool.state.input + event.data.delta } }
            : tool,
        )
      case "session.tool.input.ended":
      case "session.next.tool.input.ended":
        return updateTool(source, event.data.assistantMessageID, event.data.callID, sessionID, (tool) =>
          tool.state.status === "streaming" ? { ...tool, state: { ...tool.state, input: event.data.text } } : tool,
        )
      case "session.tool.called":
      case "session.next.tool.called":
        return updateTool(source, event.data.assistantMessageID, event.data.callID, sessionID, (tool) => ({
          ...tool,
          name: event.type === "session.next.tool.called" ? event.data.tool : tool.name,
          executed: event.type === "session.next.tool.called" ? event.data.provider.executed : event.data.executed,
          providerState:
            event.type === "session.next.tool.called"
              ? (event.data.provider.metadata as Record<string, JsonValue> | undefined)
              : event.data.state,
          state: {
            status: "running",
            input: event.data.input as Record<string, JsonValue>,
            structured: {},
            content: [],
          },
          time: {
            ...tool.time,
            ran: event.type === "session.next.tool.called" ? event.data.timestamp : event.created,
          },
        }))
      case "session.tool.progress":
      case "session.next.tool.progress":
        return updateTool(source, event.data.assistantMessageID, event.data.callID, sessionID, (tool) =>
          tool.state.status === "running"
            ? {
                ...tool,
                state: {
                  ...tool.state,
                  structured: event.data.structured as Record<string, JsonValue>,
                  content: event.data.content,
                },
              }
            : tool,
        )
      case "session.tool.success":
      case "session.next.tool.success":
        return updateTool(source, event.data.assistantMessageID, event.data.callID, sessionID, (tool) => {
          if (tool.state.status !== "running") return tool
          return {
            ...tool,
            executed:
              (event.type === "session.next.tool.success" ? event.data.provider.executed : event.data.executed) ||
              tool.executed === true,
            providerResultState:
              event.type === "session.next.tool.success"
                ? (event.data.provider.metadata as Record<string, JsonValue> | undefined)
                : event.data.resultState,
            state: {
              status: "completed",
              input: tool.state.input,
              structured: event.data.structured as Record<string, JsonValue>,
              content: event.data.content,
              result: event.data.result as JsonValue | undefined,
            },
            time: {
              ...tool.time,
              completed: event.type === "session.next.tool.success" ? event.data.timestamp : event.created,
            },
          }
        })
      case "session.tool.failed":
      case "session.next.tool.failed":
        return updateTool(source, event.data.assistantMessageID, event.data.callID, sessionID, (tool) => {
          if (tool.state.status !== "streaming" && tool.state.status !== "running") return tool
          return {
            ...tool,
            executed:
              (event.type === "session.next.tool.failed" ? event.data.provider.executed : event.data.executed) ||
              tool.executed === true,
            providerResultState:
              event.type === "session.next.tool.failed"
                ? (event.data.provider.metadata as Record<string, JsonValue> | undefined)
                : event.data.resultState,
            state: {
              status: "error",
              input: typeof tool.state.input === "string" ? {} : tool.state.input,
              structured: tool.state.status === "running" ? tool.state.structured : {},
              content: tool.state.status === "running" ? tool.state.content : [],
              error: event.data.error,
              result: event.data.result as JsonValue | undefined,
            },
            time: {
              ...tool.time,
              completed: event.type === "session.next.tool.failed" ? event.data.timestamp : event.created,
            },
          }
        })
      case "session.retry.scheduled":
        return updateAssistant(source, event.data.assistantMessageID, sessionID, (item) => ({
          ...item,
          retry: { attempt: event.data.attempt, at: event.data.at, error: event.data.error },
        }))
      case "session.execution.succeeded":
      case "session.execution.failed":
      case "session.execution.interrupted": {
        const current = source.findLast((item): item is Assistant => item.type === "assistant" && !item.time.completed)
        if (!current?.retry) return result([...source])
        return updateAssistant(source, current.id, sessionID, (item) => ({ ...item, retry: undefined }))
      }
      case "session.compaction.started":
      case "session.next.compaction.started":
        return append({
          id:
            event.type === "session.next.compaction.started"
              ? event.data.messageID
              : (event.data.inputID ?? messageID(event.id)),
          type: "compaction",
          status: "running",
          metadata,
          reason: event.data.reason,
          summary: "",
          recent: event.type === "session.next.compaction.started" ? "" : event.data.recent,
          time: {
            created: event.type === "session.next.compaction.started" ? event.data.timestamp : event.created,
          },
        })
      case "session.compaction.delta":
      case "session.next.compaction.delta":
        return updateMessage<Extract<Compaction, { status: "running" }>>(
          source,
          (item): item is Extract<Compaction, { status: "running" }> =>
            item.type === "compaction" &&
            item.status === "running" &&
            (event.type !== "session.next.compaction.delta" || item.id === event.data.messageID),
          (item) => ({
            ...item,
            summary: item.summary + event.data.text,
          }),
          sessionID,
        )
      case "session.compaction.ended": {
        const current = source.findLast(
          (item): item is Extract<Compaction, { status: "running" }> =>
            item.type === "compaction" && item.status === "running",
        )
        if (!current)
          return append({
            id: messageID(event.id),
            type: "compaction",
            status: "completed",
            metadata: event.metadata,
            reason: event.data.reason,
            summary: event.data.text,
            recent: event.data.recent,
            time: { created: event.created },
          })
        return result(
          update(source, current.id, () => ({
            ...current,
            status: "completed",
            reason: event.data.reason,
            summary: event.data.text,
            recent: event.data.recent,
          })),
          [current.id],
        )
      }
      case "session.next.compaction.ended": {
        const current = source.find(
          (item): item is Extract<Compaction, { status: "running" }> =>
            item.type === "compaction" && item.status === "running" && item.id === event.data.messageID,
        )
        if (!current)
          return append({
            id: event.data.messageID,
            type: "compaction",
            status: "completed",
            metadata,
            reason: event.data.reason,
            summary: event.data.text,
            recent: event.data.recent,
            time: { created: event.data.timestamp },
          })
        return result(
          update(source, current.id, () => ({
            ...current,
            status: "completed",
            reason: event.data.reason,
            summary: event.data.text,
            recent: event.data.recent,
          })),
          [current.id],
        )
      }
      case "session.compaction.failed": {
        const current = source.findLast(
          (item): item is Extract<Compaction, { status: "running" }> =>
            item.type === "compaction" && item.status === "running",
        )
        const failed: Extract<Compaction, { status: "failed" }> = {
          id: current?.id ?? event.data.inputID ?? messageID(event.id),
          type: "compaction",
          status: "failed",
          metadata: current?.metadata ?? event.metadata,
          reason: event.data.reason,
          error: event.data.error,
          time: current?.time ?? { created: event.created },
        }
        if (!current) return append(failed)
        return result(
          update(source, current.id, () => failed),
          [failed.id],
        )
      }
      default:
        return
    }
  }

  return {
    reduce,
    clear(sessionID: string) {
      for (const id of pending.keys()) {
        if (id.startsWith(`${sessionID}:`)) pending.delete(id)
      }
      for (const id of contentOrdinals.keys()) {
        if (id.startsWith(`${sessionID}:`)) contentOrdinals.delete(id)
      }
    },
  }
}

function key(sessionID: string, inputID: string) {
  return `${sessionID}:${inputID}`
}

function contentKey(sessionID: string, messageID: string, type: "text" | "reasoning", contentID: string) {
  return `${sessionID}:${messageID}:${type}:${contentID}`
}

function messageID(eventID: string) {
  return eventID.replace(/^evt_/, "msg_")
}

function update(
  source: readonly SessionMessageInfo[],
  id: string,
  apply: (item: SessionMessageInfo) => SessionMessageInfo,
) {
  return source.map((item) => (item.id === id ? apply(item) : item))
}

function updateMessage<T extends SessionMessageInfo>(
  source: readonly SessionMessageInfo[],
  matches: (item: SessionMessageInfo) => item is T,
  apply: (item: T) => T,
  sessionID: string,
): V2SessionReduction {
  const current = source.findLast(matches)
  if (!current) return { sessionID, messages: [...source], touched: [] }
  return {
    sessionID,
    messages: update(source, current.id, (item) => (matches(item) ? apply(item) : item)),
    touched: [current.id],
  }
}

function updateAssistant(
  source: readonly SessionMessageInfo[],
  id: string,
  sessionID: string,
  apply: (item: Assistant) => Assistant,
): V2SessionReduction {
  return {
    sessionID,
    messages: update(source, id, (item) => (item.type === "assistant" ? apply(item) : item)),
    touched: source.some((item) => item.id === id && item.type === "assistant") ? [id] : [],
  }
}

function updateContent<T extends "text" | "reasoning">(
  source: readonly SessionMessageInfo[],
  messageID: string,
  sessionID: string,
  type: T,
  ordinal: number,
  apply: (
    item: Extract<Assistant["content"][number], { type: T }>,
  ) => Extract<Assistant["content"][number], { type: T }>,
) {
  return updateAssistant(source, messageID, sessionID, (assistant) => {
    let index = -1
    return {
      ...assistant,
      content: assistant.content.map((item) => {
        if (item.type !== type || ++index !== ordinal) return item
        return apply(item as Extract<Assistant["content"][number], { type: T }>)
      }),
    }
  })
}

function updateTool(
  source: readonly SessionMessageInfo[],
  messageID: string,
  callID: string,
  sessionID: string,
  apply: (
    item: Extract<Assistant["content"][number], { type: "tool" }>,
  ) => Extract<Assistant["content"][number], { type: "tool" }>,
) {
  return updateAssistant(source, messageID, sessionID, (assistant) => ({
    ...assistant,
    content: assistant.content.map((item) => (item.type === "tool" && item.id === callID ? apply(item) : item)),
  }))
}

function insertOrdinal<T extends Assistant["content"][number]["type"]>(
  source: Assistant["content"],
  type: T,
  ordinal: number,
  item: Extract<Assistant["content"][number], { type: T }>,
) {
  const matches = source.filter((content) => content.type === type)
  if (matches[ordinal]) return source
  return [...source, item]
}
