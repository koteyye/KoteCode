import { describe, expect, test } from "bun:test"
import type { SessionV2Info } from "@opencode-ai/sdk/v2/client"
import {
  applyHomeSessionEvent,
  appendHomeSessionEvent,
  HOME_SESSION_INDEX_LIMIT,
  HOME_V2_SESSION_PAGE_LIMIT,
  loadHomeSessionIndex,
  homeSessionIndexSessions,
  homeSessionIndexRefresh,
  mergeHomeSessionIndexPage,
  parseHomeSessionIndex,
  retainHomeSessions,
} from "./home-session-index"
import { SESSION_RECENT_LIMIT } from "./types"

const session = (input: {
  id: string
  directory?: string
  parentID?: string
  archived?: number
  created?: number
  updated?: number
}) => ({
  id: input.id,
  parentID: input.parentID,
  projectID: "project",
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: input.created ?? 1, updated: input.updated ?? 1, archived: input.archived },
  title: input.id,
  location: { directory: input.directory ?? "/project" },
})

describe("Home V2 session index", () => {
  test("loads the Home index with one global V2 request", async () => {
    const calls: unknown[] = []
    const result = await loadHomeSessionIndex(async (input) => {
      calls.push(input)
      return { data: { data: [session({ id: "root" })], cursor: {} } }
    })

    expect(result.sessions).toHaveLength(1)
    expect(calls).toEqual([{ limit: HOME_V2_SESSION_PAGE_LIMIT, order: "desc" }])
  })

  test("loads every page so an old session updated today is not omitted", async () => {
    const calls: unknown[] = []
    const controller = new AbortController()
    const now = Date.now()
    const result = await loadHomeSessionIndex(
      async (input, options) => {
        calls.push({ input, signal: options.signal })
        if (!("cursor" in input)) {
          return {
            data: {
              data: Array.from({ length: HOME_V2_SESSION_PAGE_LIMIT }, (_, index) =>
                session({ id: `page-1-${index}`, created: HOME_V2_SESSION_PAGE_LIMIT - index, updated: 1 }),
              ),
              cursor: { next: "next-page" },
            },
          }
        }
        return {
          data: {
            data: [session({ id: "late-hot", created: 0, updated: now })],
            cursor: {},
          },
        }
      },
      0,
      controller.signal,
    )

    expect(result.sessions).toHaveLength(HOME_SESSION_INDEX_LIMIT)
    expect(result.sessions.some((item) => item.id === "late-hot")).toBe(true)
    expect(calls).toEqual([
      { input: { limit: HOME_V2_SESSION_PAGE_LIMIT, order: "desc" }, signal: controller.signal },
      {
        input: { limit: HOME_V2_SESSION_PAGE_LIMIT, order: "desc", cursor: "next-page" },
        signal: controller.signal,
      },
    ])
  })

  test("incremental page compaction matches one batch across directories and filtered sessions", () => {
    const now = 10 * 60 * 60 * 1000
    const limit = 4
    const one = Array.from({ length: 90 }, (_, index) =>
      session({
        id: `one-${index.toString().padStart(3, "0")}`,
        directory: index % 2 === 0 ? "/one" : "/one/",
        updated: index < 60 ? now - index : 1,
      }),
    )
    const two = Array.from({ length: 12 }, (_, index) =>
      session({ id: `two-${index.toString().padStart(3, "0")}`, directory: "/two", updated: index + 1 }),
    )
    const activeNull = {
      ...session({ id: "active-null", directory: "/two", updated: now }),
      time: { created: 1, updated: now, archived: null },
    } as unknown as SessionV2Info
    const input = [
      ...one.slice(0, 31),
      session({ id: "child", directory: "/one", parentID: "one-000", updated: now }),
      ...two,
      session({ id: "archived", directory: "/two", archived: now, updated: now }),
      activeNull,
      ...one.slice(31),
    ]
    const buckets = new Map<string, ReturnType<typeof parseHomeSessionIndex>>()

    const pages = [input.slice(0, 37), input.slice(37, 83), input.slice(83)]
    pages.forEach((page) => mergeHomeSessionIndexPage(buckets, page, limit, now))

    expect([...buckets.values()].flat()).toEqual(retainHomeSessions(parseHomeSessionIndex(input), limit, now))
    expect(buckets.get("/one")).toHaveLength(limit + SESSION_RECENT_LIMIT)
    expect(buckets.get("/two")).toHaveLength(limit)
  })

  test("keeps every bucket bounded while later pages displace older entries across equivalent path keys", () => {
    const now = 10 * 60 * 60 * 1000
    const limit = 2
    const buckets = new Map<string, ReturnType<typeof parseHomeSessionIndex>>()
    const first = Array.from({ length: 70 }, (_, index) =>
      session({
        id: `repo-${index.toString().padStart(3, "0")}`,
        directory: "/repo/",
        updated: now - index - 100,
      }),
    )

    mergeHomeSessionIndexPage(buckets, first, limit, now)
    expect(buckets.size).toBe(1)
    expect(buckets.get("/repo")).toHaveLength(limit + SESSION_RECENT_LIMIT)
    expect(buckets.get("/repo")?.some((item) => item.id === "repo-051")).toBe(true)

    mergeHomeSessionIndexPage(
      buckets,
      [session({ id: "late-hot", directory: "/repo", created: 0, updated: now })],
      limit,
      now,
    )

    expect(buckets.size).toBe(1)
    expect(buckets.get("/repo")).toHaveLength(limit + SESSION_RECENT_LIMIT)
    expect(buckets.get("/repo")?.some((item) => item.id === "late-hot")).toBe(true)
    expect(buckets.get("/repo")?.some((item) => item.id === "repo-051")).toBe(false)
  })

  test("maps visible roots to Home session summaries", () => {
    const activeNull = {
      ...session({ id: "active-null", updated: 20 }),
      time: { created: 1, updated: 20, archived: null },
    } as unknown as SessionV2Info
    const result = parseHomeSessionIndex([
      session({ id: "root", updated: 30 }),
      activeNull,
      session({ id: "child", parentID: "root", updated: 40 }),
      session({ id: "archived", archived: 50, updated: 50 }),
    ])

    expect(result).toEqual([
      expect.objectContaining({
        id: "root",
        slug: "root",
        version: "",
        directory: "/project",
        projectID: "project",
        title: "root",
        time: { created: 1, updated: 30 },
      }),
      expect.objectContaining({
        id: "active-null",
        time: { created: 1, updated: 20, archived: null },
      }),
    ])
  })

  test("preserves the per-directory Home retention limit", () => {
    const now = 10 * 60 * 60 * 1000
    const sessions = Array.from({ length: 80 }, (_, index) => ({
      ...parseHomeSessionIndex([session({ id: `session-${index}`, updated: index + 1 })])[0],
      directory: index % 2 === 0 ? "/one" : "/two",
    }))

    const retained = retainHomeSessions(sessions, 10, now)
    expect(retained.filter((item) => item.directory === "/one")).toHaveLength(10)
    expect(retained.filter((item) => item.directory === "/two")).toHaveLength(10)
  })

  test("replays session events over the loaded index", () => {
    const initial = parseHomeSessionIndex([session({ id: "old" })])
    const created = { ...initial[0], id: "new", slug: "new", title: "new", time: { created: 2, updated: 2 } }

    const afterCreate = applyHomeSessionEvent(initial, {
      type: "session.created",
      properties: { sessionID: created.id, info: created },
    })
    expect(
      applyHomeSessionEvent(afterCreate, {
        type: "session.deleted",
        properties: { sessionID: initial[0]!.id, info: initial[0]! },
      }),
    ).toEqual([created])
  })

  test("applies only events newer than the index baseline", () => {
    const initial = parseHomeSessionIndex([session({ id: "old" })])
    const stale = { ...initial[0], title: "stale" }
    const current = { ...initial[0], title: "current" }
    const first = appendHomeSessionEvent(undefined, {
      type: "session.updated",
      properties: { sessionID: stale.id, info: stale },
    })
    const events = appendHomeSessionEvent(first, {
      type: "session.updated",
      properties: { sessionID: current.id, info: current },
    })

    expect(homeSessionIndexSessions({ sessions: initial, eventSequence: 1 }, events)[0]?.title).toBe("current")
  })

  test("refetches after reconnect, disposal, and session moves", () => {
    expect(homeSessionIndexRefresh("server.connected", false)).toEqual({ connected: true, refetch: false })
    expect(homeSessionIndexRefresh("server.connected", true)).toEqual({ connected: true, refetch: true })
    expect(homeSessionIndexRefresh("global.disposed", true).refetch).toBe(true)
    expect(homeSessionIndexRefresh("session.next.moved", true).refetch).toBe(true)
  })
})
