# KoteCode v0.2.0

This release expands the V2 project and session experience across the KoteCode stack.

## Highlights

- Added V2 project APIs and generated SDK support for listing and updating projects, resolving the current
  project, listing its directories, and discovering child Git repositories.
- Grouped repositories now appear under their project root on the home screen. Opening a child repository
  keeps its exact repository and worktree in the new-session composer instead of falling back to the first
  project.
- Added a project indicator to the session composer and improved project-aware synchronization between the
  App, Desktop, Server, Client, and SDK layers.
- Expanded V2 session behavior, plan/build transitions, planning-plugin settings, and permission handling,
  with regression coverage across the affected packages.

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
