import { getFilename } from "@opencode-ai/core/util/path"
import { pathKey } from "@/utils/path-key"

export type PromptProject = {
  name?: string
  id?: string
  worktree: string
  repositories?: string[]
  sandboxes?: string[]
  icon?: { color?: string; url?: string; override?: string }
  server?: { key: string; name: string }
}

export type PromptProjectControls = {
  available: PromptProject[]
  directory: string
  server?: string
  select: (worktree: string, server?: string) => void
  add: (title: string, server?: string) => void
}

export function promptProjectOptions(projects: PromptProject[]): PromptProject[] {
  return projects.flatMap((project) => [
    project,
    ...(project.repositories ?? []).map((directory) => ({
      name: getFilename(directory),
      worktree: directory,
      server: project.server,
    })),
  ])
}

export function findPromptProject(projects: PromptProject[], directory: string, server?: string) {
  const key = pathKey(directory)
  return projects.find(
    (project) =>
      (!project.server || project.server.key === server) &&
      (pathKey(project.worktree) === key || project.sandboxes?.some((sandbox) => pathKey(sandbox) === key)),
  )
}
