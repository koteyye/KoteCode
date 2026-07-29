import { Schema } from "effect"
import type { ResolveProxyResult } from "./bootstrap"

export const Mode = Schema.Literals(["proxy", "direct"])
export type Mode = typeof Mode.Type

export const Default: Mode = "proxy"
export const RequestKey = "koteProviderRouting"

export function read(value: unknown): Mode {
  return value === "direct" ? "direct" : Default
}

export function transport(mode: Mode, proxy: ResolveProxyResult): ResolveProxyResult {
  return mode === "direct" ? { source: "disabled" } : proxy
}

export * as ProviderRouting from "./provider-routing"
