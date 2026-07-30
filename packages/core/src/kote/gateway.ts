export * as Gateway from "./gateway"

import { Schema } from "effect"

export const BuiltinID = "kote"

export const Proxy = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  url: Schema.String,
})
export type Proxy = typeof Proxy.Type

export const Info = Schema.Struct({
  active: Schema.optional(Schema.String),
  proxies: Schema.optional(Schema.mutable(Schema.Array(Proxy))),
})
export type Info = typeof Info.Type

export function active(info: Info | undefined): Proxy | undefined {
  if (!info?.active || info.active === BuiltinID) return undefined
  return info.proxies?.find((proxy) => proxy.id === info.active)
}

export function customProxyUrl(info: Info | undefined) {
  return active(info)?.url
}
