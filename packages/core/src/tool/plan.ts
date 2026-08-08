export * as PlanTool from "./plan"

import path from "path"
import { ToolFailure } from "@opencode-ai/llm"
import { DateTime, Effect, Layer, Schema } from "effect"
import { AgentV2 } from "../agent"
import { EventV2 } from "../event"
import { makeLocationNode } from "../effect/app-node"
import { FSUtil } from "../fs-util"
import { Location } from "../location"
import { PermissionV2 } from "../permission"
import { QuestionV2 } from "../question"
import { SessionEvent } from "../session/event"
import { SessionMessage } from "../session/message"
import { SessionPlan } from "../session/plan"
import { SessionStore } from "../session/store"
import { ToolRegistry } from "./registry"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const enterName = "plan_enter"
export const exitName = "plan_exit"

export const EnterDescription = `Use this tool to suggest switching to the plan agent when the user's request would benefit from planning before implementation.

Call this tool when the request is complex, involves multiple files or architectural decisions, or the user explicitly asks for a plan. Call it by itself before any implementation tools; do not emit sibling tool calls in the same response. Do not call it for simple tasks or when the user explicitly requests immediate implementation.`

export const ExitDescription = `Use this tool after you have completed the planning phase and are ready to request approval to implement the plan. Call it by itself; do not emit sibling tool calls in the same response. Do not call it while questions remain unanswered or the plan is incomplete.`

const Input = Schema.Struct({})
const Output = Schema.Struct({
  agent: AgentV2.ID,
  plan: Schema.String,
  message: Schema.String,
})

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const agents = yield* AgentV2.Service
    const permission = yield* PermissionV2.Service
    const question = yield* QuestionV2.Service
    const events = yield* EventV2.Service
    const fs = yield* FSUtil.Service
    const sessions = yield* SessionStore.Service
    const location = yield* Location.Service

    const requireAgent = Effect.fn("PlanTool.requireAgent")(function* (agent: AgentV2.ID) {
      const target = yield* agents.get(agent)
      if (!target || target.mode === "subagent" || target.hidden) {
        return yield* new ToolFailure({ message: `Agent is unavailable: ${agent}` })
      }
      return target
    })

    const switchAgent = Effect.fn("PlanTool.switchAgent")(function* (sessionID, agent: AgentV2.ID) {
      yield* requireAgent(agent)
      const session = yield* sessions.get(sessionID)
      if (!session) return yield* new ToolFailure({ message: `Session not found: ${sessionID}` })
      if (session.agent === agent) return session
      yield* events.publish(SessionEvent.AgentSwitched, {
        sessionID,
        messageID: SessionMessage.ID.create(),
        timestamp: yield* DateTime.now,
        agent,
      })
      return { ...session, agent }
    })

    const assert = (action: string, context: Tool.Context) =>
      permission
        .assert({
          action,
          resources: ["*"],
          sessionID: context.sessionID,
          agent: context.agent,
          source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
        })
        .pipe(Effect.mapError(() => new ToolFailure({ message: `Permission denied: ${action}` })))

    const ask = (context: Tool.Context, prompt: QuestionV2.Info) =>
      question
        .ask({
          sessionID: context.sessionID,
          questions: [prompt],
          tool: { messageID: context.assistantMessageID, callID: context.toolCallID },
        })
        .pipe(Effect.orDie)

    yield* tools
      .register({
        [enterName]: Tool.make({
          description: EnterDescription,
          input: Input,
          output: Output,
          toModelOutput: ({ output }) => [{ type: "text", text: output.message }],
          execute: (_input, context) =>
            Effect.gen(function* () {
              yield* assert(enterName, context)
              yield* requireAgent(AgentV2.ID.make("plan"))
              const session = yield* sessions.get(context.sessionID)
              if (!session) return yield* new ToolFailure({ message: `Session not found: ${context.sessionID}` })
              const plan = SessionPlan.file(session, location)
              const answers = yield* ask(context, {
                question: `Would you like to switch to the plan agent and create a plan at ${path.relative(location.directory, plan)}?`,
                header: "Plan Mode",
                custom: false,
                options: [
                  { label: "Yes", description: "Research the task and prepare an implementation plan" },
                  { label: "No", description: "Stay with the build agent and implement immediately" },
                ],
              })
              if (answers[0]?.[0] !== "Yes") {
                return {
                  agent: context.agent,
                  plan,
                  message: "The user declined plan mode. Stay with the build agent and implement the request.",
                }
              }
              yield* fs
                .ensureDir(path.dirname(plan))
                .pipe(Effect.mapError(() => new ToolFailure({ message: `Unable to create plan directory: ${plan}` })))
              yield* switchAgent(context.sessionID, AgentV2.ID.make("plan"))
              return {
                agent: AgentV2.ID.make("plan"),
                plan,
                message: `The user approved plan mode. Research the task and write the plan to ${plan}.`,
              }
            }),
        }),
        [exitName]: Tool.make({
          description: ExitDescription,
          input: Input,
          output: Output,
          toModelOutput: ({ output }) => [{ type: "text", text: output.message }],
          execute: (_input, context) =>
            Effect.gen(function* () {
              yield* assert(exitName, context)
              yield* requireAgent(AgentV2.ID.make("build"))
              const session = yield* sessions.get(context.sessionID)
              if (!session) return yield* new ToolFailure({ message: `Session not found: ${context.sessionID}` })
              const plan = SessionPlan.file(session, location)
              const answers = yield* ask(context, {
                question: `The plan at ${path.relative(location.directory, plan)} is complete. Would you like to switch to the build agent and start implementing it?`,
                header: "Build Agent",
                custom: false,
                options: [
                  { label: "Yes", description: "Approve the plan and start implementation" },
                  { label: "No", description: "Stay with the plan agent and continue refining it" },
                ],
              })
              if (answers[0]?.[0] !== "Yes") {
                return {
                  agent: context.agent,
                  plan,
                  message: "The user declined implementation. Stay with the plan agent and continue refining the plan.",
                }
              }
              yield* switchAgent(context.sessionID, AgentV2.ID.make("build"))
              return {
                agent: AgentV2.ID.make("build"),
                plan,
                message: `The user approved the plan at ${plan}. Switch to implementation and execute it.`,
              }
            }),
        }),
      })
      .pipe(Effect.orDie)
  }),
)

export const node = makeLocationNode({
  name: "tool/plan",
  layer,
  deps: [
    AgentV2.node,
    ToolRegistry.node,
    PermissionV2.node,
    QuestionV2.node,
    EventV2.node,
    FSUtil.node,
    SessionStore.node,
    Location.node,
  ],
})
