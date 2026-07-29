import { describe, expect, test } from "bun:test"
import type { Config } from "@opencode-ai/sdk/v2/client"
import {
  KOTE_GATEWAY_ID,
  activeGatewayName,
  displayGatewayProxyUrl,
  gatewayConfig,
  normalizeGatewayProxyUrl,
  withGateway,
} from "./gateway"

describe("gateway settings", () => {
  test("defaults to Kote Gateway", () => {
    expect(gatewayConfig({} as Config)).toEqual({ active: KOTE_GATEWAY_ID, proxies: [] })
    expect(activeGatewayName({} as Config, "Kote Gateway")).toBe("Kote Gateway")
    expect(gatewayConfig({ gateway: { active: "missing", proxies: [] } } as Config).active).toBe(KOTE_GATEWAY_ID)
  })

  test("uses the active custom proxy name", () => {
    const config = withGateway({} as Config, {
      active: "proxy_work",
      proxies: [
        { id: "proxy_home", name: "Home", url: "http://localhost:8080" },
        { id: "proxy_work", name: "Work", url: "https://proxy.example.com:8443" },
      ],
    })

    expect(activeGatewayName(config, "Kote Gateway")).toBe("Work")
  })

  test("normalizes supported origins and hides credentials for display", () => {
    expect(normalizeGatewayProxyUrl(" http://user:secret@proxy.example.com:8080/ ")).toBe(
      "http://user:secret@proxy.example.com:8080",
    )
    expect(displayGatewayProxyUrl("http://user:secret@proxy.example.com:8080")).toBe("http://proxy.example.com:8080")
    expect(normalizeGatewayProxyUrl("socks5://proxy.example.com")).toBeUndefined()
    expect(normalizeGatewayProxyUrl("https://proxy.example.com/path")).toBeUndefined()
  })
})
