import type { ResolveProxyResult } from "./bootstrap"
import { ProxyAgent } from "undici"

type FetchInput = Parameters<typeof globalThis.fetch>[0]
type FetchInit = Parameters<typeof globalThis.fetch>[1]

const agents = new Map<string, ProxyAgent>()

export class ProxyUnavailableError extends Error {
  constructor(result: Extract<ResolveProxyResult, { source: "none" }>) {
    super(`Kote Proxy is unavailable: ${result.reason}${result.hint ? " — " + result.hint : ""}`)
    this.name = "ProxyUnavailableError"
  }
}

export class ProxyTargetError extends Error {
  constructor(value: string) {
    const url = URL.parse(value)
    const target = url ? `${url.protocol}//${url.host}` : "an invalid provider URL"
    super(`Kote Proxy only supports HTTPS provider requests; refusing direct request to ${target}`)
    this.name = "ProxyTargetError"
  }
}

export function proxyForRequest(input: FetchInput, result: ResolveProxyResult): string | undefined {
  const value = input instanceof Request ? input.url : input instanceof URL ? input.href : input
  if (result.source === "disabled") return undefined
  const url = URL.parse(value)
  if (url?.protocol === "http:" && isLoopback(url.hostname)) return undefined
  if (url?.protocol !== "https:") throw new ProxyTargetError(value)
  if (result.source === "none") throw new ProxyUnavailableError(result)
  return result.url
}

export function proxyRequestInit(input: FetchInput, init: BunFetchRequestInit | undefined, result: ResolveProxyResult) {
  const proxy = proxyForRequest(input, result)
  return {
    ...init,
    ...(proxy ? { proxy } : {}),
  }
}

export function proxyFetch(fetchFn: typeof globalThis.fetch, result: ResolveProxyResult): typeof globalThis.fetch {
  return Object.assign(
    (input: FetchInput, init?: FetchInit) => {
      const proxy = proxyForRequest(input, result)
      if (!proxy) return fetchFn(input, init)
      if (typeof Bun !== "undefined") return fetchFn(input, { ...init, proxy })
      const options = {
        ...init,
        dispatcher: proxyAgent(proxy),
      }
      return fetchFn(input, options as unknown as NonNullable<FetchInit>)
    },
    { preconnect: fetchFn.preconnect },
  )
}

function proxyAgent(url: string) {
  const existing = agents.get(url)
  if (existing) return existing
  const agent = new ProxyAgent(url)
  agents.set(url, agent)
  return agent
}

function isLoopback(hostname: string) {
  const host = hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return true
  if (host === "[::1]") return true
  return /^127(?:\.\d{1,3}){3}$/.test(host)
}
