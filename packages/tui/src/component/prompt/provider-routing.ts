import { isRecord } from "../../util/record"

export function resolvePromptProviderRouting(config: unknown, providerID: string | undefined) {
  if (!providerID) return
  if (!isRecord(config) || !isRecord(config.provider)) return "proxy"
  const provider = config.provider[providerID]
  return isRecord(provider) && provider.routing === "direct" ? "direct" : "proxy"
}
