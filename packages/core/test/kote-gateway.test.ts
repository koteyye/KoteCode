import { describe, expect, it } from "bun:test"
import { Gateway } from "../src/kote/gateway"

describe("Kote gateway selection", () => {
  it("returns only the selected custom proxy", () => {
    const info = {
      active: "proxy_work",
      proxies: [
        { id: "proxy_home", name: "Home", url: "http://localhost:8080" },
        { id: "proxy_work", name: "Work", url: "https://proxy.example.com:8443" },
      ],
    }

    expect(Gateway.active(info)).toEqual(info.proxies[1])
    expect(Gateway.customProxyUrl(info)).toBe("https://proxy.example.com:8443")
    expect(Gateway.active({ ...info, active: Gateway.BuiltinID })).toBeUndefined()
    expect(Gateway.active({ ...info, active: "missing" })).toBeUndefined()
  })
})
