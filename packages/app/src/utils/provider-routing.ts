import type { Config } from "@opencode-ai/sdk/v2/client"

export type ProviderRouting = "proxy" | "direct"

type ProviderConfig = NonNullable<Config["provider"]>[string] & {
  routing?: ProviderRouting
}

type RoutingConfig = Config & {
  provider?: Record<string, ProviderConfig>
}

export function providerRouting(config: Config, providerID: string): ProviderRouting {
  return (config as RoutingConfig).provider?.[providerID]?.routing === "direct" ? "direct" : "proxy"
}

export function withProviderRouting(config: Config, providerID: string, routing: ProviderRouting): Config {
  const current = config as RoutingConfig
  return {
    ...config,
    provider: {
      ...current.provider,
      [providerID]: {
        ...current.provider?.[providerID],
        routing,
      },
    },
  } as Config
}
