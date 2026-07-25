# Third-party notices

## KoteCode and OpenCode

**KoteCode is an independent fork of [OpenCode](https://github.com/anomalyco/opencode).**

KoteCode is not affiliated with, endorsed by, or officially connected to the OpenCode team.
It is a separate project that builds on OpenCode's source code, which is distributed under
the MIT License.

The OpenCode copyright notice and MIT license are preserved verbatim in [`LICENSE`](./LICENSE):

```
MIT License

Copyright (c) 2025 opencode

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Internal compatibility layer

To keep merges from upstream trivial, KoteCode intentionally retains OpenCode's **internal**
identifiers — npm package/workspace names (`@opencode-ai/*`), `OPENCODE_*` environment
variables, Effect service identifiers, internal types, and config file names. These are
**not** user-facing brand strings and are kept for technical compatibility, not to imply
affiliation. See [`docs/UPSTREAM.md`](./docs/UPSTREAM.md) for the full list of names that must
not be renamed.

## KoteCode additions

Code added by KoteCode on top of OpenCode is licensed under the same MIT License. Notable
KoteCode-only components:

- **Signed bootstrap configuration resolver** (`packages/core/src/kote/`) — fetches and
  Ed25519-verifies the Kote Gateway endpoint configuration. Uses the following dependency:

  - [`@noble/ed25519`](https://github.com/paulmillr/noble-curves) — MIT License.
    Used for signature verification only (no signing happens in the client).

- **Kote Gateway provider** — a provider case in `packages/opencode/src/provider/provider.ts`
  that routes requests to the bootstrap-resolved endpoint. No additional dependencies.

## Dependency licenses

KoteCode uses the same dependency tree as its OpenCode base (see `package.json` /
`bun.lock`). All transitive dependencies are MIT-, ISC-, Apache-2.0-, or BSD-licensed —
licenses compatible with MIT. No GPL/AGPL components are introduced by KoteCode.

If you add a dependency, verify its license is MIT-compatible and record it here if it is
copyleft or has notable attribution requirements.
