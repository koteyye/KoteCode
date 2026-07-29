import { Locale } from "@/util/locale"
import type { SessionMessages } from "./session.shared"
import type { RunProvider, StreamCommit } from "./types"
import type { Language } from "@opencode-ai/tui/util/locale"

export function turnSummaryCommit(input: {
  agent: string
  model: string
  duration: string
  messageID?: string
}): StreamCommit {
  return {
    kind: "system",
    text: `▣ ${input.agent} · ${input.model} · ${input.duration}`,
    phase: "final",
    source: "system",
    summary: {
      agent: input.agent,
      model: input.model,
      duration: input.duration,
    },
    messageID: input.messageID,
  }
}

export function messageTurnSummaryCommit(
  message: SessionMessages[number],
  providers?: RunProvider[],
  language: Language = "en",
): StreamCommit | undefined {
  const info = message.info
  if (info.role !== "assistant") {
    return
  }

  const completed = info.time.completed
  if (typeof completed !== "number" || completed <= info.time.created) {
    return
  }

  const model = providers?.find((item) => item.id === info.providerID)?.models[info.modelID]?.name

  return turnSummaryCommit({
    agent: Locale.agent(info.agent, language),
    model: model ?? info.modelID,
    duration: Locale.duration(completed - info.time.created),
    messageID: info.id,
  })
}
