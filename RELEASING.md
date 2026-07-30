# Releasing KoteCode

KoteCode releases are tag-driven, but no tag-triggered workflow publishes irreversible state.
Pushing a tag builds, tests, verifies, and creates a **draft** GitHub Release. Publishing requires a
separate manual workflow, an exact confirmation phrase, and approval in the protected `release`
environment.

## 1. One-time owner setup

1. Confirm and reserve the npm names:
   - `kotecode`
   - `@kotecode-ai/darwin-arm64`
   - `@kotecode-ai/darwin-x64`
   - `@kotecode-ai/linux-arm64`
   - `@kotecode-ai/linux-x64`
   - `@kotecode-ai/windows-x64`
2. Create a GitHub Environment named `release`.
3. Add the owner as a required reviewer for that environment. Restrict deployment branches/tags to
   protected release tags if the repository plan supports it.
4. Enable npm Trusted Publishing for every package above:
   - owner/repository: `koteyye/KoteCode`
   - workflow: `kotecode-publish.yml`
   - environment: empty (the approval gate is the preceding `publish-release` job)
   - allowed action: `npm publish`
5. If npm requires the first version of a new package to be created manually, run the dry-run packaging
   step, inspect each tarball, publish the first version from an owner-controlled machine, and then enable
   Trusted Publishing for subsequent versions. Never add a long-lived `NPM_TOKEN`.
6. Add repository secret `HOMEBREW_TAP_TOKEN`. It must be a fine-grained token limited to
   `koteyye/homebrew-tap`, with Contents read/write and Pull requests read/write. A GitHub App with the
   same minimal permissions may replace this token later.
7. Protect release tags (`v*`) and limit who can create them.
8. Keep Actions permissions at the workflow defaults. Do not enable broad write permissions globally.

No Windows or Apple signing secret is required for `v0.1.0`.

## 2. Version and channel rules

The Git tag is the single release version source:

- `v0.1.0` → stable GitHub Release, npm tag `latest`, Homebrew PR.
- `v0.2.0-beta.1` → GitHub prerelease, npm tag `beta`, no Homebrew PR.
- `v0.1.0-test.1` → dry-run/test prerelease; never publish it under npm tag `latest`.

The workflow strips `v`, requires exact SemVer, and injects the result into CLI, Desktop, npm manifests,
GitHub Release metadata, updater metadata, and the generated Homebrew Formula.

## 3. Local checks

Run checks from package directories, never from the repository root:

```bash
cd packages/core && bun typecheck && bun test --timeout 30000
cd ../opencode && bun typecheck && bun test --timeout 30000
cd ../app && bun typecheck && bun test --timeout 30000
cd ../desktop && bun typecheck && bun test --timeout 30000
cd ../tui && bun typecheck && bun test --timeout 30000
```

Validate release tooling and build the current host CLI:

```bash
bun run release:validate 0.1.0-test.1
KOTECODE_VERSION=0.1.0-test.1 KOTECODE_CHANNEL=beta \
  bun run packages/opencode/script/build.ts --single
```

On x64 release hosts, add `--baseline`. The official x64 artifacts intentionally use Bun baseline builds
so older x64 CPUs are supported without publishing a second user-facing archive.

On Windows, set `BUN_INSTALL_CACHE_DIR` to a directory on the checkout drive before starting Bun. Bun
cannot move a downloaded compile runtime atomically between drives:

```powershell
$env:BUN_INSTALL_CACHE_DIR = Join-Path (Get-Location) ".bun-runtime-cache"
```

The release workflows set this automatically.

## 4. CI dry run

Run **KoteCode release candidate** with `workflow_dispatch` and a version such as `0.1.0-test.1`.
Manual dispatch performs the full tests and five CLI plus Windows/Linux Desktop builds, creates
`SHA256SUMS`, validates the release bundle, and generates a Homebrew Formula artifact. It does not create
or publish a GitHub Release.

Download and inspect:

- `release-assets-v0.1.0-test.1`
- `homebrew-formula-v0.1.0-test.1` is intentionally absent because prereleases do not update Homebrew.

For a stable dry run, dispatch version `0.1.0` before creating the tag; the Formula is generated as a CI
artifact but no external repository is changed.

## 5. Required smoke tests before the real tag

Use two test versions (for example `v0.1.0-test.1` and `v0.1.0-test.2`) without publishing `latest`.
Record results for:

- CLI `--version` and `--help` on every supported OS/architecture;
- npm global install/uninstall on Windows, Linux, and macOS;
- Homebrew audit/install/test/uninstall against a temporary tap branch;
- clean Windows install, test-version upgrade, portable archive, and uninstall;
- Linux AppImage extraction/launch, `.deb` install/remove, and `.rpm` install/remove;
- persisted settings across Desktop updates;
- offline update-check failure;
- stable-to-beta isolation and downgrade refusal;
- absence of macOS Desktop assets and OpenCode update-feed requests.

