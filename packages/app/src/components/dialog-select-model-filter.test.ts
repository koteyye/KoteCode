import { describe, expect, test } from "bun:test"
import { filterConnectedModels } from "./dialog-select-model-filter"

const models = [
  { id: "gpt-5", provider: { id: "openai" } },
  { id: "claude-sonnet", provider: { id: "anthropic" } },
  { id: "gemini-pro", provider: { id: "google" } },
]

describe("filterConnectedModels", () => {
  test("returns models only from connected providers", () => {
    expect(filterConnectedModels(models, ["openai", "anthropic"]).map((model) => model.id)).toEqual([
      "gpt-5",
      "claude-sonnet",
    ])
  })

  test("also respects an explicitly requested provider", () => {
    expect(filterConnectedModels(models, ["openai", "anthropic"], "anthropic").map((model) => model.id)).toEqual([
      "claude-sonnet",
    ])
  })

  test("does not expose a requested provider when it is disconnected", () => {
    expect(filterConnectedModels(models, ["openai"], "anthropic")).toEqual([])
  })
})
