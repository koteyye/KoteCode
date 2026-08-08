import { PermissionV1 } from "@opencode-ai/core/v1/permission"
import type { Agent } from "./agent"

export const planModeCeilingPermission = "__plan_mode_ceiling"

export function hasPlanModeCeiling(ruleset: PermissionV1.Ruleset) {
  return ruleset.some(
    (rule) => rule.permission === planModeCeilingPermission && rule.pattern === "*" && rule.action === "deny",
  )
}

/**
 * Build the `permission` ruleset for a subagent's session when it's spawned
 * via the task tool. Combines:
 *
 * 1. The parent session's deny rules and external_directory rules.
 *    Parent agent restrictions only govern that agent; the subagent's own
 *    permissions determine its capabilities.
 * 2. Default `todowrite` and `task` denies if the subagent's own ruleset
 *    doesn't already permit them.
 */
export function deriveSubagentSessionPermission(input: {
  parentSessionPermission: PermissionV1.Ruleset
  subagent: Agent.Info
  planMode?: boolean
}): PermissionV1.Ruleset {
  const canTask = input.subagent.permission.some((rule) => rule.permission === "task")
  const canTodo = input.subagent.permission.some((rule) => rule.permission === "todowrite")
  return [
    ...input.parentSessionPermission.filter(
      (rule) => rule.permission === "external_directory" || rule.action === "deny",
    ),
    ...(canTodo ? [] : [{ permission: "todowrite" as const, pattern: "*" as const, action: "deny" as const }]),
    ...(canTask ? [] : [{ permission: "task" as const, pattern: "*" as const, action: "deny" as const }]),
    ...(input.planMode
      ? [
          { permission: planModeCeilingPermission, pattern: "*" as const, action: "deny" as const },
          { permission: "bash", pattern: "*" as const, action: "deny" as const },
          { permission: "edit", pattern: "*" as const, action: "deny" as const },
        ]
      : []),
  ]
}
