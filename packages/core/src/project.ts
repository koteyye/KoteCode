export * as ProjectV2 from "./project"
export * as Project from "./project"

import { Context, Effect, Layer, Schema } from "effect"
import { and, asc, desc, eq, sql } from "drizzle-orm"
import path from "path"
import { AbsolutePath } from "./schema"
import { FSUtil } from "./fs-util"
import { Git } from "./git"
import { makeGlobalNode } from "./effect/app-node"
import { Hash } from "./util/hash"
import { Ignore } from "./filesystem/ignore"
import { ProjectDirectories } from "./project/directories"
import { ProjectSchema } from "./project/schema"
import { Database } from "./database/database"
import { ProjectDirectoryTable, ProjectTable } from "./project/sql"
import { SessionTable } from "./session/sql"
import { WorkspaceTable } from "./control-plane/workspace.sql"
import { PermissionTable } from "./permission/sql"

export const ID = ProjectSchema.ID
export type ID = ProjectSchema.ID

export const Vcs = ProjectSchema.Vcs
export type Vcs = ProjectSchema.Vcs

export const Current = ProjectSchema.Current
export type Current = ProjectSchema.Current

export const Directory = ProjectSchema.Directory
export type Directory = ProjectSchema.Directory

export const Info = ProjectSchema.Info
export interface Info extends Schema.Schema.Type<typeof Info> {}

export const DirectoriesInput = ProjectDirectories.ListInput
export type DirectoriesInput = typeof DirectoriesInput.Type

export const Directories = ProjectDirectories.ListOutput
export type Directories = typeof Directories.Type

export const Repository = ProjectSchema.Repository
export type Repository = ProjectSchema.Repository

export const Repositories = ProjectSchema.Repositories
export type Repositories = ProjectSchema.Repositories

export const UpdateInput = ProjectSchema.UpdateInput
export type UpdateInput = ProjectSchema.UpdateInput

export const Event = ProjectSchema.Event

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("Project.NotFoundError", {
  projectID: ID,
}) {}

export interface Resolved {
  readonly previous?: ID
  readonly id: ID
  readonly directory: AbsolutePath
  readonly vcs?: Vcs
}

