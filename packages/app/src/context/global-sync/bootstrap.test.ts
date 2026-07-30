import { describe, expect, test } from "bun:test"
import { createStore } from "solid-js/store"
import { QueryClient } from "@tanstack/solid-query"
import type { Config, OpencodeClient, Project } from "@opencode-ai/sdk/v2/client"
import type { AgentApi, CatalogApi, CommandApi, ProjectApi, ReferenceApi } from "@opencode-ai/client/promise"
import type { NormalizedProviderListResponse } from "@opencode-ai/session-ui/context"
import {
  bootstrapDirectory,
  loadAgentsQuery,
  loadCommands,
  loadPathQuery,
  loadProjectsQuery,
  loadProvidersQuery,
  loadReferencesQuery,
} from "./bootstrap"
import type { State, VcsCache } from "./types"
import { ServerScope } from "@/utils/server-scope"
import type { ServerApi } from "@/utils/server"

const provider = { all: new Map(), connected: [], default: {} } satisfies NormalizedProviderListResponse
const api = {
  agent: { list: async () => ({ location: {}, data: [] }) },
  provider: { list: async () => ({ location: {}, data: [] }) },
  model: {
    list: async () => ({ location: {}, data: [] }),
    default: async () => ({ location: {}, data: null }),
  },
  permission: { request: { list: async () => ({ location: {}, data: [] }) } },
  project: {
    list: async () => [],
    current: async () => ({ id: "project", directory: "/project" }),
  },
  question: { request: { list: async () => ({ location: {}, data: [] }) } },
  reference: { list: async () => ({ location: {}, data: [] }) },
  vcs: { get: async () => ({ location: {}, data: {} }) },
} as unknown as ServerApi

function directoryState() {
  return createStore<State>({
    status: "loading",
    agent: [],
    command: [],
    reference: [],
    project: "",
    projectMeta: undefined,
    icon: undefined,
    provider_ready: true,
    provider,
    config: {},
    path: { state: "", config: "", worktree: "/project", directory: "/project", home: "/home" },
    session: [],
    sessionTotal: 0,
    session_status: {},
    session_working(id: string) {
      return this.session_status[id]?.type !== "idle"
    },
    session_diff: {},
    todo: {},
    permission: {},
    question: {},
    mcp_ready: true,
    mcp: {},
    mcp_resource: {},
    lsp_ready: true,
    lsp: [],
    vcs: undefined,
    limit: 5,
    message: {},
    session_message: {},
    part: {},
    part_text_accum_delta: {},
  })
}

