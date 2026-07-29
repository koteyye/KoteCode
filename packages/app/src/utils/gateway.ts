import type { Config } from "@opencode-ai/sdk/v2/client"

export const KOTE_GATEWAY_ID = "kote"

export type GatewayConfig = NonNullable<Config["gateway"]>
export type GatewayProxy = NonNullable<GatewayConfig["proxies"]>[number]

export function gatewayConfig(config: Config): Required<GatewayConfig> {
  const proxies = config.gateway?.proxies ?? []
  const active = config.gateway?.active
  return {
    active:
      !active || active === KOTE_GATEWAY_ID || !proxies.some((proxy) => proxy.id === active) ? KOTE_GATEWAY_ID : active,
    proxies,
  }
}

export function activeGatewayProxy(config: Config): GatewayProxy | undefined {
  const gateway = gatewayConfig(config)
  if (gateway.active === KOTE_GATEWAY_ID) return undefined
  return gateway.proxies.find((proxy) => proxy.id === gateway.active)
}

export function activeGatewayName(config: Config, fallback: string) {
  return activeGatewayProxy(config)?.name ?? fallback
}

export function withGateway(config: Config, gateway: GatewayConfig): Config {
  return {
    ...config,
    gateway,
  }
}

export function normalizeGatewayProxyUrl(value: string): string | undefined {
  const url = URL.parse(value.trim())
  if (!url) return undefined
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
  if (url.pathname !== "/" || url.search || url.hash) return undefined
  const credentials = url.username || url.password ? `${url.username}${url.password ? `:${url.password}` : ""}@` : ""
  return `${url.protocol}//${credentials}${url.host}`
}

export function displayGatewayProxyUrl(value: string) {
  const url = URL.parse(value)
  if (!url) return value
  url.username = ""
  url.password = ""
  return url.origin
}
