# Building KoteCode

KoteCode builds from the OpenCode base with [Bun](https://bun.sh) ≥ 1.3. The build
produces a single self-contained binary per platform (via `Bun.build` `compile`).

## Prerequisites

- **Bun 1.3.14** (the version pinned in root `package.json` `packageManager`). Install:
  - macOS/Linux: `curl -fsSL https://bun.sh/install | bash`
  - Windows (PowerShell): `irm bun.sh/install.ps1 | iex`
- Git, and network access to `registry.npmjs.org` (the repo pins this registry in
  `bunfig.toml` so installs are reproducible regardless of machine-local mirrors).

## Install dependencies

```bash
bun install
```

This installs all workspace packages. `bunfig.toml` pins the registry to npmjs.org
so the lockfile stays clean.

## Local development (TUI)

```bash
bun dev                       # run the TUI from source (cwd = repo root)
bun dev <dir>                 # run against a specific project directory
```

## Type checking & lint

Run type checking from package directories:

```bash
cd packages/core     && bun run typecheck
cd packages/opencode && bun run typecheck
cd packages/tui      && bun run typecheck
```

> Never run `tsc` directly — the project uses `tsgo` (TypeScript native preview).

Linting is available from the repository root:

```bash
bun run lint
```

## Tests

Tests run **from package directories**, never from the repo root (the root `test`
script intentionally errors to enforce this):

```bash
cd packages/opencode && bun test --timeout 30000
cd packages/core     && bun test --timeout 30000
```

KoteCode bootstrap and Proxy transport tests:

```bash
cd packages/core     && bun test test/kote-bootstrap.test.ts test/kote-security.test.ts
cd packages/opencode && bun test test/provider/proxy.test.ts
```

## Build a single binary (release build)

```bash
./packages/opencode/script/build.ts --single
```

`--single` builds only the target matching the current OS/arch. Output:

```
packages/opencode/dist/kotecode-<os>-<arch>/bin/kotecode
```

Run it:

```bash
./packages/opencode/dist/kotecode-<os>-<arch>/bin/kotecode --version
```

`--version` prints both the KoteCode version and the OpenCode base, e.g.:

```
KoteCode v0.1.0
Based on OpenCode 1.18.5 (fork base 1.18.5 e5cc278)
```

## Build all release targets

```bash
./packages/opencode/script/build.ts
```

This builds all inherited targets (darwin/linux/win32 × arm64/x64 plus baseline and
musl variants). `--npm` selects the five published npm platform targets. The release
workflow builds each supported native target on its matching GitHub-hosted runner.

## Release artifacts (CI)

The draft release workflow `.github/workflows/kotecode-release.yml` builds five
CLI targets plus Windows/Linux Desktop. Manual dispatch is a dry run; a pushed
SemVer tag additionally creates a draft GitHub Release. See
[`../RELEASING.md`](../RELEASING.md) for the exact artifact list and approval flow.

> **Signing:** these artifacts are **unsigned**. Upstream OpenCode uses Azure
> Trusted Signing (Windows) and Apple codesigning, which are not available to
> this fork. Operating systems may show a "unverified publisher" warning. Signing
> signing keys are intentionally out of scope for `v0.1.0`.

## Signing a bootstrap config (project owner only)

The Kote Gateway origin is delivered via a signed bootstrap config. To produce
one (requires the private key, kept outside the repo — see
[`BOOTSTRAP.md`](./BOOTSTRAP.md)):

```bash
bun run scripts/sign-bootstrap.ts \
  --key /path/to/ed25519-private.key \
  --proxy-url https://kote-proxy.kotey-ye.ru \
  --days 30 \
  --out bootstrap.signed.json
```

Publish the signed JSON at your bootstrap HTTPS endpoint (default
`https://kote-bootstrap.kotey-ye.ru/bootstrap.json`, overridable via
`KOTECODE_BOOTSTRAP_URL`). The private key never enters the repo, build, CI logs,
or release artifacts.
