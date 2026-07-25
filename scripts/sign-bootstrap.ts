#!/usr/bin/env bun
//
// sign-bootstrap.ts — sign a Kote Gateway bootstrap configuration.
//
// USAGE (run from the repo root, with Bun):
//
//   bun run scripts/sign-bootstrap.ts \
//     --key /path/to/ed25519-private.key \
//     --base-url https://gw.example.kote/api/v1 \
//     --models-url https://gw.example.kote/api/v1/models \
//     --days 30 \
//     > bootstrap.signed.json
//
// The private key path defaults to the KOTE_BOOTSTRAP_PRIVATE_KEY env var.
// The key file MUST live OUTSIDE this repo (see docs/BOOTSTRAP.md) and must
// never be committed, shipped in the build, printed in CI logs, or included in
// release artifacts.
//
// This script depends on the same @noble/ed25519 used by the client verifier, so
// the signed output is byte-compatible with packages/core/src/kote/bootstrap.ts.

import { readFileSync, writeFileSync } from "node:fs"
import { signConfig, verifyConfig, type BootstrapConfig } from "../packages/core/src/kote/bootstrap"

interface Args {
  keyPath: string
  baseUrl: string
  modelsUrl?: string
  days: number
  out?: string
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { days: 30 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    switch (a) {
      case "--key":
        args.keyPath = next()
        break
      case "--base-url":
        args.baseUrl = next()
        break
      case "--models-url":
        args.modelsUrl = next()
        break
      case "--days":
        args.days = Number(next())
        break
      case "--out":
        args.out = next()
        break
      case "-h":
      case "--help":
        console.log(`sign-bootstrap.ts — sign a Kote Gateway bootstrap config

Options:
  --key <path>        path to the Ed25519 private key (or set KOTE_BOOTSTRAP_PRIVATE_KEY)
  --base-url <url>    gateway base URL (required)
  --models-url <url>  gateway models URL (optional)
  --days <n>          validity in days (default 30)
  --out <path>        write to file instead of stdout
  -h, --help          show this help`)
        process.exit(0)
    }
  }
  const keyPath = args.keyPath ?? process.env.KOTE_BOOTSTRAP_PRIVATE_KEY
  if (!keyPath) fail("--key is required (or set KOTE_BOOTSTRAP_PRIVATE_KEY)")
  if (!args.baseUrl) fail("--base-url is required")
  if (!args.baseUrl.startsWith("https://")) fail("--base-url must be an https:// URL")
  if (!Number.isFinite(args.days) || args.days <= 0) fail("--days must be a positive number")
  return { keyPath: keyPath!, baseUrl: args.baseUrl!, modelsUrl: args.modelsUrl, days: args.days!, out: args.out }
}

function fail(msg: string): never {
  console.error(`error: ${msg}`)
  process.exit(1)
}

const args = parseArgs(process.argv.slice(2))

// SECURITY: read the private key from disk; never log it.
const privHex = readFileSync(args.keyPath, "utf8").trim()
if (!/^[0-9a-f]{64}$/i.test(privHex)) fail(`private key at ${args.keyPath} is not a 64-char hex Ed25519 key`)

const issued_at = new Date()
const expires_at = new Date(issued_at.getTime() + args.days * 24 * 60 * 60 * 1000)

const unsigned: Omit<BootstrapConfig, "signature"> = {
  config_version: 1,
  gateway: { base_url: args.baseUrl, ...(args.modelsUrl ? { models_url: args.modelsUrl } : {}) },
  issued_at: issued_at.toISOString(),
  expires_at: expires_at.toISOString(),
}

const signed = await signConfig(unsigned, privHex)

// Self-verify before emitting so a bad key/bug never ships a broken config.
const check = await verifyConfig(signed)
if (!check.ok) fail(`self-verification failed: ${JSON.stringify(check.error)}`)

const output = JSON.stringify(signed, null, 2) + "\n"
if (args.out) {
  writeFileSync(args.out, output)
  console.error(`signed config written to ${args.out}`)
} else {
  process.stdout.write(output)
}
