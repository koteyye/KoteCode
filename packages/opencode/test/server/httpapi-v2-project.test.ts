import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import { Context } from "effect"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

const context = Context.empty() as Context.Context<unknown>

function request(route: string, directory: string) {
  return HttpApiApp.webHandler().handler(
    new Request(`http://localhost${route}`, {
      headers: { "x-opencode-directory": directory },
    }),
    context,
  )
}

beforeEach(async () => {
  await resetDatabase()
})

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("v2 project HttpApi", () => {
  test("lists projects and resolves the current project", async () => {
    await using tmp = await tmpdir({ git: true })

    const current = await request(`/api/project/current?location[directory]=${encodeURIComponent(tmp.path)}`, tmp.path)
    expect(current.status).toBe(200)
    const info = (await current.json()) as { id: string; directory: string }
    expect(info).toMatchObject({ directory: tmp.path })

    const list = await request("/api/project", tmp.path)
    expect(list.status).toBe(200)
    expect(await list.json()).toEqual([expect.objectContaining({ id: info.id })])

    const update = await HttpApiApp.webHandler().handler(
      new Request(`http://localhost/api/project/${info.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-opencode-directory": tmp.path },
        body: JSON.stringify({ name: "Opened project" }),
      }),
      context,
    )
    expect(update.status).toBe(200)
    expect(await update.json()).toMatchObject({ id: info.id, name: "Opened project" })
  })

  test("discovers immediate child Git repositories", async () => {
    await using tmp = await tmpdir()
    const repositories = [path.join(tmp.path, "api"), path.join(tmp.path, "web")]
    await Promise.all(repositories.map((directory) => fs.mkdir(directory)))
    await Promise.all(repositories.map((directory) => $`git init`.cwd(directory).quiet()))

    const response = await request(
      `/api/project/repositories?location[directory]=${encodeURIComponent(tmp.path)}`,
      tmp.path,
    )

    expect(response.status).toBe(200)
    expect(
      ((await response.json()) as Array<{ directory: string }>).map((item) => path.basename(item.directory)),
    ).toEqual(["api", "web"])
  })
})
