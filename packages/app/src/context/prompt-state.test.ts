import { describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createPromptState, DEFAULT_PROMPT, sanitizePersistedPromptState, type PromptStore } from "./prompt-state"

describe("prompt state initialization", () => {
  test("initializes prompt text, cursor, and model together", () => {
    createRoot((dispose) => {
      const model = { providerID: "anthropic", modelID: "claude", variant: "high" }
      const prompt = createPromptState({ prompt: "hello", model })

      expect(prompt.current()).toEqual([{ type: "text", content: "hello", start: 0, end: 5 }])
      expect(prompt.cursor()).toBe(5)
      expect(prompt.model.current()).toEqual(model)
      expect(prompt.model.current()).not.toBe(model)
      dispose()
    })
  })

  test("uses the default prompt without initial values", () => {
    createRoot((dispose) => {
      const prompt = createPromptState()

      expect(prompt.current()).toEqual(DEFAULT_PROMPT)
      expect(prompt.cursor()).toBeUndefined()
      expect(prompt.model.current()).toBeUndefined()
      dispose()
    })
  })
})

describe("prompt state persistence", () => {
  test("removes image data from the persisted snapshot without mutating runtime state", () => {
    const text = { type: "text" as const, content: "hello", start: 0, end: 5 }
    const image = {
      type: "image" as const,
      id: "image-1",
      filename: "image.png",
      mime: "image/png",
      dataUrl: "data:image/png;base64,large-payload",
    }
    const state: PromptStore = {
      prompt: [text, image],
      cursor: 5,
      model: { providerID: "openai", modelID: "gpt-5" },
      context: { items: [] },
    }

    expect(sanitizePersistedPromptState(state)).toEqual({ ...state, prompt: [text] })
    expect(state.prompt).toEqual([text, image])
  })

  test("persists the default text part when a prompt only contains images", () => {
    const state: PromptStore = {
      prompt: [
        {
          type: "image",
          id: "image-1",
          filename: "image.png",
          mime: "image/png",
          dataUrl: "data:image/png;base64,payload",
        },
      ],
      cursor: 0,
      context: { items: [] },
    }
    expect(sanitizePersistedPromptState(state)).toEqual({ ...state, prompt: DEFAULT_PROMPT })
  })
})
