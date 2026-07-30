import path from "path"

export function abbreviateHome(input: string, home: string) {
  if (!home) return input
  const format = input.includes("\\") || home.includes("\\") ? path.win32 : path.posix
  const relative = format.relative(home, input)
  if (relative === "") return "~"
  if (relative === ".." || relative.startsWith(".." + format.sep) || format.isAbsolute(relative)) return input
  return "~" + format.sep + relative
}
