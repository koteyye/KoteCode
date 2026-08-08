import { expect, test, vi } from "bun:test"
import { createRoot } from "solid-js"
import { createStore } from "solid-js/store"
import { makeRepositoryDiscovery } from "./global"
import { createServerProjects } from "./server"
import { ServerScope } from "@/utils/server-scope"

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

test("repository discovery retries after a failed request", async () => {
  vi.useFakeTimers()
  let dispose = () => {}
  try {
    let calls = 0
    const result = createRoot((cleanup) => {
      dispose = cleanup
      const [store, setStore] = createStore({ projects: {}, lastProject: {}, recentlyClosed: {} })
      const projects = createServerProjects({ scope: () => ServerScope.local, store, setStore })
      projects.open("/workspace")
      const discover = makeRepositoryDiscovery(
        {
          health: () => ({ healthy: true }),
          projects,
          repositories: () => {
            calls++
            if (calls === 1) return Promise.reject(new Error("offline"))
            return Promise.resolve([{ directory: "/workspace/api" }, { directory: "/workspace/web" }])
          },
        },
        { retryDelayMs: 100 },
      )
      return { discover, projects }
    })

    result.discover()
    await flush()
    expect(calls).toBe(1)

    vi.advanceTimersByTime(99)
    await flush()
    expect(calls).toBe(1)

    vi.advanceTimersByTime(1)
    await flush()
    expect(calls).toBe(2)
    expect(result.projects.list()[0]?.repositories).toEqual(["/workspace/api", "/workspace/web"])

    result.discover()
    await flush()
    vi.advanceTimersByTime(1_000)
    await flush()
    expect(calls).toBe(2)
    result.discover.dispose()
  } finally {
    dispose()
    vi.useRealTimers()
  }
})

test("repository discovery ignores an in-flight result after disposal", async () => {
  let resolve = (_repositories: readonly { directory: string }[]) => {}
  const updates: string[][] = []
  const project = { worktree: "/workspace", expanded: true }
  const discover = makeRepositoryDiscovery({
    health: () => ({ healthy: true }),
    projects: {
      list: () => [project],
      setRepositories: (_directory, repositories) => updates.push(repositories),
      remove: () => {},
      open: () => {},
    },
    repositories: () =>
      new Promise((done) => {
        resolve = done
      }),
  })

  discover()
  discover.dispose()
  resolve([{ directory: "/workspace/api" }, { directory: "/workspace/web" }])
  await flush()

  expect(updates).toEqual([])
})

test("repository discovery waits for a supported protocol", () => {
  let calls = 0
  const discover = makeRepositoryDiscovery({
    enabled: () => false,
    health: () => ({ healthy: true }),
    projects: {
      list: () => [{ worktree: "/workspace", expanded: true }],
      setRepositories: () => {},
      remove: () => {},
      open: () => {},
    },
    repositories: async () => {
      calls++
      return []
    },
  })

  discover()
  expect(calls).toBe(0)
})
