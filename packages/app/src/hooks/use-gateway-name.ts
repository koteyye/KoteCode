import { createMemo } from "solid-js"
import { useLanguage } from "@/context/language"
import { useServerSync } from "@/context/server-sync"
import { activeGatewayName } from "@/utils/gateway"

export function useGatewayName() {
  const language = useLanguage()
  const serverSync = useServerSync()
  return createMemo(() => activeGatewayName(serverSync().data.config, language.t("provider.routing.proxy.short")))
}