describe("bootstrapDirectory", () => {
  test("marks a loading directory partial during bootstrap and complete after success", async () => {
    const mcpReads: string[] = []
    const [store, setStore] = directoryState()

    await bootstrapDirectory({
      directory: "/project",
      scope: ServerScope.local,
      mcp: false,
      global: {
        config: {} satisfies Config,
        path: { state: "", config: "", worktree: "/project", directory: "/project", home: "/home" },
        project: [{ id: "project", worktree: "/project" } as Project],
        provider,
      },
      sdk: {
        app: { agents: async () => ({ data: [{ name: "build", mode: "primary" }] }) },
        config: { get: async () => ({ data: {} }) },
        vcs: { get: async () => ({ data: undefined }) },
        command: {
          list: async () => {
            mcpReads.push("command")
            return { data: [] }
          },
        },
        permission: { list: async () => ({ data: [] }) },
        question: { list: async () => ({ data: [] }) },
        v2: { reference: { list: async () => ({ data: { data: [] } }) } },
        mcp: {
          status: async () => {
            mcpReads.push("status")
            return { data: {} }
          },
        },
        provider: { list: async () => ({ data: { all: [], connected: [], default: {} } }) },
      } as unknown as OpencodeClient,
      api,
      store,
      setStore,
      vcsCache: { setStore() {} } as unknown as VcsCache,
      loadSessions() {},
      translate: (key) => key,
      queryClient: new QueryClient(),
    })

    expect(store.status).toBe("partial")

    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(store.status).toBe("complete")
    expect(mcpReads).toEqual([])
  })

  test("uses legacy instance endpoints for v1 sidecars", async () => {
    const legacyCalls: string[] = []
    const currentCalls: string[] = []
    const [store, setStore] = directoryState()
    const currentApi = {
      ...api,
      command: {
        list: async () => {
          currentCalls.push("command")
          return { location: {}, data: [] }
        },
      },
      mcp: {
        list: async () => {
          currentCalls.push("mcp")
          return { location: {}, data: [] }
        },
        resource: {
          catalog: async () => {
            currentCalls.push("mcpResources")
            return { location: {}, data: { resources: [], templates: [] } }
          },
        },
      },
      path: {
        get: async () => {
          currentCalls.push("path")
          return { state: "", config: "", worktree: "/current", directory: "/current", home: "/home" }
        },
      },
      project: {
        list: async () => [],
        current: async () => {
          currentCalls.push("project")
          return { id: "current-project", directory: "/current" }
        },
      },
      vcs: {
        get: async () => {
          currentCalls.push("vcs")
          return { location: {}, data: { branch: "current", defaultBranch: "main" } }
        },
      },
    } as unknown as ServerApi
    const sdk = {
      app: { agents: async () => ({ data: [] }) },
      command: {
        list: async () => {
          legacyCalls.push("command")
          return { data: [] }
        },
      },
      config: { get: async () => ({ data: {} }) },
      experimental: {
        resource: {
          list: async () => {
            legacyCalls.push("mcpResources")
            return { data: {} }
          },
        },
      },
      mcp: {
        status: async () => {
          legacyCalls.push("mcp")
          return { data: {} }
        },
      },
      path: {
        get: async () => {
          legacyCalls.push("path")
          return {
            data: { state: "", config: "", worktree: "/project", directory: "/project", home: "/home" },
          }
        },
      },
      permission: { list: async () => ({ data: [] }) },
      project: {
        current: async () => {
          legacyCalls.push("project")
          return { data: { id: "legacy-project", worktree: "/project" } }
        },
      },
      provider: { list: async () => ({ data: { all: [], connected: [], default: {} } }) },
      question: { list: async () => ({ data: [] }) },
      session: { status: async () => ({ data: {} }) },
      v2: { reference: { list: async () => ({ data: { data: [] } }) } },
      vcs: {
        get: async () => {
          legacyCalls.push("vcs")
          return { data: { branch: "legacy", default_branch: "main" } }
        },
      },
    } as unknown as OpencodeClient

    await bootstrapDirectory({
      directory: "/project",
      scope: ServerScope.local,
      mcp: true,
      global: {
        config: {} satisfies Config,
        path: { state: "", config: "", worktree: "", directory: "", home: "/home" },
        project: [],
        provider,
      },
      sdk,
      api: currentApi,
      store,
      setStore,
      vcsCache: { setStore() {} } as unknown as VcsCache,
      loadSessions() {},
      translate: (key) => key,
      queryClient: new QueryClient(),
      protocol: Promise.resolve("v1"),
    })

    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(currentCalls).toEqual([])
    expect(legacyCalls).toContain("project")
    expect(legacyCalls).toContain("path")
    expect(legacyCalls).toContain("vcs")
    expect(legacyCalls).toContain("command")
    expect(legacyCalls).toContain("mcp")
    expect(legacyCalls).toContain("mcpResources")
    expect(store.project).toBe("legacy-project")
    expect(store.vcs).toEqual({ branch: "legacy", default_branch: "main" })
    expect(store.status).toBe("complete")
  })
})

