import { expect, test } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { trackPageErrors } from "../utils/errors"
import { expectAppVisible } from "../utils/waits"

const directory = "C:/OpenCode/HomeProjectClose"
const repositories = [`${directory}/api`, `${directory}/web`]

test("closes and reopens a grouped project without stalling the renderer", async ({ page }) => {
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: "proj_home_project_close",
      worktree: directory,
      vcs: "git",
      name: "home-project-close",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: { all: [], connected: [], default: {} },
    sessions: [],
    pageMessages: () => ({ items: [] }),
  })

  await page.addInitScript(
    ({ directory, repositories }) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale: "en" }))
      localStorage.setItem(
        "opencode.global.dat:server",
        JSON.stringify({
          projects: { local: [{ worktree: directory, expanded: true, repositories }] },
          lastProject: { local: directory },
        }),
      )
    },
    { directory, repositories },
  )

  const errors = trackPageErrors(page)
  await page.goto("/")

  const row = page.locator('[data-component="home-project-row"]').filter({ hasText: "home-project-close" })
  await expectAppVisible(row)
  await expect(page.locator('[data-component="home-project-group-repository"]')).toHaveCount(2)

  await row.hover()
  await row.locator("xpath=..").locator('[data-action="home-project-menu"]').click()
  await page.getByRole("menuitem", { name: "Close", exact: true }).click()

  await expect(row).toHaveCount(0)
  const recentlyClosed = page.locator('[data-component="home-recently-closed-row"]')
  await expect(recentlyClosed).toBeVisible()

  await recentlyClosed.click()
  await expect(row).toBeVisible()
  await expect(page.locator('[data-component="home-project-group-repository"]')).toHaveCount(2)
  expect(errors).toEqual([])
})
