# Upstream sync strategy (OpenCode → KoteCode)

This document explains how to pull changes from upstream OpenCode into the KoteCode fork,
how to resolve the expected branding conflicts, and which internal names must **never** be
renamed.

For the fork base and version record, see [`../UPSTREAM_STATE.md`](../UPSTREAM_STATE.md).
For the audit that motivates this strategy, see [`FORK_AUDIT.md`](./FORK_AUDIT.md).

---

## 1. Remotes

```
origin   https://github.com/koteyye/KoteCode.git       (this fork)
upstream https://github.com/anomalyco/opencode.git      (official OpenCode)
```

`upstream` is already configured. If it is missing, recreate it:

```bash
git remote add upstream https://github.com/anomalyco/opencode.git
git fetch upstream --tags
```

OpenCode's default branch is **`dev`** (not `main`).

## 2. Pulling changes from upstream

The fork keeps full upstream history, so `git merge` is the right tool (not rebase — rebase
would rewrite the KoteCode commits and make every future sync harder).

```bash
# 1. Make sure you are on the KoteCode integration branch
git checkout feat/kotecode-bootstrap   # or your integration branch

# 2. Fetch the latest upstream
git fetch upstream --tags

# 3. Merge upstream's dev branch
git merge upstream/dev
```

Expect conflicts **only** in the files listed in §3. Everything else should merge cleanly
because the public rebrand is localized to a small set of single-constant touchpoints and the
Kote Gateway / bootstrap code lives in new files that upstream does not touch.

### Resolving branding conflicts

When upstream changes a file that KoteCode has rebranded:

1. Take **upstream's** version of the logic/behavior.
2. Re-apply the **KoteCode** branding change on top (see [`FORK_AUDIT.md`](./FORK_AUDIT.md) §4
   for the exact, minimal change at each point — it is usually a single string constant).
3. Do **not** reintroduce `opencode` strings in user-visible surfaces.

Example: if upstream edits `packages/core/src/global.ts`, keep the upstream logic but ensure
`const app = "kotencode"` and the `KOTECODE_CONFIG_DIR` override remain.

### Pushing

After the merge builds and tests pass (§5), push to `origin`. KoteCode is published from
`origin`; upstream is read-only for this fork.

## 3. Files expected to differ from upstream

These are the **only** files that will routinely conflict on merge. A conflict here is normal
and expected. The merge procedure is "take upstream logic, keep KoteCode brand."

**Branding (single-constant touchpoints):**

- `packages/core/src/global.ts` — app dir name `kotencode`, `KOTECODE_CONFIG_DIR` override
- `packages/opencode/src/index.ts` — `scriptName("kotencode")`, `--help` prefix, version display
- `packages/tui/src/logo.ts` — KoteCode ASCII logo glyphs
- `packages/opencode/src/cli/ui.ts` — KoteCode non-TTY wordmark
- `packages/core/src/installation/version.ts` — KoteCode version composition
- `packages/core/src/models-dev.ts` — `kotencode` User-Agent
- `packages/opencode/src/provider/provider.ts` — KoteCode provider attribution headers + the `kote-gateway` case
- `packages/opencode/package.json` — `name: "kotencode"`, `bin`, `version`
- `packages/opencode/bin/kotencode` — launcher and `kotencode-*` package names
- `packages/opencode/script/build.ts` — outfile `kotencode`, KoteCode User-Agent in `execArgv`
- `package.json` (root) — name/description/repository
- `packages/desktop/package.json`, `packages/desktop/electron-builder.config.ts`,
  `packages/desktop/src/main/{constants,index,logging,server,windows}.ts`, and
  `packages/desktop/src/main/wsl/{ipc,runtime}.ts` — desktop identity, isolated
  runtime data, and alpha WSL safety lock
- `install` — KoteCode installer
- `README.md` — KoteCode README

**KoteCode additions (new files upstream does not have — no conflict, but keep them):**

- `packages/core/src/kote/` — bootstrap resolver, signature verification, last-known-good cache
- `packages/core/src/flag/flag.ts` — `KOTECODE_*` entries (additive; should not conflict unless upstream rewrites the file)
- `packages/opencode/src/cli/cmd/migrate.ts` — `kotencode migrate-from-opencode`
- `scripts/sign-bootstrap.ts`, `.github/workflows/kotecode-release.yml`
- `docs/*` (this directory), `UPSTREAM_STATE.md`, `THIRD_PARTY_NOTICES.md`

## 4. Names that must NEVER be renamed

The KoteCode rebrand is **public-only**. The internal compatibility layer stays on the
OpenCode names so that upstream merges stay trivial and the MIT attribution is preserved. Do
**not** mass-rename any of the following:

- **npm package names / workspace names:** `@opencode-ai/*` (`@opencode-ai/core`,
  `@opencode-ai/plugin`, `@opencode-ai/sdk`, `@opencode-ai/desktop`, …).
- **`OPENCODE_*` environment variables:** keep all of them working. `KOTECODE_*` vars are
  **additive** and layered on top, not replacements.
- **Compile-time defines:** `OPENCODE_VERSION`, `OPENCODE_CHANNEL`, `OPENCODE_LIBC` (injected by
  `build.ts`; consumed by `installation/version.ts`). The `version.ts` module composes the
  KoteCode version string on top of these, it does not remove them.
- **Effect service identifiers:** e.g. `"@opencode/Global"`, `"@opencode/Provider"`.
- **Internal types and symbols:** `ProviderV2`, `ModelV2`, `ConfigV1`, `ModelsDev`, etc.
- **Config file names:** `opencode.json`/`opencode.jsonc` and the `.opencode/` project dir are
  read as-is for OpenCode compatibility (KoteCode also accepts `kotencode.*`).
- **Copyright notice in `LICENSE`:** `Copyright (c) 2025 opencode` stays verbatim (MIT requirement).

Renaming any of the above would balloon the diff, break upstream merges, and — for the license
notice — violate MIT. There is no technical reason to rename them; none of these reach the user
in a way the brand requires.

## 5. Running checks after an upstream sync

From the repo root (requires Bun ≥ 1.3):

```bash
bun install                  # refresh deps (use --frozen-lockfile in CI)
bun typecheck                # turbo typecheck across packages
bun run lint                 # oxlint
```

Tests must run from package directories (the root `test` script intentionally errors):

```bash
cd packages/opencode && bun test --timeout 30000
cd packages/core    && bun test --timeout 30000
```

Build a single binary to confirm the pipeline (per [`BUILD.md`](./BUILD.md)):

```bash
./packages/opencode/script/build.ts --single
```

Then run the KoteCode-specific checks:

```bash
# Branding & bootstrap tests (per docs/BUILD.md and the test plan in the spec)
cd packages/core    && bun test src/kote
cd packages/opencode && bun test src/kote
```

If the merge changes upstream's provider registry or version plumbing, re-verify the
[`FORK_AUDIT.md`](./FORK_AUDIT.md) §4/§8 touchpoints are still branded as KoteCode.

## 6. Updating the fork-base record

When you sync to a newer upstream commit, update [`../UPSTREAM_STATE.md`](../UPSTREAM_STATE.md)
with the new tag/SHA/version/date and commit it as part of the upstream-sync commit. This keeps
"what is KoteCode based on?" a single source of truth.