describe("query keys", () => {
  test("partitions identical directories by server scope", () => {
    const client = {} as Parameters<typeof loadPathQuery>[2]
    const api = {} as CatalogApi
    const remote = "https://debian.example" as typeof ServerScope.local

    expect([...loadPathQuery(ServerScope.local, "/repo", client).queryKey]).toEqual(["local", "/repo", "path"])
    expect([...loadPathQuery(remote, "/repo", client).queryKey]).toEqual(["https://debian.example", "/repo", "path"])
    expect([...loadProvidersQuery(remote, null, api).queryKey]).toEqual(["https://debian.example", null, "providers"])
  })

  test("loads the current provider and model catalog", async () => {
    const calls: unknown[] = []
    const api = {
      provider: {
        list: async (input: unknown) => {
          calls.push(["provider", input])
          return { location: {}, data: [{ id: "openai", name: "OpenAI", package: "@ai-sdk/openai" }] }
        },
      },
      model: {
        list: async (input: unknown) => {
          calls.push(["model", input])
          return { location: {}, data: [] }
        },
        default: async (input: unknown) => {
          calls.push(["default", input])
          return { location: {}, data: null }
        },
      },
    } as unknown as CatalogApi

    const result = await new QueryClient().fetchQuery(loadProvidersQuery(ServerScope.local, "/repo", api))

    expect(calls).toEqual([
      ["provider", { location: { directory: "/repo" } }],
      ["model", { location: { directory: "/repo" } }],
      ["default", { location: { directory: "/repo" } }],
    ])
    expect(result.connected).toEqual(["openai"])
  })

  test("loads agents from the current location-scoped endpoint", async () => {
    const calls: unknown[] = []
    const api = {
      list: async (input: unknown) => {
        calls.push(input)
        return { location: {}, data: [] }
      },
    } as unknown as AgentApi

    const result = await new QueryClient().fetchQuery(loadAgentsQuery(ServerScope.local, "/repo", api))

    expect(calls).toEqual([{ location: { directory: "/repo" } }])
    expect(result).toEqual([])
  })

  test("loads commands from the current location-scoped endpoint", async () => {
    const calls: unknown[] = []
    const api = {
      list: async (input: unknown) => {
        calls.push(input)
        return {
          location: {},
          data: [{ name: "review", template: "Review files", source: "command" as const }],
        }
      },
    } as unknown as CommandApi

    const result = await loadCommands("/repo", api)

    expect(calls).toEqual([{ location: { directory: "/repo" } }])
    expect(result).toEqual([{ name: "review", template: "Review files", source: "command" }])
  })

  test("loads projects from the current endpoint", async () => {
    const api = {
      list: async () => [
        { id: "b", worktree: "/b", time: { created: 1, updated: 1 }, sandboxes: [] },
        { id: "a", worktree: "/a", time: { created: 1, updated: 1 }, sandboxes: [] },
      ],
    } as unknown as ProjectApi

    const result = await new QueryClient().fetchQuery(loadProjectsQuery(ServerScope.local, api))

    expect(result.map((project) => project.id)).toEqual(["a", "b"])
  })

  test("loads projects and paths from legacy endpoints for v1 sidecars", async () => {
    const calls: string[] = []
    const legacy = {
      path: {
        get: async () => {
          calls.push("legacyPath")
          return {
            data: { state: "", config: "", worktree: "/legacy", directory: "/legacy", home: "/home" },
          }
        },
      },
      project: {
        list: async () => {
          calls.push("legacyProjects")
          return { data: [{ id: "legacy", worktree: "/legacy" }] }
        },
      },
    } as unknown as OpencodeClient
    const projectApi = {
      list: async () => {
        calls.push("currentProjects")
        return []
      },
    } as unknown as ProjectApi
    const pathApi = {
      get: async () => {
        calls.push("currentPath")
        return { state: "", config: "", worktree: "/current", directory: "/current", home: "/home" }
      },
    } as Parameters<typeof loadPathQuery>[2]
    const queryClient = new QueryClient()

    const projects = await queryClient.fetchQuery(
      loadProjectsQuery(ServerScope.local, projectApi, legacy, Promise.resolve("v1")),
    )
    const path = await queryClient.fetchQuery(
      loadPathQuery(ServerScope.local, "/legacy", pathApi, legacy, Promise.resolve("v1")),
    )

    expect(calls).toEqual(["legacyProjects", "legacyPath"])
    expect(projects.map((project) => project.id)).toEqual(["legacy"])
    expect(path.directory).toBe("/legacy")
  })

  test("loads references from the current location-scoped endpoint", async () => {
    const calls: unknown[] = []
    const api = {
      list: async (input: unknown) => {
        calls.push(input)
        return { location: {}, data: [{ name: "AGENTS.md", path: "/repo/AGENTS.md", source: "instructions" }] }
      },
    } as unknown as ReferenceApi

    const result = await new QueryClient().fetchQuery(loadReferencesQuery(ServerScope.local, "/repo", api))

    expect(calls).toEqual([{ location: { directory: "/repo" } }])
    expect(result).toHaveLength(1)
  })
})
