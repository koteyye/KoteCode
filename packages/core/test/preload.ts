import fs from "node:fs/promises"
import os from "node:os"
import path from "path"
import { afterAll } from "bun:test"

const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kotencode-core-test-"))
process.env.KOTECODE_DATA_DIR = path.join(directory, "share", "kotencode")
process.env.KOTECODE_CACHE_DIR = path.join(directory, "cache", "kotencode")
process.env.KOTECODE_CONFIG_DIR = path.join(directory, "config", "kotencode")
process.env.XDG_STATE_HOME = path.join(directory, "state")

afterAll(() => fs.rm(directory, { recursive: true, force: true }))

process.env.OPENCODE_DB = ":memory:"
process.env.OPENCODE_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.OPENCODE_DISABLE_MODELS_FETCH = "true"
process.env.KOTECODE_DISABLE_PROXY = "1"
