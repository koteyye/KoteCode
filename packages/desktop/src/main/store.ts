import Store from "electron-store"
import electron from "electron"
import { rmSync } from "node:fs"
import { join } from "node:path"

import { SETTINGS_STORE } from "./store-keys"
import { deleteStoreFileIfEmpty } from "./store-cleanup"

const cache = new Map<string, Store>()

// We cannot instantiate the electron-store at module load time because
// module import hoisting causes this to run before app.setPath("userData", ...)
// in index.ts has executed, which would result in files being written to the default directory
// (e.g. bad: %APPDATA%\@opencode-ai\desktop\opencode.settings vs good: %APPDATA%\ai.kotecode.desktop.dev\opencode.settings).
export function getStore(name = SETTINGS_STORE) {
  const cached = cache.get(name)
  if (cached) return cached
  const next = new Store({
    name,
    cwd: electron.app.getPath("userData"),
    fileExtension: "",
    accessPropertiesByDotNotation: false,
  })
  cache.set(name, next)
  return next
}

export async function removeStoreFileIfEmpty(name: string) {
  if (await deleteStoreFileIfEmpty(electron.app.getPath("userData"), name)) cache.delete(name)
}

export function removeStoreFile(name: string) {
  rmSync(join(electron.app.getPath("userData"), name), { force: true })
  cache.delete(name)
}

// electron-store (via atomically) performs a full atomic rewrite on every mutation:
// write temp file + fsync + renameSync(temp, target). On Windows, concurrent
// renameSync calls against the same target race with EPERM, and a fire-and-forget
// removeStoreFileIfEmpty (stat+read+rm) racing an in-flight set/delete can remove
// the file mid-rewrite. IPC handlers run concurrently on the main-process event
// loop, so writes to a given store file must be serialized.
const locks = new Map<string, Promise<unknown>>()

export function withStoreLock<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
  const tail = locks.get(name) ?? Promise.resolve()
  const run = tail.catch(() => undefined).then(fn)
  // The chain token never rejects, so one failed op does not poison the next.
  locks.set(
    name,
    run.catch(() => undefined),
  )
  return run
}
