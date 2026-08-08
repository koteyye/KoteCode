import { describe, expect, test } from "bun:test"
import { findPromptProject, promptProjectOptions } from "./prompt-project"

describe("prompt project options", () => {
  test("selects a grouped repository by its directory", () => {
    const directory = "/workspace/koteyye-eco-system/file-storage"
    const options = promptProjectOptions([
      {
        id: "kotecode",
        name: "KoteCode",
        worktree: "/workspace/KoteCode",
        server: { key: "local", name: "Local" },
      },
      {
        id: "project-group",
        name: "koteyye-eco-system",
        worktree: "/workspace/koteyye-eco-system",
        repositories: ["/workspace/koteyye-eco-system/api", directory],
        server: { key: "local", name: "Local" },
      },
    ])

    expect(findPromptProject(options, directory, "local")).toMatchObject({
      name: "file-storage",
      worktree: directory,
      server: { key: "local", name: "Local" },
    })
  })
})
