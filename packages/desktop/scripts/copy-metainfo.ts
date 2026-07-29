import { resolveChannel } from "./utils"
import { APP_IDS, APP_NAMES } from "../src/main/constants"

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const appId = APP_IDS[channel]
const productName = APP_NAMES[channel]
const summary = `Open source AI coding agent${channel !== "prod" ? ` (${channel})` : ""}`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>

  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>${productName}</name>
  <summary>${summary}</summary>

  <developer id="ai.kotecode">
    <name>KoteCode contributors</name>
  </developer>

  <description>
    <p>
      KoteCode is an open source agent that helps you write and run code with any AI model.
    </p>
  </description>

  <launchable type="desktop-id">${appId}.desktop</launchable>

  <content_rating type="oars-1.1" />

  <url type="bugtracker">https://github.com/koteyye/KoteCode/issues</url>
  <url type="homepage">https://github.com/koteyye/KoteCode</url>
  <url type="vcs-browser">https://github.com/koteyye/KoteCode</url>
</component>
`

await Bun.write(`resources/${appId}.metainfo.xml`, xml)
console.log(`Generated metainfo for ${channel} at resources/${appId}.metainfo.xml`)
