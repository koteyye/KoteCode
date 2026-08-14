import { createSimpleContext } from "@opencode-ai/ui/context"
import { type Accessor, batch, createEffect, createMemo, createRoot, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createServerProjects, ServerConnection, type StoredProject, useServer, visibleRecentlyClosed } from "./server"
import { pathKey } from "@/utils/path-key"
import { type ServerHealth, useServerHealth } from "@/utils/server-health"
import { createServerSdkContext } from "./server-sdk"
import { createServerSyncContext } from "./server-sync"
import { getOwner } from "solid-js/web"
import { QueryClient } from "@tanstack/solid-query"
import type { ServerScope } from "@/utils/server-scope"

export const { use: useGlobal, provider: GlobalProvider } = createSimpleContext({
  name: "Global",
  init: () => {
    const server = useServer()
    const serverHealth = useServerHealth(
      () => server.list,
      () => true,
    )
    const [store, setStore] = createStore({
      settings: {
        serverKey: undefined as ServerConnection.Key | undefined,
      },
    })

    const settingsServer = createMemo(() => {
      const list = server.list
      return list.find((conn) => ServerConnection.key(conn) === store.settings.serverKey) ?? list[0]
    })

    createEffect(() => {
      const conn = settingsServer()
      const key = conn ? ServerConnection.key(conn) : undefined
      if (store.settings.serverKey !== key) setStore("settings", "serverKey", key)
    })

    const serverCtxs = new Map<
      ServerConnection.Key,
      { dispose: () => void; serverCtx: ReturnType<typeof createServerCtx> }
    >()

    const owner = getOwner()

    const ensureServerCtx = (conn: ServerConnection.Any) => {
      const key = ServerConnection.key(conn)
      const existing = serverCtxs.get(key)
      if (existing) return existing.serverCtx
      const root = createRoot((dispose) => {
        const serverCtx = createServerCtx(
          conn,
          server.scope(key),
          server.projects.forServer(key),
          () => serverHealth[key],
        )
        return { dispose, serverCtx }
      }, owner as any)
      serverCtxs.set(key, root)
      return root.serverCtx
    }

    createMemo(() => {
      for (const conn of server.list) {
        ensureServerCtx(conn)
      }
    })

    createEffect(() => {
      for (const [key] of serverCtxs) {
        if (!server.list.find((conn) => ServerConnection.key(conn) === key)) {
          const { dispose } = serverCtxs.get(key)!
          dispose()
          serverCtxs.delete(key)
        }
      }
    })

    return {
      servers: {
        list: () => server.list,
        health: serverHealth,
      },
      settings: {
        server: {
          get key() {
            return store.settings.serverKey
          },
          selected: settingsServer,
          set(key: ServerConnection.Key) {
            if (store.settings.serverKey !== key) setStore("settings", "serverKey", key)
          },
        },
      },
      ensureServerCtx(conn: ServerConnection.Any) {
        return ensureServerCtx(conn)
      },
    }
  },
})

function createServerCtx(
  conn: ServerConnection.Any,
  scope: ServerScope,
  projects: ReturnType<typeof createServerProjects>,
  health: Accessor<ServerHealth | undefined>,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnReconnect: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
    },
  })
  const sdk = createServerSdkContext(conn, scope)
  const sync = createServerSyncContext(sdk)

  function enrich(project: StoredProject) {
    const [childStore] = sync.child(project.worktree, { bootstrap: false })
    const projectID = childStore.project
    const metadata = projectID
      ? sync.data.project.find((x) => x.id === projectID)
      : sync.data.project.find((x) => x.worktree === project.worktree)

    // Preserve local icon override from per-workspace localStorage cache (childStore.icon).
    // Without this, different subdirectories of the same git repo would share the same
    // icon from the database instead of using their individual overrides.
    const base = { ...metadata, ...project }
    if (childStore.icon) {
      return { ...base, icon: { ...base.icon, override: childStore.icon } }
    }
    return base
  }

  const projectsList = createMemo(() => projects.list().map(enrich))
  createRepositoryDiscovery({
    health,
    projects,
    enabled: () => canDiscoverRepositories(conn, sdk.protocolKind()),
    repositories: (directory) => sdk.currentApi.project.repositories({ directory }),
  })
  const recentlyClosedList = createMemo(() =>
    visibleRecentlyClosed({ recentlyClosed: projects.recentlyClosed(), projects: sync.data.project }).map(enrich),
  )

  const isLocal =
    (conn?.type === "sidecar" && conn.variant === "base") || (conn?.type === "http" && isLocalHost(conn.http.url))

  return {
    queryClient,
    sdk,
    sync,
    isLocal,
    projects: {
      ...projects,
      list: projectsList,
      recentlyClosed: recentlyClosedList,
    },
  }
}

