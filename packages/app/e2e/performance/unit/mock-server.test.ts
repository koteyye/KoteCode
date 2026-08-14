import { expect, test } from "bun:test"
import type { Page, Route } from "@playwright/test"
import { mockOpenCodeServer } from "../../utils/mock-server"

test("applies message latency after a list response gate is released", async () => {
  const events: string[] = []
  const gate = Promise.withResolvers<void>()
  let handler: ((route: Route) => Promise<void>) | undefined
  const page = {
    route: (_url: string, callback: (route: Route) => Promise<void>) => {
      handler = callback
      return Promise.resolve()
    },
  } as unknown as Page
  await mockOpenCodeServer(page, {
    provider: {},
    directory: "C:/OpenCode",
    project: {},
    sessions: [{ id: "session" }],
    messageDelay: 25,
    beforeMessagesResponse: () => {
      events.push("before")
      return gate.promise
    },
    onMessages: (request) => events.push(request.phase),
    pageMessages: () => {
      events.push("page")
      return { items: [] }
    },
  })

  const response = handler!({
    request: () => ({ url: () => "http://127.0.0.1:4096/session/session/message" }),
    fulfill: () => {
      events.push("fulfill")
      return Promise.resolve()
    },
  } as unknown as Route)
  expect(events).toEqual(["start", "before"])

  const released = performance.now()
  gate.resolve()
  await response
  expect(performance.now() - released).toBeGreaterThanOrEqual(20)
  expect(events).toEqual(["start", "before", "page", "end", "fulfill"])
})

test("serves a valid v2 catalog from the provider fixture", async () => {
  let handler: ((route: Route) => Promise<void>) | undefined
  const page = {
    route: (_url: string, callback: (route: Route) => Promise<void>) => {
      handler = callback
      return Promise.resolve()
    },
  } as unknown as Page
  await mockOpenCodeServer(page, {
    protocol: "v2",
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          npm: "opencode-provider",
          models: {
            test: {
              id: "test",
              name: "Test",
              limit: { context: 200_000 },
              variants: { high: {} },
            },
          },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "test" },
    },
    directory: "C:/OpenCode",
    project: { id: "project" },
    sessions: [],
    pageMessages: () => ({ items: [] }),
  })

  const request = async (path: string) => {
    const response = Promise.withResolvers<unknown>()
    await handler!({
      request: () => ({ url: () => `http://127.0.0.1:4096${path}` }),
      fulfill: (input: Parameters<Route["fulfill"]>[0]) => {
        response.resolve(JSON.parse(input.body?.toString() ?? "null") as unknown)
        return Promise.resolve()
      },
    } as unknown as Route)
    return response.promise
  }

  const provider = await request("/api/provider")
  const models = await request("/api/model")
  const defaultModel = await request("/api/model/default")
  const location = {
    directory: "C:/OpenCode",
    project: { id: "project", directory: "C:/OpenCode" },
  }
  const model = {
    id: "test",
    modelID: "test",
    providerID: "opencode",
    name: "Test",
    package: "opencode-provider",
    settings: {},
    headers: {},
    capabilities: { tools: true, input: ["text"], output: ["text"] },
    variants: [{ id: "high", settings: {} }],
    time: { released: 0 },
    cost: [],
    status: "active",
    enabled: true,
    limit: { context: 200_000, output: 4_096 },
  }
  expect(provider).toEqual({
    location,
    data: [{ id: "opencode", name: "OpenCode", package: "opencode-provider" }],
  })
  expect(models).toEqual({ location, data: [model] })
  expect(defaultModel).toEqual({ location, data: model })
})
