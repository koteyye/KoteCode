import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"
import type { AsyncStorage } from "@solid-primitives/storage"
import { createEffect, createRoot } from "solid-js"
import { ServerScope } from "@/utils/server-scope"

let Prompt: typeof import("@/context/prompt")
let PromptState: typeof import("@/context/prompt-state")
let read: ((value: string | null) => void) | undefined
const writes: { key: string; value: string }[] = []

const storage: AsyncStorage = {
  getItem: () => new Promise((resolve) => (read = resolve)),
  setItem: async (key, value) => {
    writes.push({ key, value })
  },
  removeItem: async () => undefined,
  clear: async () => undefined,
  key: async () => null,
  getLength: async () => 0,
  length: Promise.resolve(0),
}

beforeAll(async () => {
  mock.module("@solidjs/router", () => ({
    useParams: () => ({}),
    useSearchParams: () => [{}],
    useLocation: () => ({ pathname: "", query: {} }),
    useNavigate: () => () => undefined,
  }))
  mock.module("@opencode-ai/ui/context", () => ({
    createSimpleContext: () => ({
      use: () => undefined,
      provider: () => undefined,
    }),
  }))
  mock.module("@/context/platform", () => ({
    usePlatform: () => ({ platform: "desktop", storage: () => storage }),
  }))

  Prompt = await import("@/context/prompt")
  PromptState = await import("@/context/prompt-state")
})

beforeEach(() => {
  read = undefined
  writes.length = 0
})

describe("prompt persistence", () => {
  test("waits for an async draft to hydrate before reporting ready", async () => {
    await new Promise<void>((resolve, reject) => {
      createRoot((dispose) => {
        const session = Prompt.createPromptSession(ServerScope.local, { draftID: "draft-async" })
        const ready = Prompt.createPromptReady(() => session)

        expect(ready()).toBe(false)
        expect(session.current()[0]).toMatchObject({ type: "text", content: "" })

        read?.(
          JSON.stringify({
            prompt: [{ type: "text", content: "persisted draft", start: 0, end: 15 }],
            cursor: 15,
            context: { items: [] },
          }),
        )

        createEffect(() => {
          if (!ready()) return
          try {
            expect(session.current()[0]).toMatchObject({ type: "text", content: "persisted draft" })
            dispose()
            resolve()
          } catch (error) {
            dispose()
            reject(error)
          }
        })
      })
    })
  })

  test("removes legacy image data while hydrating a persisted prompt", async () => {
    const root = createRoot((dispose) => ({
      session: Prompt.createPromptSession(ServerScope.local, { draftID: "draft-image-migration" }),
      dispose,
    }))
    const text = { type: "text" as const, content: "persist me", start: 0, end: 10 }

    read?.(
      JSON.stringify({
        prompt: [
          text,
          {
            type: "image",
            id: "image-1",
            filename: "image.png",
            mime: "image/png",
            dataUrl: "data:image/png;base64,legacy-payload",
          },
        ],
        cursor: 10,
        context: { items: [] },
      }),
    )
    await root.session.ready.promise

    expect(root.session.current()).toEqual([text])
    expect(writes).toHaveLength(1)
    expect(writes[0].value).not.toContain("data:image/png")
    root.dispose()
  })

  test("keeps runtime images while persisting a small text-only draft snapshot", async () => {
    const root = createRoot((dispose) => ({
      session: PromptState.createDraftPromptSession("draft-runtime-image"),
      dispose,
    }))
    read?.(null)
    await root.session.ready.promise

    const text = { type: "text" as const, content: "hello", start: 0, end: 5 }
    const image = {
      type: "image" as const,
      id: "image-1",
      filename: "image.png",
      mime: "image/png",
      dataUrl: `data:image/png;base64,${"A".repeat(1024 * 1024)}`,
    }
    root.session.set([text, image], 5)

    expect(root.session.current()).toEqual([text, image])
    expect(writes).toHaveLength(1)
    expect(writes[0].value.length).toBeLessThan(1024)
    expect(writes[0].value).not.toContain("data:image/png")
    const persisted: unknown = JSON.parse(writes[0].value)
    expect(persisted).toEqual({ prompt: [text], cursor: 5, context: { items: [] } })
    root.dispose()
  })
})
