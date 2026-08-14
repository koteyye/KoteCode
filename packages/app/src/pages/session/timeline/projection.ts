import type { SessionMessageInfo } from "@opencode-ai/client/promise"
import type { AssistantMessage, Message, Part, SessionStatus, UserMessage } from "@opencode-ai/sdk/v2"
import { createMemo, type Accessor } from "solid-js"
import { reuseTimelineRows } from "./row-reconciliation"
import { Timeline, TimelineRow } from "./rows"

export { reuseTimelineRows } from "./row-reconciliation"

export function createTimelineProjection(input: {
  messages: Accessor<Message[]>
  userMessages: Accessor<UserMessage[]>
  sessionMessages: Accessor<SessionMessageInfo[]>
  parts: (messageID: string) => Part[]
  status: Accessor<SessionStatus>
  showReasoningSummaries: Accessor<boolean>
  inlineComments: Accessor<boolean>
}) {
  const messageSnapshot = createMemo(() => {
    const messageByID = new Map<string, Message>()
    const assistantMessagesByParent = new Map<string, AssistantMessage[]>()
    input.messages().forEach((message) => {
      messageByID.set(message.id, message)
      if (message.role !== "assistant") return
      const messages = assistantMessagesByParent.get(message.parentID)
      if (messages) {
        messages.push(message)
        return
      }
      assistantMessagesByParent.set(message.parentID, [message])
    })
    return { assistantMessagesByParent, messageByID }
  })
  const messageByID = () => messageSnapshot().messageByID
  const assistantMessagesByParent = () => messageSnapshot().assistantMessagesByParent
  const projection = createMemo(() =>
    Timeline.constructSessionMessageRows(
      input.sessionMessages(),
      (messageID) => messageByID().get(messageID) as UserMessage | AssistantMessage | undefined,
      input.parts,
      input.showReasoningSummaries(),
      input.status().type,
      input.inlineComments(),
      input.userMessages(),
    ),
  )
  const activeMessageID = createMemo(() => projection().activeMessageID)
  const rows = createMemo((previous: TimelineRow.TimelineRow[] | undefined) =>
    reuseTimelineRows(previous, projection().rows),
  )
  const rowSnapshot = createMemo(() => {
    const rowByKey = new Map<string, TimelineRow.TimelineRow>()
    const messageRowIndex = new Map<string, number>()
    const messageLastRowIndex = new Map<string, number>()
    const lastAssistantGroupKey = new Map<string, string>()
    rows().forEach((row, index) => {
      rowByKey.set(TimelineRow.key(row), row)
      if (!("userMessageID" in row)) return
      if (!messageRowIndex.has(row.userMessageID)) messageRowIndex.set(row.userMessageID, index)
      messageLastRowIndex.set(row.userMessageID, index)
      if (row._tag === "AssistantPart") lastAssistantGroupKey.set(row.userMessageID, row.group.key)
    })
    return { lastAssistantGroupKey, messageLastRowIndex, messageRowIndex, rowByKey }
  })
  const rowByKey = () => rowSnapshot().rowByKey
  const messageRowIndex = () => rowSnapshot().messageRowIndex
  const messageLastRowIndex = () => rowSnapshot().messageLastRowIndex
  const lastAssistantGroupKey = () => rowSnapshot().lastAssistantGroupKey

  return {
    activeMessageID,
    assistantMessagesByParent,
    lastAssistantGroupKey,
    messageByID,
    messageRowIndex,
    messageLastRowIndex,
    rowByKey,
    rows,
  }
}
