import type { OpenCodeEvent } from "@opencode-ai/client/promise"
import type { V2Event } from "@opencode-ai/sdk/v2/client"

type CurrentSessionEvent = Extract<V2Event, { type: `session.next.${string}` }>

export type CompatibleOpenCodeEvent = OpenCodeEvent | CurrentSessionEvent
