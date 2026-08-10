import { expect, test } from "bun:test"
import type { SessionCommandData, V2ProjectRepositoriesData } from "../src/v2/gen/types.gen"

test("publishes project discovery and command tool overrides", () => {
  const project = {
    query: { location: { directory: "/workspace" } },
    url: "/api/project/repositories",
  } satisfies V2ProjectRepositoriesData
  const command = {
    path: { sessionID: "ses_test" },
    body: { arguments: "", command: "review", tools: { plan_enter: false } },
    url: "/session/{sessionID}/command",
  } satisfies SessionCommandData

  expect(project.query.location.directory).toBe("/workspace")
  expect(command.body.tools).toEqual({ plan_enter: false })
})
