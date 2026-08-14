# KoteCode v0.2.1

This patch release improves Desktop UI stability, project discovery, and session loading performance.

## Highlights

- Restored grouped repository discovery for the bundled Desktop server while preserving compatibility with
  legacy and remote servers.
- Fixed project close and reopen actions that could leave stale rows or an unresponsive context menu on the
  home screen.
- Reduced the delay when opening sessions by reusing cached session metadata, starting message loading before
  navigation, avoiding background synchronization for inactive tabs, and removing duplicate catalog requests.
- Reduced main-thread and storage work by incrementally retaining the home session index, consolidating
  timeline projections, and excluding image data URLs from persisted prompt history and draft snapshots.
- Localized the new-session prompt placeholder and corrected the Desktop settings version so it reports the
  installed application version.
- Added regression coverage for grouped project lifecycle, cold session opening, prompt persistence, catalog
  refreshes, timeline projection, and localized prompt text.

## Downloads

- KoteCode CLI for Windows x64, Linux x64/ARM64, and macOS Intel/Apple Silicon;
- KoteCode Desktop for Windows x64, Linux x64, and macOS Intel/Apple Silicon;
- npm and Homebrew installation support;
- `latest`/`beta` update metadata for Windows and Linux Desktop.

Windows CLI and Desktop artifacts are unsigned. Windows may show an unknown-publisher or SmartScreen warning,
and Smart App Control or corporate policy may block them. macOS Desktop is also unsigned and unnotarized, so
Gatekeeper may block it. Verify downloads against `SHA256SUMS`.

The macOS Desktop DMG and ZIP are manual-download artifacts; automatic macOS Desktop updates are not enabled
in this release.
