import { useLanguage } from "@/context/language"
import type { ProviderRouting } from "@/utils/provider-routing"
import type { Component } from "solid-js"
import { useGatewayName } from "@/hooks/use-gateway-name"

export const ProviderRoutingSwitch: Component<{
  value: ProviderRouting
  disabled?: boolean
  compact?: boolean
  v2?: boolean
  onChange: (value: ProviderRouting) => void
}> = (props) => {
  const language = useLanguage()
  const gatewayName = useGatewayName()
  const proxy = () => props.value === "proxy"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={proxy()}
      aria-label={language.t("provider.routing.label")}
      disabled={props.disabled}
      class={
        props.v2
          ? "group flex items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] font-[440] leading-4 text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-2 focus-visible:outline-v2-border-border-focus disabled:opacity-50"
          : "group flex items-center gap-2 rounded-md px-2 py-1 text-left text-12-regular text-text-weak hover:bg-surface-base-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus disabled:opacity-50"
      }
      onClick={() => props.onChange(proxy() ? "direct" : "proxy")}
    >
      <span
        class={
          props.v2
            ? "relative h-4 w-7 shrink-0 rounded-full border border-v2-border-border-base bg-v2-background-bg-layer-03 transition-colors data-[checked=true]:border-v2-border-border-focus data-[checked=true]:bg-v2-background-bg-accent"
            : "relative h-4 w-7 shrink-0 rounded-full border border-border-base bg-surface-base transition-colors data-[checked=true]:border-border-focus data-[checked=true]:bg-surface-brand-base"
        }
        data-checked={proxy()}
      >
        <span
          class={
            props.v2
              ? "absolute left-0.5 top-0.5 size-2.5 rounded-full bg-v2-icon-icon-muted transition-transform data-[checked=true]:translate-x-3 data-[checked=true]:bg-v2-icon-icon-contrast"
              : "absolute left-0.5 top-0.5 size-2.5 rounded-full bg-icon-weak-base transition-transform data-[checked=true]:translate-x-3 data-[checked=true]:bg-icon-on-brand-base"
          }
          data-checked={proxy()}
        />
      </span>
      <span class={props.compact ? "whitespace-nowrap" : "flex min-w-0 flex-col"}>
        <span class={props.v2 ? "text-v2-text-text-base" : "text-text-base"}>
          {proxy() ? gatewayName() : language.t("provider.routing.direct.short")}
        </span>
        <span classList={{ hidden: !!props.compact }}>
          {language.t(proxy() ? "provider.routing.proxy.description" : "provider.routing.direct.description")}
        </span>
      </span>
    </button>
  )
}
