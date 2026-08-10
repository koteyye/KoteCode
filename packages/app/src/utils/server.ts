import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import { OpenCode, type OpenCodeClient } from "@opencode-ai/client/promise"
import type { ServerConnection } from "@/context/server"
import { decode64 } from "@/utils/base64"
import type { Project } from "@opencode-ai/schema/project"

export function authTokenFromCredentials(input: { username?: string; password: string }) {
  return btoa(`${input.username ?? "opencode"}:${input.password}`)
}

export function authFromToken(token: string | null) {
  const decoded = decode64(token ?? undefined)
  if (!decoded) return
  const separator = decoded.indexOf(":")
  if (separator === -1) return
  return {
    username: decoded.slice(0, separator) || "opencode",
    password: decoded.slice(separator + 1),
  }
}

export function createSdkForServer({
  server,
  ...config
}: Omit<NonNullable<Parameters<typeof createOpencodeClient>[0]>, "baseUrl"> & {
  server: ServerConnection.HttpBase
}) {
  const auth = (() => {
    if (!server.password) return
    return {
      Authorization: `Basic ${authTokenFromCredentials({ username: server.username, password: server.password })}`,
    }
  })()

  return createOpencodeClient({
    ...config,
    headers: {
      ...(config.headers instanceof Headers ? Object.fromEntries(config.headers.entries()) : config.headers),
      ...auth,
    },
    baseUrl: server.url,
  })
}

export function createApiForServer(input: {
  server: ServerConnection.HttpBase
  fetch?: typeof globalThis.fetch
}): CurrentServerApi {
  const request = async (path: string, init?: RequestInit) => {
    const response = await (input.fetch ?? globalThis.fetch)(`${input.server.url.replace(/\/+$/, "")}${path}`, {
      ...init,
      headers: {
        ...(init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers),
        ...(input.server.password
          ? {
              Authorization: `Basic ${authTokenFromCredentials({
                username: input.server.username,
                password: input.server.password,
              })}`,
            }
          : {}),
      },
    })
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    return response
  }
  const client = OpenCode.make({
    baseUrl: input.server.url,
    fetch: input.fetch,
    headers: input.server.password
      ? {
          Authorization: `Basic ${authTokenFromCredentials({
            username: input.server.username,
            password: input.server.password,
          })}`,
        }
      : undefined,
  })
  return {
    ...client,
    session: {
      ...client.session,
      async promptCurrent(value) {
        const response = await request(`/api/session/${encodeURIComponent(value.sessionID)}/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: value.id,
            prompt: {
              text: value.text,
              files: value.files?.map((file) => ({
                uri: file.uri,
                name: file.name,
                source: file.mention,
              })),
              agents: value.agents?.map((agent) => ({ name: agent.name, source: agent.mention })),
              tools: value.tools,
            },
            delivery: value.delivery,
          }),
        })
        return ((await response.json()) as { data: Awaited<ReturnType<OpenCodeClient["session"]["prompt"]>> }).data
      },
      async commandCurrent(value) {
        const response = await request(`/api/session/${encodeURIComponent(value.sessionID)}/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: value.id,
            command: value.command,
            arguments: value.arguments,
            agent: value.agent,
            model: value.model,
            files: value.files,
            agents: value.agents,
            delivery: value.delivery,
            resume: value.resume,
            tools: value.tools,
          }),
        })
        return ((await response.json()) as { data: Awaited<ReturnType<OpenCodeClient["session"]["command"]>> }).data
      },
    },
    project: {
      ...client.project,
      async repositories(value: { directory: string }) {
        const query = new URLSearchParams({ "location[directory]": value.directory })
        const response = await request(`/api/project/repositories?${query}`)
        return (await response.json()) as Project.Repositories
      },
    },
  }
}

export type ServerApi = OpenCodeClient & {
  readonly project: OpenCodeClient["project"] & {
    readonly repositories: (input: { directory: string }) => Promise<Project.Repositories>
  }
}

export type CurrentServerApi = ServerApi & {
  readonly session: OpenCodeClient["session"] & {
    readonly promptCurrent: (
      input: Parameters<OpenCodeClient["session"]["prompt"]>[0] & {
        tools?: Record<string, boolean>
        files?: ReadonlyArray<{
          uri: string
          name?: string
          mention?: { start: number; end: number; text: string }
        }>
        agents?: ReadonlyArray<{
          name: string
          mention?: { start: number; end: number; text: string }
        }>
      },
    ) => ReturnType<OpenCodeClient["session"]["prompt"]>
    readonly commandCurrent: (
      input: Parameters<OpenCodeClient["session"]["command"]>[0] & { tools?: Record<string, boolean> },
    ) => ReturnType<OpenCodeClient["session"]["command"]>
  }
}
