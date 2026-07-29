import { useServerSync } from "@/context/server-sync"
import { providerRouting, withProviderRouting, type ProviderRouting } from "@/utils/provider-routing"
import { createStore } from "solid-js/store"

export function useProviderRouting() {
  const serverSync = useServerSync()
  const [pending, setPending] = createStore<Record<string, boolean>>({})

  return {
    get: (providerID: string) => providerRouting(serverSync().data.config, providerID),
    pending: (providerID: string) => !!pending[providerID],
    update: async (providerID: string, routing: ProviderRouting) => {
      const before = serverSync().data.config
      const next = withProviderRouting(before, providerID, routing)
      serverSync().set("config", "provider", next.provider)
      setPending(providerID, true)
      await serverSync()
        .updateConfig(withProviderRouting({} as typeof before, providerID, routing))
        .catch((error) => {
          serverSync().set("config", "provider", before.provider)
          throw error
        })
        .finally(() => setPending(providerID, false))
    },
  }
}
