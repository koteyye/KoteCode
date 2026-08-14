import { describe, expect, mock, test } from "bun:test"
import type { SessionMessageInfo } from "@opencode-ai/client/promise"
import type { PartGroup } from "@opencode-ai/session-ui/message-part"
import { createRoot } from "solid-js"
import { normalizeSessionMessages } from "@/utils/session-message"
import { reuseTimelineRows } from "./row-reconciliation"
import { TimelineRow } from "./timeline-row"

mock.module("@opencode-ai/session-ui/message-part", () => ({
  renderable: () => true,
  groupParts: (refs: Array<{ messageID: string; part: { id: string } }>) =>
    refs.map((ref) => ({
      type: "part" as const,
      key: `part:${ref.messageID}:${ref.part.id}`,
      ref: { messageID: ref.messageID, partID: ref.part.id },
    })),
}))

const { createTimelineProjection } = await import("./projection")

const context = (key: string, partIDs: string[], userMessageID = "user-1") =>
  new TimelineRow.AssistantPart({
    userMessageID,
    group: {
      key,
      type: "context",
      refs: partIDs.map((partID) => ({ messageID: "assistant-1", partID })),
    } satisfies PartGroup,
    previousAssistantPart: false,
  })

const user = (userMessageID = "user-1") => new TimelineRow.UserMessage({ userMessageID, anchor: true })
const keys = (rows: TimelineRow.TimelineRow[]) => rows.map(TimelineRow.key)

describe("reuseTimelineRows", () => {
  test.each([
    {
      name: "reuses an unchanged context group",
      previous: [context("context:a", ["a", "b"])],
      rows: [context("context:a", ["a", "b"])],
      expected: ["assistant-part:user-1:context:a"],
      reused: [[0, 0]],
    },
    {
      name: "preserves the group key when a member is appended",
      previous: [context("context:a", ["a"])],
      rows: [context("context:a", ["a", "b"])],
      expected: ["assistant-part:user-1:context:a"],
      reused: [],
    },
    {
      name: "preserves the group key when the first member is removed",
      previous: [context("context:a", ["a", "b"])],
      rows: [context("context:b", ["b"])],
      expected: ["assistant-part:user-1:context:a"],
      reused: [],
    },
    {
      name: "lets only the natural owner retain an old key after a split",
      previous: [context("context:a", ["a", "b"])],
      rows: [context("context:a", ["a"]), context("context:b", ["b"])],
      expected: ["assistant-part:user-1:context:a", "assistant-part:user-1:context:b"],
      reused: [],
    },
    {
      name: "chooses the earliest prior key when groups merge",
      previous: [context("context:a", ["a"]), context("context:b", ["b"])],
      rows: [context("context:b", ["b", "a"])],
      expected: ["assistant-part:user-1:context:a"],
      reused: [],
    },
    {
      name: "reserves an old key for its natural owner when two new groups compete",
      previous: [context("context:a", ["a", "b"])],
      rows: [context("context:b", ["b"]), context("context:a", ["a"])],
      expected: ["assistant-part:user-1:context:b", "assistant-part:user-1:context:a"],
      reused: [],
    },
    {
      name: "does not reuse context identity across user messages",
      previous: [context("context:a", ["a", "b"], "user-1")],
      rows: [context("context:b", ["b"], "user-2")],
      expected: ["assistant-part:user-2:context:b"],
      reused: [],
    },
    {
      name: "reuses an unaffected ordinary row",
      previous: [user()],
      rows: [user()],
      expected: ["user-message:user-1"],
      reused: [[0, 0]],
    },
    {
      name: "does not create accidental key collisions",
      previous: [context("context:a", ["a", "b", "c"])],
      rows: [context("context:b", ["b"]), context("context:a", ["a"]), context("context:c", ["c"])],
      expected: [
        "assistant-part:user-1:context:b",
        "assistant-part:user-1:context:a",
        "assistant-part:user-1:context:c",
      ],
      reused: [],
    },
  ])("$name", ({ previous, rows, expected, reused }) => {
    const result = reuseTimelineRows([...previous], [...rows])

    expect(keys(result)).toEqual([...expected])
    expect(new Set(keys(result)).size).toBe(result.length)
    reused.forEach(([resultIndex, previousIndex]) => expect(result[resultIndex]).toBe(previous[previousIndex]))
  })
})

describe("createTimelineProjection", () => {
  test("indexes keys and turn boundaries in the reconciled row order", () => {
    const source = [
      { id: "user-1", type: "user", text: "first", time: { created: 1 } },
      {
        id: "assistant-1",
        type: "assistant",
        agent: "build",
        model: { id: "model", providerID: "provider" },
        content: [
          { type: "text", text: "one" },
          { type: "text", text: "two" },
        ],
        time: { created: 2, completed: 3 },
      },
      { id: "user-2", type: "user", text: "second", time: { created: 4 } },
      {
        id: "assistant-2",
        type: "assistant",
        agent: "build",
        model: { id: "model", providerID: "provider" },
        content: [{ type: "text", text: "three" }],
        time: { created: 5, completed: 6 },
      },
    ] satisfies SessionMessageInfo[]
    const normalized = normalizeSessionMessages("session-1", source)

    createRoot((dispose) => {
      const projection = createTimelineProjection({
        messages: () => normalized.messages,
        userMessages: () => normalized.messages.filter((message) => message.role === "user"),
        sessionMessages: () => source,
        parts: (messageID) => normalized.parts.get(messageID) ?? [],
        status: () => ({ type: "idle" }),
        showReasoningSummaries: () => false,
        inlineComments: () => true,
      })

      const rows = projection.rows()
      normalized.messages.forEach((message) => expect(projection.messageByID().get(message.id)).toBe(message))
      expect(
        projection
          .assistantMessagesByParent()
          .get("user-1")
          ?.map((message) => message.id),
      ).toEqual(["assistant-1"])
      expect(
        projection
          .assistantMessagesByParent()
          .get("user-2")
          ?.map((message) => message.id),
      ).toEqual(["assistant-2"])
      expect(rows.map(TimelineRow.key)).toEqual([
        "user-message:user-1",
        "assistant-part:user-1:part:assistant-1:assistant-1:text:0",
        "assistant-part:user-1:part:assistant-1:assistant-1:text:1",
        "turn-gap:user-2",
        "user-message:user-2",
        "assistant-part:user-2:part:assistant-2:assistant-2:text:0",
      ])
      expect(projection.messageRowIndex()).toEqual(
        new Map([
          ["user-1", 0],
          ["user-2", 3],
        ]),
      )
      expect(projection.messageLastRowIndex()).toEqual(
        new Map([
          ["user-1", 2],
          ["user-2", 5],
        ]),
      )
      expect(projection.lastAssistantGroupKey()).toEqual(
        new Map([
          ["user-1", "part:assistant-1:assistant-1:text:1"],
          ["user-2", "part:assistant-2:assistant-2:text:0"],
        ]),
      )
      rows.forEach((row) => expect(projection.rowByKey().get(TimelineRow.key(row))).toBe(row))
      dispose()
    })
  })
})
