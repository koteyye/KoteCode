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
    expect(translate("Direct")).toBe("Напрямую")
    expect(translate("Kote Gateway")).toBe("Kote Gateway")
    expect(translate("BUILD", "en")).toBe("BUILD")
  })

  test("localizes built-in agent names", () => {
    expect(agent("build")).toBe("Сборка")
    expect(agent("plan")).toBe("План")
    expect(agent("custom")).toBe("Custom")
    expect(agent("build", "en")).toBe("Build")
  })

  test("translates command palette entries", () => {
    expect(translate("Switch to light mode")).toBe("Переключить на светлую тему")
    expect(translate("Lock theme mode")).toBe("Заблокировать режим темы")
    expect(translate("Toggle debug panel")).toBe("Показать панель отладки")
    expect(translate("Disable animations")).toBe("Отключить анимации")
    expect(translate("Enable animations")).toBe("Включить анимации")
    expect(translate("Disable auto-approve permissions")).toBe("Отключить автоодобрение разрешений")
    expect(translate("Plugins")).toBe("Плагины")
    expect(translate("Install plugin")).toBe("Установить плагин")
    expect(translate("Open diff viewer")).toBe("Открыть просмотрщик изменений")
  })

  test("dictionary match wins over Write dynamic rule for heap snapshot", () => {
    expect(translate("Write heap snapshot")).toBe("Сохранить дамп кучи")
    // unrelated "Write ..." entries still use the dynamic rule
    expect(translate("Write settings.json")).toBe("Запись settings.json")
  })
})
