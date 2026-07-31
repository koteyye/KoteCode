# KoteCode release

This release contains:

- KoteCode CLI for Windows x64, Linux x64/ARM64, and macOS Intel/Apple Silicon;
- KoteCode Desktop for Windows x64, Linux x64, and macOS Intel/Apple Silicon;
- npm and Homebrew installation support;
- `latest`/`beta` update metadata for Windows and Linux Desktop.

Windows CLI and Desktop artifacts are unsigned. Windows may show an unknown-publisher or SmartScreen warning,
and Smart App Control or corporate policy may block them. macOS Desktop is also unsigned and unnotarized, so
Gatekeeper may block it. Verify downloads against `SHA256SUMS`.

The macOS Desktop DMG and ZIP are manual-download artifacts; automatic macOS Desktop updates are not enabled
in this release.
