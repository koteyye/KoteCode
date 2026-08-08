import { describe, expect } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Effect, Fiber, Queue } from "effect"
import { Agent } from "@/agent/agent"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Provider } from "@/provider/provider"
import { Question } from "@/question"
import { MessageID, SessionID } from "@/session/schema"
import { Session } from "@/session/session"
import { Truncate } from "@/tool/truncate"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { PlanEnterTool, PlanExitTool } from "../../src/tool/plan"
import { ProviderTest } from "../fake/provider"
import { testEffect } from "../lib/effect"

const provider = ProviderTest.fake()
const it = testEffect(
  LayerNode.compile(
    LayerNode.group([
      Agent.node,
      EventV2Bridge.node,
      Provider.node,
      Question.node,
      Session.node,
      SessionProjector.node,
      Truncate.node,
    ]),
    [[Provider.node, provider.layer]],
  ),
)

const pending = Effect.fn("PlanToolTest.pending")(function* (question: Question.Interface) {
  const events = yield* EventV2Bridge.Service
  const asked = yield* Queue.unbounded<void>()
  const off = yield* events.listen((event) => {
    if (event.type === Question.Event.Asked.type) Queue.offerUnsafe(asked, undefined)
    return Effect.void
  })
  yield* Effect.addFinalizer(() => off)

  for (;;) {
    const request = (yield* question.list())[0]
    if (request) return request
    yield* Queue.take(asked).pipe(Effect.timeout("2 seconds"))
  }
})

const context = (sessionID: SessionID, agent: string) => ({
  sessionID,
  messageID: MessageID.ascending(),
  callID: "plan-transition",
  agent,
  abort: AbortSignal.any([]),
  messages: [] as SessionV1.WithParts[],
  metadata: () => Effect.void,
  ask: () => Effect.void,
})

describe("tool.plan", () => {
  it.instance("preserves prompt tool overrides across plan transitions", () =>
    Effect.gen(function* () {
      const question = yield* Question.Service
      const session = yield* Session.Service
      const info = yield* session.create({ title: "plan tools" })
      const tools = { plan_enter: false, custom_tool: true }
      yield* session.updateMessage({
        id: MessageID.ascending(),
        sessionID: info.id,
        role: "user",
        time: { created: Date.now() },
        agent: "build",
        model: {
          providerID: provider.model.providerID,
          modelID: provider.model.id,
          variant: "high",
        },
        tools,
      })

      const enterInfo = yield* PlanEnterTool
      const enter = yield* enterInfo.init()
      const enterFiber = yield* enter.execute({}, context(info.id, "build")).pipe(Effect.forkScoped)
      const enterRequest = yield* pending(question)
      yield* question.reply({ requestID: enterRequest.id, answers: [["Yes"]] })
      yield* Fiber.join(enterFiber)

      const exitInfo = yield* PlanExitTool
      const exit = yield* exitInfo.init()
      const exitFiber = yield* exit.execute({}, context(info.id, "plan")).pipe(Effect.forkScoped)
      const exitRequest = yield* pending(question)
      yield* question.reply({ requestID: exitRequest.id, answers: [["Yes"]] })
      yield* Fiber.join(exitFiber)

      const users = (yield* session.messages({ sessionID: info.id }))
        .map((message) => message.info)
        .filter((message): message is SessionV1.User => message.role === "user")
      expect(users.slice(-2)).toMatchObject([
        { agent: "plan", model: { variant: "high" }, tools },
        { agent: "build", model: { variant: "high" }, tools },
      ])
    }),
  )
})
