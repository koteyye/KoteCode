import { describe, expect, test } from "bun:test"
import { authFromToken, authTokenFromCredentials, createApiForServer } from "./server"

describe("authFromToken", () => {
  test("decodes basic auth credentials from auth_token", () => {
    expect(authFromToken(btoa("kit:secret"))).toEqual({ username: "kit", password: "secret" })
  })

  test("defaults blank username to opencode", () => {
    expect(authFromToken(btoa(":secret"))).toEqual({ username: "opencode", password: "secret" })
  })

  test("ignores malformed tokens", () => {
    expect(authFromToken("not base64")).toBeUndefined()
    expect(authFromToken(btoa("missing-separator"))).toBeUndefined()
  })
})

describe("authTokenFromCredentials", () => {
  test("encodes credentials with the default username", () => {
    expect(authTokenFromCredentials({ password: "secret" })).toBe(btoa("opencode:secret"))
  })
})

test("repository discovery scopes the request through a Location query", async () => {
  let requested = ""
  const fetch: typeof globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL) => {
      requested = String(input)
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
    },
    { preconnect() {} },
  )
  const api = createApiForServer({
    server: { url: "https://server.example.test" },
    fetch,
  })

  await api.project.repositories({ directory: "C:\\Workspace" })

  expect(new URL(requested).searchParams.get("location[directory]")).toBe("C:\\Workspace")
})
