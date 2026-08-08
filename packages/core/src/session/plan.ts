export * as SessionPlan from "./plan"

import path from "path"
import { DateTime } from "effect"
import { Global } from "../global"
import type { Location } from "../location"
import type { SessionSchema } from "./schema"

export const allowedTools: ReadonlySet<string> = new Set([
  "apply_patch",
  "edit",
  "glob",
  "grep",
  "plan_exit",
  "question",
  "read",
  "skill",
  "webfetch",
  "websearch",
  "write",
])

export function file(session: SessionSchema.Info, location: Location.Interface) {
  const directory = location.vcs
    ? path.join(location.project.directory, ".opencode", "plans")
    : path.join(Global.Path.data, "plans")
  return path.join(directory, `${DateTime.toEpochMillis(session.time.created)}-${session.id}.md`)
}

export function instructions(plan: string) {
  return `<system-reminder>
Plan mode is active. Do not implement the task yet. You MUST NOT edit files other than the plan file, run mutating tools, change configuration, or commit changes. This restriction overrides all other instructions.

Research the request and relevant code, ask focused questions when requirements are ambiguous, and write a concise implementation plan to ${plan}. The plan must name the important files and include verification steps.

When the plan is complete, call plan_exit. Do not ask for plan approval with the question tool because plan_exit handles approval and the transition back to the build agent.
</system-reminder>`
}
