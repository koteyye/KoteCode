import { Location } from "@opencode-ai/core/location"
import { Project } from "@opencode-ai/core/project"
import { ProjectNotFoundError } from "@opencode-ai/protocol/errors"
import { Effect } from "effect"
import { EventV2 } from "@opencode-ai/core/event"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"

export const ProjectHandler = HttpApiBuilder.group(Api, "server.project", (handlers) =>
  Effect.gen(function* () {
    const project = yield* Project.Service
    const events = yield* EventV2.Service

    return handlers
      .handle("project.list", () => project.list())
      .handle("project.update", (ctx) =>
        Effect.gen(function* () {
          const info = yield* project.update(ctx.params.projectID, ctx.payload).pipe(
            Effect.catchTag(
              "Project.NotFoundError",
              () =>
                new ProjectNotFoundError({
                  projectID: ctx.params.projectID,
                  message: `Project not found: ${ctx.params.projectID}`,
                }),
            ),
          )
          yield* events.publish(Project.Event.Updated, info)
          return info
        }),
      )
      .handle("project.current", () =>
        Effect.gen(function* () {
          const location = yield* Location.Service
          const opened = yield* project.open(location.directory)
          const info = (yield* project.list()).find((item) => item.id === opened.id)
          if (info) yield* events.publish(Project.Event.Updated, info)
          return { id: opened.id, directory: opened.directory }
        }),
      )
      .handle("project.directories", (ctx) => project.directories({ projectID: ctx.params.projectID }))
      .handle("project.repositories", () =>
        Effect.gen(function* () {
          const location = yield* Location.Service
          return yield* project.repositories(location.directory)
        }),
      )
  }),
)
