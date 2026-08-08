import { describe, expect, test } from "bun:test"
import { withStoreLock } from "./store"

const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe("withStoreLock", () => {
  test("serializes operations against the same store name", async () => {
    let inFlight = 0
    let maxInFlight = 0
    const op = () =>
      withStoreLock("opencode.draft.same.dat", async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await delay()
        inFlight--
      })

    await Promise.all(Array.from({ length: 10 }, op))

    expect(maxInFlight).toBe(1)
  })

  test("runs operations for different store names concurrently", async () => {
    let inFlight = 0
    let maxInFlight = 0
    const op = (name: string) =>
      withStoreLock(name, async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await delay()
        inFlight--
      })

    await Promise.all([op("opencode.draft.a.dat"), op("opencode.draft.b.dat"), op("opencode.draft.c.dat")])

    expect(maxInFlight).toBe(3)
  })

  test("resolves with each operation's value", async () => {
    const results = await Promise.all([
      withStoreLock("opencode.global.dat", () => "first"),
      withStoreLock("opencode.global.dat", async () => "second"),
    ])
    expect(results).toEqual(["first", "second"])
  })

  test("a rejected operation does not poison the next", async () => {
    const first = withStoreLock("opencode.draft.recover.dat", async () => {
      throw new Error("boom")
    })
    await expect(first).rejects.toThrow("boom")

    const second = await withStoreLock("opencode.draft.recover.dat", () => "recovered")
    expect(second).toBe("recovered")
  })
})
