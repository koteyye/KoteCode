import { describe, expect, test } from "bun:test"
import { APP_IDS, APP_NAMES, UPDATER_ENABLED, WSL_DISABLED_MESSAGE, WSL_ENABLED } from "./constants"

describe("KoteCode desktop identity", () => {
  test("uses fork-owned names and application ids", () => {
    expect(APP_NAMES).toEqual({
      dev: "KoteCode Dev",
      beta: "KoteCode Beta",
      prod: "KoteCode",
    })
    expect(APP_IDS).toEqual({
      dev: "ai.kotecode.desktop.dev",
      beta: "ai.kotecode.desktop.beta",
      prod: "ai.kotecode.desktop",
    })
  })

  test("keeps unavailable integrations disabled", () => {
    expect(UPDATER_ENABLED).toBe(false)
    expect(WSL_ENABLED).toBe(false)
    expect(WSL_DISABLED_MESSAGE).toContain("this KoteCode release")
  })
})