export function canDiscoverRepositories(conn: ServerConnection.Any, protocol?: "v1" | "v2") {
  return ServerConnection.builtin(conn) || protocol === "v2"
}

type RepositoryDiscoveryInput = {
  health: Accessor<ServerHealth | undefined>
  enabled?: () => boolean
  projects: Pick<ReturnType<typeof createServerProjects>, "list" | "setRepositories" | "remove" | "open">
  repositories: (directory: string) => Promise<readonly { directory: string }[]>
}

type RepositoryDiscoveryOptions = {
  retryDelayMs?: number
  invalidate?: () => void
}

// Equal health poll results do not invalidate Solid store accessors, so a failed
// repository request needs its own bounded retry trigger.
const REPOSITORY_DISCOVERY_RETRY_MS = 10_000

export function makeRepositoryDiscovery(input: RepositoryDiscoveryInput, options: RepositoryDiscoveryOptions = {}) {
  const attempts = new Map<ReturnType<typeof pathKey>, { project: StoredProject }>()
  // Successfully discovered worktrees. Once repositories have been resolved for a
  // worktree we skip it on subsequent cycles: a successful setRepositories mutates
  // the project object reference, which would otherwise evict the attempt and
  // re-issue the request every cycle, churning the persisted store.
  const done = new Set<ReturnType<typeof pathKey>>()
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  const discover = () => {
    if (disposed) return
    const health = input.health()
    if (input.enabled && !input.enabled()) return
    const list = input.projects.list()
    const active = new Map(list.map((project) => [pathKey(project.worktree), project]))
    for (const [key, attempt] of attempts) {
      if (active.get(key) !== attempt.project) attempts.delete(key)
    }
    // A worktree that is no longer present may legitimately be re-added later
    // (e.g. closed and reopened), so drop its completion marker to allow rediscovery.
    for (const key of done) if (!active.has(key)) done.delete(key)
    if (!health?.healthy) return

    for (const project of list) {
      const key = pathKey(project.worktree)
      if (done.has(key)) continue
      if (attempts.get(key)?.project === project) continue
      const attempt = { project }
      attempts.set(key, attempt)
      void input
        .repositories(project.worktree)
        .then((repositories) => {
          if (disposed) return
          if (attempts.get(key) !== attempt) return
          if (!input.projects.list().some((item) => item === project)) return
          done.add(key)
          const children = repositories.length >= 2 ? repositories.map((repository) => repository.directory) : []
          batch(() => {
            input.projects.setRepositories(project.worktree, children)
            if (children.length >= 2) {
              children.forEach((directory) => input.projects.remove(directory))
              return
            }
            repositories.forEach((repository) => input.projects.open(repository.directory))
          })
        })
        .catch(() => {
          if (disposed) return
          if (attempts.get(key) !== attempt) return
          attempts.delete(key)
          if (retryTimer !== undefined) return
          retryTimer = setTimeout(() => {
            retryTimer = undefined
            if (disposed) return
            ;(options.invalidate ?? discover)()
          }, options.retryDelayMs ?? REPOSITORY_DISCOVERY_RETRY_MS)
        })
    }
  }
  return Object.assign(discover, {
    dispose() {
      disposed = true
      attempts.clear()
      done.clear()
      if (retryTimer !== undefined) clearTimeout(retryTimer)
      retryTimer = undefined
    },
  })
}

export function createRepositoryDiscovery(input: RepositoryDiscoveryInput) {
  const [state, setState] = createStore({ revision: 0 })
  const discover = makeRepositoryDiscovery(input, {
    invalidate: () => setState("revision", (revision) => revision + 1),
  })
  createEffect(() => {
    void state.revision
    discover()
  })
  onCleanup(discover.dispose)
}

export type ServerCtx = ReturnType<typeof createServerCtx>

function isLocalHost(url: string) {
  const host = url.replace(/^https?:\/\//, "").split(":")[0]
  if (host === "localhost" || host === "127.0.0.1") return "local"
}
