import { describe, expect, test } from "bun:test"
import { agent, resolveLanguage, translate } from "../../src/util/locale"

describe("terminal locale", () => {
  test("defaults to Russian and accepts only English explicitly", () => {
    expect(resolveLanguage()).toBe("ru")
    expect(resolveLanguage("ru")).toBe("ru")
    expect(resolveLanguage("de")).toBe("ru")
    expect(resolveLanguage("en")).toBe("en")
    expect(resolveLanguage("en-US")).toBe("en")
  })

  test("translates fixed and dynamic terminal labels", () => {
    expect(translate("BUILD")).toBe("СБОРКА")
    expect(translate("3 queued")).toBe("3 в очереди")
    expect(translate("Cannot connect to API: Request was cancelled.")).toBe(
      "Не удалось подключиться к API: Request was cancelled.",
    )
    expect(translate("BUILD", "en")).toBe("BUILD")
  })

  test("localizes built-in agent names", () => {
    expect(agent("build")).toBe("Сборка")
    expect(agent("plan")).toBe("План")
    expect(agent("custom")).toBe("Custom")
    expect(agent("build", "en")).toBe("Build")
  })
})
