import { describe, expect, test } from "bun:test"
import { ConfigParse } from "@/config/parse"
import { isSecretKey, stripSecrets } from "@/cli/cmd/migrate"

describe("migrate-from-opencode", () => {
  test("recognizes credential keys without treating ordinary key words as secrets", () => {
    expect(isSecretKey("apiKey")).toBe(true)
    expect(isSecretKey("OPENAI_API_KEY")).toBe(true)
    expect(isSecretKey("refresh-token")).toBe(true)
    expect(isSecretKey("secretAccessKey")).toBe(true)
    expect(isSecretKey("keyboard")).toBe(false)
    expect(isSecretKey("monkey")).toBe(false)
    expect(isSecretKey("keybinds")).toBe(false)
  })

  test("removes nested secrets instead of writing credential-like placeholders", () => {
    expect(
      stripSecrets({
        provider: {
          openai: {
            options: {
              apiKey: "secret-value",
              baseURL: "https://example.test/v1",
            },
          },
        },
        keybinds: { leader: "ctrl+x" },
      }),
    ).toEqual({
      provider: {
        openai: {
          options: {
            baseURL: "https://example.test/v1",
          },
        },
      },
      keybinds: { leader: "ctrl+x" },
    })
  })

  test("uses the real JSONC parser for inline comments and trailing commas", () => {
    expect(
      ConfigParse.jsonc(
        `{
          "provider": {
            "openai": { // inline comment
              "options": { "baseURL": "https://example.test/v1", },
            },
          },
        }`,
        "opencode.jsonc",
      ),
    ).toMatchObject({
      provider: {
        openai: {
          options: { baseURL: "https://example.test/v1" },
        },
      },
    })
  })
})
