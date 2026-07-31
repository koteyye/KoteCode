# KoteCode v0.1.0 release audit

## Existing components reused

- `packages/opencode/script/build.ts` already compiled self-contained Bun executables for Windows, Linux,
  and macOS, including ARM64 and baseline x64 targets.
- The upstream npm model already separated the launcher from platform binaries.
- Electron, electron-builder, NSIS, AppImage, deb, rpm, and electron-updater already existed in
  `packages/desktop`.
- CLI installation detection and `upgrade` already existed, as did the Desktop updater controller.

## Upstream infrastructure that could not be reused directly

- `.github/workflows/publish.yml` is guarded for `anomalyco/opencode` and depends on Blacksmith runners,
  an upstream GitHub App, Azure Trusted Signing, Apple certificates/notarization, Sentry credentials,
  AUR, Docker, and upstream release repositories.
- The inherited CLI update endpoints, npm name, Homebrew tap, install URL, Scoop, and Chocolatey entries
  pointed to OpenCode.
- The old npm postinstall still looked for `opencode-*` packages and an `opencode` binary.
- Desktop signing ran automatically on GitHub Actions, which blocked an unsigned fork build.
- The fork-only release workflow covered three CLI targets and no Desktop, npm, Homebrew, updater
  metadata, or checksums.

## Adaptations made for KoteCode

- Public command, package, archives, profile directory, protocol, and documentation use `kotecode`.
- Release version comes from the Git tag and is injected into CLI, Desktop, npm, release/updater metadata,
  and the generated Formula.
- x64 CLI release archives use baseline builds for older CPU compatibility.
- npm uses `kotecode` plus fork-owned platform packages and OIDC Trusted Publishing.
- CLI upgrades use only KoteCode npm, `koteyye/tap/kotecode`, or checksum-verified KoteCode Releases.
- Startup update checks are notification-only, cached for 24 hours, time-bounded, and optional.
- Desktop points to `koteyye/KoteCode`, disallows downgrade, separates stable/beta, and supports NSIS plus
  AppImage updates. deb/rpm installs notify and link to Releases instead of replacing managed files.
- Windows signing is optional and disabled for `v0.1.0`; macOS Desktop is built for Intel and Apple Silicon
  without signing, notarization, or updater metadata.
- Install scripts verify `SHA256SUMS`, avoid automatic sudo, and replace binaries atomically.
- The KoteCode GitHub Action uses the workflow token by default and does not publish session shares to
  inherited OpenCode services.
- Tag builds create only a draft. An exact manual confirmation and protected environment approval gate
  GitHub/npm/Homebrew publication.

## Internal names intentionally preserved

- Workspace package scopes such as `@opencode-ai/core`, `@opencode-ai/protocol`, and
  `@opencode-ai/server`.
- Compatibility environment variables and compile-time defines under `OPENCODE_*`.
- OpenCode-compatible config filenames and protocol aliases where required for migration.
- Internal service IDs and server usernames used by inherited protocol and storage code.
- The upstream base version in `kotecode --version` for attribution and debugging.

These are not release/update identities and renaming them would increase merge and compatibility risk.

## Distribution decisions

- Supported CLI: Windows x64, Linux x64/ARM64, macOS Intel/Apple Silicon.
- Supported Desktop: Windows x64, Linux x64, and macOS Intel/Apple Silicon.
- Unsupported in `v0.1.0`: Windows ARM64 CLI, Windows/Linux Desktop ARM64, Homebrew Cask, macOS Desktop
  auto-update, MSIX, Microsoft Store, Scoop, Chocolatey, AUR, and automatic Nix publication.
- Sentry upload is inactive because KoteCode workflows provide no Sentry credentials. OpenTelemetry
  remains user-configured; release/update code adds no telemetry.

## Remaining owner actions and risks

- Confirm ownership of the `@kotecode-ai` npm scope and create the first packages if npm requires a
  manual bootstrap publication.
- Configure npm Trusted Publishers, the protected `release` environment, tag protection, and the
  fine-grained Homebrew tap token.
- Cross-target CLI builds, npm pack dry runs, Windows Desktop packaging, and local Windows install/upgrade
  smokes passed. Run native Linux/macOS CLI, Linux Desktop install/upgrade/uninstall, and macOS Desktop
  launch/removal smokes before `v0.1.0`.
- Unsigned Windows artifacts can be warned about or blocked by SmartScreen, Smart App Control, or
  enterprise policy. Unsigned and unnotarized macOS artifacts can be blocked by Gatekeeper.
- GitHub-hosted ARM64 labels currently include public-preview Linux/Windows offerings; Linux ARM64 must
  remain in the matrix and pass before being claimed. Windows ARM64 remains excluded.
- Homebrew checksums cannot be final until CI has produced the exact release archives; the Formula is
  generated from `SHA256SUMS` and sent as a PR only after publication approval.
