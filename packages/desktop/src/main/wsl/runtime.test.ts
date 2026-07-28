import { expect, test } from "bun:test"
import { WSL_DISABLED_MESSAGE } from "../constants"
import { installWslOpencode, resolveWslOpencode } from "./runtime"

test("WSL OpenCode paths fail closed while KoteCode alpha support is disabled", async () => {
  expect(await resolveWslOpencode("test-distro")).toBe("")
  await expect(installWslOpencode("1.18.5", "test-distro")).rejects.toThrow(WSL_DISABLED_MESSAGE)
})
