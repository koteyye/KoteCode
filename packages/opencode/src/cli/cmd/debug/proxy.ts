import { EOL } from "os"
import { Effect } from "effect"
import { effectCmd, fail } from "../../effect-cmd"

export const ProxyCommand = effectCmd({
  command: "proxy",
  describe: "show Kote Proxy transport diagnostics",
  builder: (yargs) =>
    yargs.option("model", {
      type: "string",
      description: "Show the original provider host for provider/model",
    }),
  handler: Effect.fn("Cli.debug.proxy")(function* (args) {
    const { Provider } = yield* Effect.promise(() => import("@/provider/provider"))
    const provider = yield* Provider.Service
    const proxy = yield* provider.proxy()
    const requestedModel = args.model
    const model = requestedModel
      ? yield* Effect.gen(function* () {
          const parsed = Provider.parseModel(requestedModel)
          const info = yield* provider.getProvider(parsed.providerID)
          const selected = yield* provider
            .getModel(parsed.providerID, parsed.modelID)
            .pipe(Effect.catchTag("ProviderModelNotFoundError", (error) => fail(error.message)))
          const endpoint = typeof info.options.baseURL === "string" ? info.options.baseURL : selected.api.url
          return {
            provider: parsed.providerID,
            model: parsed.modelID,
            original_hostname: endpoint ? URL.parse(endpoint)?.hostname : undefined,
          }
        })
      : undefined

    process.stdout.write(
      JSON.stringify(
        {
          proxy: source(proxy.source),
          ...("url" in proxy
            ? {
                proxy_endpoint: proxy.url,
                proxy_hostname: URL.parse(proxy.url)?.hostname,
              }
            : {}),
          ...("reason" in proxy ? { reason: proxy.reason, hint: proxy.hint } : {}),
          ...(model ? { selected: model } : {}),
          direct_mode: "Set KOTECODE_DISABLE_PROXY=1 to bypass Kote Proxy explicitly.",
        },
        null,
        2,
      ) + EOL,
    )
  }),
})

function source(value: "disabled" | "environment" | "remote" | "cache" | "none") {
  if (value === "remote") return "remote bootstrap"
  if (value === "cache") return "cached bootstrap"
  return value
}
