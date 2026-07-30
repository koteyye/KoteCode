import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { Installation } from "../../installation"
import { KoteCodeVersion } from "@opencode-ai/core/installation/version"

export const UpgradeCommand = {
  command: "upgrade [target]",
  describe: "upgrade KoteCode to the latest compatible version",
  builder: (yargs: Argv) => {
    return yargs
      .positional("target", {
        describe: "version to upgrade to, for ex '0.1.48' or 'v0.1.48'",
        type: "string",
      })
      .option("method", {
        alias: "m",
        describe: "installation method to use",
        type: "string",
        choices: ["curl", "npm", "yarn", "pnpm", "bun", "brew"],
      })
      .option("allow-downgrade", {
        describe: "allow installing an older version explicitly",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args: { target?: string; method?: string; allowDowngrade: boolean }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("Upgrade")
    if (!Installation.UpdatesEnabled) {
      prompts.log.warn(Installation.UpdatesDisabledMessage)
      prompts.outro("No changes made")
      return
    }
    const detectedMethod = await Installation.method()
    const method = (args.method as Installation.Method) ?? detectedMethod
    if (method === "unknown") {
      prompts.log.error(`KoteCode is installed at ${process.execPath}, but its installation method is unknown`)
      prompts.log.info("Use npm install -g kotecode@latest, brew upgrade koteyye/tap/kotecode, or install manually")
      prompts.outro("No changes made")
      return
    }
    prompts.log.info("Using method: " + method)
    const target = args.target ? args.target.replace(/^v/, "") : await Installation.latest(method)

    if (KoteCodeVersion === target) {
      prompts.log.warn(`KoteCode ${target} is already installed`)
      prompts.outro("Done")
      return
    }

    prompts.log.info(`From ${KoteCodeVersion} → ${target}`)
    const spinner = prompts.spinner()
    spinner.start("Upgrading...")
    const err = await Installation.upgrade(method, target, { allowDowngrade: args.allowDowngrade }).catch((err) => err)
    if (err) {
      spinner.stop("Upgrade failed", 1)
      if (err instanceof Installation.UpgradeFailedError) {
        prompts.log.error(err.stderr)
      } else if (err instanceof Error) prompts.log.error(err.message)
      prompts.outro("Done")
      return
    }
    spinner.stop("Upgrade complete")
    prompts.outro("Done")
  },
}