export interface Interface {
  readonly list: () => Effect.Effect<ReadonlyArray<Info>>
  readonly directories: (input: DirectoriesInput) => Effect.Effect<Directories>
  readonly repositories: (directory: AbsolutePath) => Effect.Effect<Repositories>
  readonly update: (projectID: ID, input: UpdateInput) => Effect.Effect<Info, NotFoundError>
  readonly resolve: (input: AbsolutePath) => Effect.Effect<Resolved>
  readonly open: (input: AbsolutePath) => Effect.Effect<Resolved>
  /**
   * Temporary bridge method for writing the resolved project ID to the repo-local cache.
   *
   * This exists while the old opencode project service and this core project
   * service work together: core resolves the ID, while the old service still owns
   * database migration and persistence. The old service should call this after it
   * finishes migrating from `resolve().previous` to `resolve().id`; once project
   * persistence moves into core, this separate bridge method can go away.
   */
  readonly commit: (input: { store: AbsolutePath; id: ID }) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ProjectV2") {}

function fromRow(row: typeof ProjectTable.$inferSelect): Info {
  const icon =
    row.icon_url || row.icon_url_override || row.icon_color
      ? {
          url: row.icon_url ?? undefined,
          override: row.icon_url_override ?? undefined,
          color: row.icon_color ?? undefined,
        }
      : undefined
  return {
    id: row.id,
    worktree: row.worktree,
    vcs: row.vcs ? Schema.decodeUnknownSync(ProjectSchema.Info.fields.vcs)(row.vcs) : undefined,
    name: row.name ?? undefined,
    icon,
    commands: row.commands ?? undefined,
    time: {
      created: row.time_created,
      updated: row.time_updated,
      initialized: row.time_initialized ?? undefined,
    },
    sandboxes: row.sandboxes,
  }
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const git = yield* Git.Service
    const db = (yield* Database.Service).db
    const projectDirectories = yield* ProjectDirectories.Service

    const list = Effect.fn("Project.list")(function* () {
      const rows = yield* db
        .select()
        .from(ProjectTable)
        .orderBy(desc(ProjectTable.time_updated), asc(ProjectTable.id))
        .all()
        .pipe(Effect.orDie)
      return rows.map(fromRow)
    })

    const directories = Effect.fn("Project.directories")(function* (input: DirectoriesInput) {
      return yield* projectDirectories.list(input.projectID)
    })

    const cached = Effect.fnUntraced(function* (dir: string) {
      return yield* fs.readFileString(path.join(dir, "opencode")).pipe(
        Effect.map((value) => value.trim()),
        Effect.map((value) => (value ? ID.make(value) : undefined)),
        Effect.catch(() => Effect.succeed(undefined)),
      )
    })

    const remote = Effect.fnUntraced(function* (repo: Git.Repository) {
      const origin = yield* git.remote.get(repo)
      if (!origin) return undefined
      const normalized = url(origin)
      if (!normalized) return undefined
      return ID.make(Hash.fast(`git-remote:${normalized}`))
    })

    function url(input: string) {
      const value = input.trim()
      if (!value) return undefined

      try {
        const parsed = new URL(value)
        if (parsed.protocol === "file:") return undefined
        return parts(parsed.hostname, parsed.pathname)
      } catch {
        const scp = value.match(/^([^@/:]+@)?([^/:]+):(.+)$/)
        if (scp) return parts(scp[2], scp[3])
        return undefined
      }
    }

    function parts(host: string, name: string) {
      const pathname = name
        .replace(/^\/+/, "")
        .replace(/\.git\/?$/, "")
        .replace(/\/+$/, "")
      if (!host || !pathname) return undefined
      return `${host.toLowerCase()}/${pathname}`
    }

    const root = Effect.fnUntraced(function* (repo: Git.Repository) {
      const root = (yield* git.history.rootCommits(repo))[0]
      return root ? ID.make(root) : undefined
    })

    const resolve = Effect.fn("Project.resolve")(function* (input: AbsolutePath) {
      const repo = yield* git.repo.discover(input)
      if (!repo) return { id: ID.global, directory: AbsolutePath.make(path.parse(input).root), vcs: undefined }

      const previous = yield* cached(repo.commonDirectory)
      const id = (yield* remote(repo)) ?? previous ?? (yield* root(repo))
      return {
        previous,
        id: id ?? ID.global,
        directory: repo.worktree,
        vcs: { type: "git" as const, store: repo.commonDirectory },
      }
    })

    const open = Effect.fn("Project.open")(function* (input: AbsolutePath) {
      const project = yield* resolve(input)
      const now = Date.now()
      yield* db
        .transaction(
          (tx) =>
            Effect.gen(function* () {
              if (project.previous && project.previous !== ID.global && project.previous !== project.id) {
                const previous = yield* tx
                  .select()
                  .from(ProjectTable)
                  .where(eq(ProjectTable.id, project.previous))
                  .get()
                const canonical = yield* tx.select().from(ProjectTable).where(eq(ProjectTable.id, project.id)).get()
                if (previous && !canonical) {
                  yield* tx
                    .insert(ProjectTable)
                    .values({ ...previous, id: project.id, time_updated: now })
                    .run()
                }
                yield* tx
                  .delete(ProjectDirectoryTable)
                  .where(eq(ProjectDirectoryTable.project_id, project.previous))
                  .run()
                yield* tx
                  .update(SessionTable)
                  .set({ project_id: project.id, time_updated: sql`${SessionTable.time_updated}` })
                  .where(eq(SessionTable.project_id, project.previous))
                  .run()
                yield* tx
                  .update(WorkspaceTable)
                  .set({ project_id: project.id })
                  .where(eq(WorkspaceTable.project_id, project.previous))
                  .run()
                const permissions = yield* tx
                  .select()
                  .from(PermissionTable)
                  .where(eq(PermissionTable.project_id, project.previous))
                  .all()
                yield* Effect.forEach(
                  permissions,
                  (permission) =>
                    Effect.gen(function* () {
                      const duplicate = yield* tx
                        .select({ id: PermissionTable.id })
                        .from(PermissionTable)
                        .where(
                          and(
                            eq(PermissionTable.project_id, project.id),
                            eq(PermissionTable.action, permission.action),
                            eq(PermissionTable.resource, permission.resource),
                          ),
                        )
                        .get()
                      if (duplicate) {
                        yield* tx.delete(PermissionTable).where(eq(PermissionTable.id, permission.id)).run()
                        return
                      }
                      yield* tx
                        .update(PermissionTable)
                        .set({
                          project_id: project.id,
                          time_updated: sql`${PermissionTable.time_updated}`,
                        })
                        .where(eq(PermissionTable.id, permission.id))
                        .run()
                    }),
                  { discard: true },
                )
                if (previous) yield* tx.delete(ProjectTable).where(eq(ProjectTable.id, project.previous)).run()
              }

              const existing = yield* tx.select().from(ProjectTable).where(eq(ProjectTable.id, project.id)).get()
              const worktree = existing?.worktree ?? project.directory
              const sandboxes =
                project.id !== ID.global &&
                path.relative(path.resolve(worktree), path.resolve(project.directory)) !== "" &&
                !existing?.sandboxes.some(
                  (directory) => path.relative(path.resolve(directory), path.resolve(project.directory)) === "",
                )
                  ? [...(existing?.sandboxes ?? []), project.directory]
                  : (existing?.sandboxes ?? [])
              const saved = yield* tx
                .insert(ProjectTable)
                .values({
                  id: project.id,
                  worktree,
                  vcs: project.vcs?.type ?? existing?.vcs ?? null,
                  name: existing?.name,
                  icon_url: existing?.icon_url,
                  icon_url_override: existing?.icon_url_override,
                  icon_color: existing?.icon_color,
                  commands: existing?.commands,
                  time_created: existing?.time_created ?? now,
                  time_updated: now,
                  time_initialized: existing?.time_initialized,
                  sandboxes,
                })
                .onConflictDoUpdate({
                  target: ProjectTable.id,
                  set: {
                    vcs: project.vcs?.type ?? existing?.vcs ?? null,
                    time_updated: now,
                    sandboxes,
                  },
                })
                .returning()
                .get()

              if (project.id === ID.global) return saved
              yield* tx
                .insert(ProjectDirectoryTable)
                .values({ project_id: project.id, directory: project.directory })
                .onConflictDoNothing()
                .run()
              yield* tx
                .update(SessionTable)
                .set({ project_id: project.id })
                .where(and(eq(SessionTable.project_id, ID.global), eq(SessionTable.directory, project.directory)))
                .run()
              return saved
            }),
          { behavior: "immediate" },
        )
        .pipe(Effect.orDie)
      if (project.id !== ID.global && project.vcs?.type === "git") {
        yield* commit({ store: project.vcs.store, id: project.id })
      }
      return project
    })

    const repositories = Effect.fn("Project.repositories")(function* (directory: AbsolutePath) {
      if (yield* git.repo.discover(directory)) return []
      const entries = yield* fs.readDirectoryEntries(directory).pipe(Effect.orDie)
      const found = yield* Effect.forEach(
        entries.filter(
          (entry) =>
            (entry.type === "directory" || entry.type === "symlink") && !Ignore.match(entry.name),
        ),
        Effect.fnUntraced(function* (entry) {
          const candidate = AbsolutePath.make(path.join(directory, entry.name))
          const repository = yield* git.repo.discover(candidate)
          if (!repository || path.relative(path.resolve(candidate), path.resolve(repository.worktree)) !== "") return
          const project = yield* resolve(repository.worktree)
          return { id: project.id, directory: repository.worktree } satisfies Repository
        }),
        { concurrency: 8 },
      )
      return found
        .filter((repository): repository is Repository => repository !== undefined)
        .toSorted((a, b) => a.directory.localeCompare(b.directory))
    })

    const update = Effect.fn("Project.update")(function* (projectID: ID, input: UpdateInput) {
      const row = yield* db
        .update(ProjectTable)
        .set({
          name: input.name,
          icon_url: input.icon?.url,
          icon_url_override: input.icon?.override,
          icon_color: input.icon?.color,
          commands: input.commands,
          time_updated: Date.now(),
        })
        .where(eq(ProjectTable.id, projectID))
        .returning()
        .get()
        .pipe(Effect.orDie)
      if (!row) return yield* new NotFoundError({ projectID })
      return fromRow(row)
    })

    const commit = Effect.fn("Project.commit")(function* (input: { store: AbsolutePath; id: ID }) {
      yield* fs.writeFileString(path.join(input.store, "opencode"), input.id).pipe(Effect.ignore)
    })

    return Service.of({ list, directories, repositories, update, resolve, open, commit })
  }),
)

export const node = makeGlobalNode({
  service: Service,
  layer: layer,
  deps: [Database.node, FSUtil.node, Git.node, ProjectDirectories.node],
})