Windows SmartScreen and enterprise-policy behavior cannot be made reliable without a trusted certificate;
record the warning or block as an expected `v0.1.0` limitation.

## 6. Create the tag

Make sure the intended commit and CI are green, then the owner runs:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The tag workflow:

1. validates the tag and checks GitHub/npm for an existing version;
2. runs package typechecks and tests;
3. builds and smoke-tests CLI artifacts;
4. builds unsigned Windows and Linux Desktop artifacts;
5. verifies package structure and calculates `SHA256SUMS`;
6. creates a draft GitHub Release without `--clobber`.

## 7. Review the draft

Before approval, show and review:

```bash
gh release view v0.1.0 --json isDraft,isPrerelease,assets
gh release download v0.1.0 --dir artifacts
bun run release:verify artifacts
```

The owner must compare the exact file list with the list in section 14, review `SHA256SUMS`, confirm smoke
test results, and acknowledge the unsigned Windows warning.

## 8. Publish after owner approval

Run **Publish approved KoteCode release** manually with:

- `tag`: `v0.1.0`
- `confirmation`: `PUBLISH v0.1.0`

Approve the `release` environment deployment. The workflow then executes, in order:

1. `gh release edit v0.1.0 --draft=false`
2. rebuild and dry-run the npm packages from the tag;
3. publish platform packages and `kotecode` with npm OIDC/provenance;
4. smoke-test `npm install -g kotecode@0.1.0`;
5. for stable releases only, open a PR in `koteyye/homebrew-tap`.

Do not run the publish workflow until the npm scope and Trusted Publisher entries are confirmed.

## 9. Homebrew verification

After the generated PR is merged:

```bash
brew update
brew audit --strict koteyye/tap/kotecode
brew install koteyye/tap/kotecode
brew test koteyye/tap/kotecode
brew uninstall koteyye/tap/kotecode
```

The Formula uses only KoteCode GitHub Release archives and SHA-256 values from the published
`SHA256SUMS`. `v0.1.0` has no Homebrew Cask.

## 10. Hotfix

Prepare the fix on the normal branch, repeat dry run and smoke tests, then tag the next patch:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Never move or reuse a published tag and never overwrite published assets.

## 11. Beta channel

Use a SemVer prerelease tag such as:

```bash
git tag v0.2.0-beta.1
git push origin v0.2.0-beta.1
```

The draft is marked prerelease, Desktop metadata uses `beta`, npm publishes with `--tag beta`, and the
Homebrew job is skipped. Stable clients use `latest` and cannot update to beta.

## 12. npm dist-tag rollback

Changing a dist-tag is an owner-only recovery action and is not automated:

```bash
npm dist-tag ls kotecode
npm dist-tag add kotecode@0.1.0 latest
npm dist-tag rm kotecode beta
```

Run these only after inspecting every platform package version. A dist-tag rollback does not delete or
rewrite an npm version.

## 13. Future signing and macOS Desktop

Windows identity is stable now: product `KoteCode`, executable `KoteCode.exe`, app ID
`ai.kotecode.desktop`, update repository `koteyye/KoteCode`, and the KoteCode user-data directory.
When a trusted certificate is available:

1. add Azure Trusted Signing credentials to the protected `release` environment;
2. add an Azure login/sign step to the Windows job;
3. set `KOTECODE_WINDOWS_SIGNING=true`;
4. verify Authenticode on the installer and downloaded updater before publishing.

Expected future secret names:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`
- `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE`
- `AZURE_TRUSTED_SIGNING_ENDPOINT`

Do not use a self-signed certificate for a public release.

macOS Desktop remains excluded. Adding it later requires a stable bundle ID, Apple Developer certificate,
notarization, `latest-mac.yml`, signed updater testing, and a separate Homebrew Cask decision. None of
those assets may be added to `v0.1.0`.

## 14. Expected `v0.1.0` release files

```text
kotecode-windows-x64.zip
kotecode-linux-x64.zip
kotecode-linux-arm64.zip
kotecode-darwin-arm64.zip
kotecode-darwin-x64.zip
KoteCode-desktop-windows-x64-setup.exe
KoteCode-desktop-windows-x64-setup.exe.blockmap
KoteCode-desktop-windows-x64-portable.zip
KoteCode-desktop-linux-x64.AppImage
KoteCode-desktop-linux-x64.deb
KoteCode-desktop-linux-x64.rpm
latest.yml
latest-linux.yml
SHA256SUMS
```

Windows ARM64 CLI and all Desktop ARM64 builds are not claimed as supported until their complete native
dependency set passes smoke tests on the corresponding GitHub-hosted ARM64 runner.
