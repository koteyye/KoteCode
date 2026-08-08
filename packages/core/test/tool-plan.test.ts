import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Deferred, Effect, Fiber, Layer } from "effect"
import { AgentV2 } from "@opencode-ai/core/agent"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2 } from "@opencode-ai/core/event"
import { Location } from "@opencode-ai/core/location"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { Project } from "@opencode-ai/core/project"
import { ProjectTable } from "@opencode-ai/core/project/sql"
import { QuestionV2 } from "@opencode-ai/core/question"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { SessionTable } from "@opencode-ai/core/session/sql"
import { SessionStore } from "@opencode-ai/core/session/store"
import { PlanTool } from "@opencode-ai/core/tool/plan"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { ToolOutputStore } from "@opencode-ai/core/tool-output-store"
import { testEffect } from "./lib/effect"
import { tmpdir } from "./fixture/tmpdir"
import { settleTool, toolDefinitions, toolIdentity } from "./lib/tool"

const sessionID = SessionV2.ID.make("ses_plan_tool_test")
const assertions: PermissionV2.AssertInput[] = []
const questions: QuestionV2.AskInput[] = []
let answer = "Yes"
let questionReady: Deferred.Deferred<void> | undefined
let questionRelease: Deferred.Deferred<void> | undefined

const permission = Layer.mock(PermissionV2.Service, {
  assert: (input) => Effect.sync(() => assertions.push(input)),
})
const question = Layer.mock(QuestionV2.Service, {
  ask: (input) =>
    Effect.gen(function* () {
      questions.push(input)
      if (questionReady) yield* Deferred.succeed(questionReady, undefined)
      if (questionRelease) yield* Deferred.await(questionRelease)
      return [[answer]]
    }),
})
const location = Layer.unwrap(
  Effect.acquireRelease(
    Effect.promise(() => tmpdir()),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  ).pipe(
    Effect.map((tmp) => {
      const directory = AbsolutePath.make(tmp.path)
      return Layer.succeed(
        Location.Service,
        Location.Service.of({
          directory,
          project: { id: Project.ID.global, directory },
          vcs: { type: "git", store: AbsolutePath.make(path.join(tmp.path, ".git")) },
        }),
      )
    }),
  ),
)
const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([
      AgentV2.node,
      Database.node,
      EventV2.node,
      Location.node,
      SessionProjector.node,
      SessionStore.node,
      ToolRegistry.node,
      ToolRegistry.toolsNode,
      PlanTool.node,
    ]),
    [
      [PermissionV2.node, permission],
      [QuestionV2.node, question],
      [Location.node, location],
      [ToolOutputStore.node, ToolOutputStore.nodeWithoutConfig],
    ],
  ),
)

const setup = Effect.gen(function* () {
  assertions.length = 0
  questions.length = 0
  answer = "Yes"
  questionReady = undefined
  questionRelease = undefined
  const { db } = yield* Database.Service
  const agents = yield* AgentV2.Service
  const location = yield* Location.Service
  yield* agents.transform((draft) => {
    draft.update(AgentV2.ID.make("build"), (agent) => {
      agent.mode = "primary"
    })
    draft.update(AgentV2.ID.make("plan"), (agent) => {
      agent.mode = "primary"
    })
  })
  yield* db
    .insert(ProjectTable)
    .values({ id: Project.ID.global, worktree: location.project.directory, sandboxes: [] })
    .run()
    .pipe(Effect.orDie)
  yield* db
    .insert(SessionTable)
    .values({
      id: sessionID,
      project_id: Project.ID.global,
      slug: "plan",
      directory: location.directory,
      title: "plan",
      version: "test",
    })
    .run()
    .pipe(Effect.orDie)
})

const call = (name: string) => ({
  sessionID,
  ...toolIdentity,
  call: { type: "tool-call" as const, id: `call-${name}`, name, input: {} },
})

describe("PlanTool", () => {
  it.effect("registers both transitions and switches the durable session agent", () =>
    Effect.gen(function* () {
      yield* setup
      const registry = yield* ToolRegistry.Service
      const location = yield* Location.Service
      const sessions = yield* SessionStore.Service

      expect((yield* toolDefinitions(registry)).map((tool) => tool.name)).toEqual([
        PlanTool.enterName,
        PlanTool.exitName,
      ])

      expect((yield* settleTool(registry, call(PlanTool.enterName))).output?.structured).toMatchObject({
        agent: AgentV2.ID.make("plan"),
      })
      expect((yield* sessions.get(sessionID))?.agent).toBe(AgentV2.ID.make("plan"))

      expect((yield* settleTool(registry, call(PlanTool.exitName))).output?.structured).toMatchObject({
        agent: AgentV2.ID.make("build"),
      })
      expect((yield* sessions.get(sessionID))?.agent).toBe(AgentV2.ID.make("build"))
      expect(assertions.map((item) => item.action)).toEqual([PlanTool.enterName, PlanTool.exitName])
      expect(questions).toHaveLength(2)
      expect(
        yield* Effect.promise(() =>
          fs.stat(path.join(location.project.directory, ".opencode", "plans")).then((info) => info.isDirectory()),
        ),
      ).toBe(true)
    }),
  )

  it.effect("keeps the current agent when the user declines a transition", () =>
    Effect.gen(function* () {
      yield* setup
      const registry = yield* ToolRegistry.Service
      const sessions = yield* SessionStore.Service
      answer = "No"

      expect((yield* settleTool(registry, call(PlanTool.enterName))).output?.structured).toMatchObject({
        agent: AgentV2.ID.make("build"),
      })
      expect((yield* sessions.get(sessionID))?.agent).toBeUndefined()
    }),
  )

  it.effect("does not prompt when the target agent is unavailable", () =>
    Effect.gen(function* () {
      yield* setup
      const agents = yield* AgentV2.Service
      const registry = yield* ToolRegistry.Service
      yield* agents.transform((draft) => draft.remove(AgentV2.ID.make("plan")))

      expect((yield* settleTool(registry, call(PlanTool.enterName))).result).toEqual({
        type: "error",
        value: "Agent is unavailable: plan",
      })
      expect(questions).toEqual([])
    }),
  )

  it.effect("revalidates the target agent after approval", () =>
    Effect.gen(function* () {
      yield* setup
      const agents = yield* AgentV2.Service
      const registry = yield* ToolRegistry.Service
      const sessions = yield* SessionStore.Service
      questionReady = yield* Deferred.make<void>()
      questionRelease = yield* Deferred.make<void>()
      const settlement = yield* settleTool(registry, call(PlanTool.enterName)).pipe(Effect.forkChild)
      yield* Deferred.await(questionReady)
      yield* agents.transform((draft) => draft.remove(AgentV2.ID.make("plan")))
      yield* Deferred.succeed(questionRelease, undefined)

      expect((yield* Fiber.join(settlement)).result).toEqual({
        type: "error",
        value: "Agent is unavailable: plan",
      })
      expect((yield* sessions.get(sessionID))?.agent).toBeUndefined()
      expect(questions).toHaveLength(1)
    }),
  )
})
