// KoteCode ASCII wordmark glyphs.
//
// Encoding (shared with packages/opencode/src/cli/ui.ts draw()):
//   █  body fill
//   ▀  half-block top stroke
//   _  background (renders as blank) — also a sentinel mark
//   ^  top highlight sentinel (renders as ▀ in foreground)
//   ~  shadow sentinel (renders as dim ▀)
//   ,  accent sentinel (in `marks`, currently unused by draw)
//   :  literal underscore (used by the cat-ear silhouette)
// Keep these sentinel characters when editing the art — draw() keys off them.

export const logo = {
  left: ["  /\\:/\\            ", "█__█ █▀▀█ █▀▀█ █▀▀█", "█▀█_ █__█ _██_ █^^^", "█_▀█ ▀▀▀▀ _▀▀_ ▀▀▀▀"],
  right: ["                   ", "█▀▀▀ █▀▀█ █▀▀█ █▀▀█", "█___ █__█ █__█ █^^^", "▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀"],
}

export const go = {
  left: ["    ", "█▀▀▀", "█_^█", "▀▀▀▀"],
  right: ["    ", "█▀▀█", "█__█", "▀▀▀▀"],
}

export const marks = "_^~,:"
