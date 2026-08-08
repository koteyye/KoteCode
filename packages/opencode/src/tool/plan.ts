import path from "path"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { Agent } from "../agent/agent"
import { Question } from "../question"
import { Session } from "@/session/session"
import { MessageV2 } from "../session/message-v2"
import { Provider } from "@/provider/provider"
import { InstanceState } from "@/effect/instance-state"
import { MessageID, PartID } from "../session/schema"
import EXIT_DESCRIPTION from "./plan-exit.txt"
import ENTER_DESCRIPTION from "./plan-enter.txt"

export const Parameters = Schema.Struct({})

export const PlanExitTool = Tool.define(
  "plan_exit",
  Effect.gen(function* () {
    const session = yield* Session.Service
    const agents = yield* Agent.Service
    const question = yield* Question.Service
    const provider = yield* Provider.Service

    return {
      description: EXIT_DESCRIPTION,
      parameters: Parameters,
      execute: (_params: {}, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const target = yield* agents.get("build")
          if (!target || target.mode === "subagent" || target.hidden) throw new Error('Agent not found: "build"')
          const info = yield* session.get(ctx.sessionID)
          const plan = path.relative(instance.worktree, Session.plan(info, instance))
          const answers = yield* question.ask({
            sessionID: ctx.sessionID,
            questions: [
              {
                question: `Plan at ${plan} is complete. Would you like to switch to the build agent and start implementing?`,
                header: "Build Agent",
                custom: false,
                options: [
                  { label: "Yes", description: "Switch to build agent and start implementing the plan" },
                  { label: "No", description: "Stay with plan agent to continue refining the plan" },
                ],
              },
            ],
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })

          if (answers[0]?.[0] !== "Yes") {
            return {
              title: "Continuing plan",
              output: "The user declined implementation. Continue refining the plan.",
              metadata: {},
            }
          }

          const messages = yield* session.messages({ sessionID: ctx.sessionID }).pipe(Effect.orDie)
          const lastUser = messages.findLast((item) => item.info.role === "user" && item.info.model)
          const model =
            lastUser?.info.role === "user" && lastUser.info.model ? lastUser.info.model : yield* provider.defaultModel()
          const created = Date.now()

          const msg: SessionV1.User = {
            id: MessageID.ascending(),
            sessionID: ctx.sessionID,
            role: "user",
            time: { created },
            agent: "build",
            model,
            tools: lastUser?.info.role === "user" ? lastUser.info.tools : undefined,
          }
          const approvedTarget = yield* agents.get("build")
          if (!approvedTarget || approvedTarget.mode === "subagent" || approvedTarget.hidden)
            throw new Error('Agent not found: "build"')
          yield* session.transitionAgent({
            message: msg,
            part: {
              id: PartID.ascending(),
              messageID: msg.id,
              sessionID: ctx.sessionID,
              type: "text",
              text: `The plan at ${plan} has been approved, you can now edit files. Execute the plan`,
              synthetic: true,
            },
          })

          return {
            title: "Switching to build agent",
            output: "User approved switching to build agent. Wait for further instructions.",
            metadata: {},
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export const PlanEnterTool = Tool.define(
  "plan_enter",
  Effect.gen(function* () {
    const session = yield* Session.Service
    const agents = yield* Agent.Service
    const question = yield* Question.Service
    const provider = yield* Provider.Service

    return {
      description: ENTER_DESCRIPTION,
      parameters: Parameters,
      execute: (_params: {}, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const target = yield* agents.get("plan")
          if (!target || target.mode === "subagent" || target.hidden) throw new Error('Agent not found: "plan"')
          const info = yield* session.get(ctx.sessionID)
          const plan = path.relative(instance.worktree, Session.plan(info, instance))
          const answers = yield* question.ask({
            sessionID: ctx.sessionID,
            questions: [
              {
                question: `Would you like to switch to the plan agent and create a plan saved to ${plan}?`,
                header: "Plan Mode",
                custom: false,
                options: [
                  { label: "Yes", description: "Switch to the plan agent for research and planning" },
                  { label: "No", description: "Stay with the build agent and implement immediately" },
                ],
              },
            ],
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })

          if (answers[0]?.[0] !== "Yes") {
            return {
              title: "Continuing implementation",
              output: "The user declined plan mode. Continue implementing with the build agent.",
              metadata: {},
            }
          }

          const messages = yield* session.messages({ sessionID: ctx.sessionID }).pipe(Effect.orDie)
          const lastUser = messages.findLast((item) => item.info.role === "user" && item.info.model)
          const model =
            lastUser?.info.role === "user" && lastUser.info.model ? lastUser.info.model : yield* provider.defaultModel()
          const created = Date.now()

          const msg: SessionV1.User = {
            id: MessageID.ascending(),
            sessionID: ctx.sessionID,
            role: "user",
            time: { created },
            agent: "plan",
            model,
            tools: lastUser?.info.role === "user" ? lastUser.info.tools : undefined,
          }
          const approvedTarget = yield* agents.get("plan")
          if (!approvedTarget || approvedTarget.mode === "subagent" || approvedTarget.hidden)
            throw new Error('Agent not found: "plan"')
          yield* session.transitionAgent({
            message: msg,
            part: {
              id: PartID.ascending(),
              messageID: msg.id,
              sessionID: ctx.sessionID,
              type: "text",
              text: `The user approved plan mode. Research the task and write the plan to ${plan}.`,
              synthetic: true,
            },
          })

          return {
            title: "Switching to plan agent",
            output: `The user approved plan mode. Continue with the plan agent and save the plan to ${plan}.`,
            metadata: {},
          }
        }).pipe(Effect.orDie),
    }
  }),
)
