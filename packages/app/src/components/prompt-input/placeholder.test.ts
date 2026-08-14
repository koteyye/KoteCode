import { describe, expect, test } from "bun:test"
import { promptDesignPlaceholder, promptPlaceholder } from "./placeholder"

describe("promptPlaceholder", () => {
  const t = (key: string, params?: Record<string, string>) => `${key}${params?.example ? `:${params.example}` : ""}`

  test("returns shell placeholder in shell mode", () => {
    const value = promptPlaceholder({
      mode: "shell",
      commentCount: 0,
      example: "example",
      suggest: true,
      t,
    })
    expect(value).toBe("prompt.placeholder.shell:example")
  })

  test("returns summarize placeholders for comment context", () => {
    expect(promptPlaceholder({ mode: "normal", commentCount: 1, example: "example", suggest: true, t })).toBe(
      "prompt.placeholder.summarizeComment",
    )
    expect(promptPlaceholder({ mode: "normal", commentCount: 2, example: "example", suggest: true, t })).toBe(
      "prompt.placeholder.summarizeComments",
    )
  })

  test("returns default placeholder with example when suggestions enabled", () => {
    const value = promptPlaceholder({
      mode: "normal",
      commentCount: 0,
      example: "translated-example",
      suggest: true,
      t,
    })
    expect(value).toBe("prompt.placeholder.normal:translated-example")
  })

  test("returns simple placeholder when suggestions disabled", () => {
    const value = promptPlaceholder({
      mode: "normal",
      commentCount: 0,
      example: "translated-example",
      suggest: false,
      t,
    })
    expect(value).toBe("prompt.placeholder.simple")
  })

  test("uses the UI language pack for the redesigned normal placeholder", () => {
    expect(promptDesignPlaceholder("normal", "fallback", t)).toBe("ui.prompt.placeholder.normal")
    expect(promptDesignPlaceholder("shell", "translated shell", t)).toBe("translated shell")
  })
})
