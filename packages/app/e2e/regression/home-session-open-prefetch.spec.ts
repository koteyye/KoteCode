import { expect, test } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"

const directory = "C:/OpenCode/HomeSessionOpenPrefetch"
const targetID = "ses_home_session_cold"
const inactiveID = "ses_home_session_inactive"
const server = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`

test("opens a cold home session from its listed metadata and prefetches messages", async ({ page }) => {
  const requests = {
    agents: [] as string[],
    inactiveInfo: [] as string[],
    inactiveMessages: [] as string[],
    info: [] as string[],
    messages: [] as string[],
    providers: [] as string[],
  }
  page.on("request", (request) => {
    if (request.method() !== "GET") return
    const url = new URL(request.url())
    const path = url.pathname
    if (path === "/agent" && url.searchParams.get("directory") === directory) requests.agents.push(request.url())
    if (path === "/provider" && url.searchParams.get("directory") === directory) requests.providers.push(request.url())
    if (path === `/session/${targetID}` || path === `/api/session/${targetID}`) {
      requests.info.push(request.url())
    }
    if (path === `/session/${targetID}/message` || path === `/api/session/${targetID}/message`)
      requests.messages.push(request.url())
    if (path === `/session/${inactiveID}` || path === `/api/session/${inactiveID}`) {
      requests.inactiveInfo.push(request.url())
    }
    if (path === `/session/${inactiveID}/message` || path === `/api/session/${inactiveID}/message`) {
      requests.inactiveMessages.push(request.url())
    }
  })

  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: "proj_home_session_open_prefetch",
      worktree: directory,
      vcs: "git",
      name: "home-session-open-prefetch",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: { all: [], connected: [], default: {} },
    sessions: [
      session("ses_home_session_warm_1", "Warm session one", 1700000003000),
      session("ses_home_session_warm_2", "Warm session two", 1700000002000),
      session(targetID, "Cold session target", 1700000001000),
      session(inactiveID, "Inactive session tab", 1700000000000),
    ],
    pageMessages: () => ({ items: [] }),
  })

  await page.addInitScript(
    ({ directory, inactiveID, server }) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale: "en" }))
      localStorage.setItem(
        "opencode.global.dat:server",
        JSON.stringify({
          projects: { local: [{ worktree: directory, expanded: true }] },
          lastProject: { local: directory },
        }),
      )
      localStorage.setItem(
        "opencode.window.browser.dat:tabs",
        JSON.stringify([{ type: "session", server, sessionId: inactiveID }]),
      )
    },
    { directory, inactiveID, server },
  )

  await page.goto("/")
  const row = page.locator('[data-component="home-session-row"]').filter({ hasText: "Cold session target" })
  await expect(row).toBeVisible()
  await page.waitForTimeout(100)
  expect(requests.info).toEqual([])
  expect(requests.messages).toEqual([])
  expect(requests.inactiveMessages).toEqual([])
  expect(requests.agents).toEqual([])
  expect(requests.providers).toEqual([])

  await row.click()

  await expect(page).toHaveURL(new RegExp(`/session/${targetID}$`))
  await expect(page.locator('[data-component="prompt-input-v2"]')).toBeVisible()
  await expect.poll(() => requests.messages.length).toBeGreaterThan(0)
  await expect.poll(() => requests.agents.length).toBe(1)
  await expect.poll(() => requests.providers.length).toBe(1)
  await page.waitForTimeout(100)
  expect(requests.info).toEqual([])
  expect(requests.messages).toHaveLength(1)
  expect(requests.agents).toHaveLength(1)
  expect(requests.providers).toHaveLength(1)
})

function session(id: string, title: string, updated: number) {
  return {
    id,
    projectID: "proj_home_session_open_prefetch",
    directory,
    title,
    time: { created: updated, updated },
  }
}
