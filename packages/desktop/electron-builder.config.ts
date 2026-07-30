import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"
import { APP_IDS, APP_NAMES } from "./src/main/constants"
import desktopPackage from "./package.json"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return
  if (process.env.KOTECODE_WINDOWS_SIGNING !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const getBase = (appId: string): Configuration => ({
  artifactName: "KoteCode-desktop-windows-${arch}-portable.${ext}",
  generateUpdatesFilesForAllChannels: true,
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id. For prod, app id "ai.kotecode.desktop" becomes
  // "ai.kotecode.desktop.desktop".
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
    version: process.env.KOTECODE_VERSION ?? desktopPackage.version,
  },
  files: ["out/**/*", "resources/**/*"],
  extraResources: [
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  protocols: {
    name: "KoteCode",
    schemes: ["kotecode"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    executableName: "KoteCode",
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis", "zip"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    artifactName: "KoteCode-desktop-windows-${arch}-setup.${ext}",
    oneClick: true,
    perMachine: false,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    executableName: "kotecode-desktop",
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
  appImage: {
    artifactName: "KoteCode-desktop-linux-${arch}.${ext}",
  },
  deb: {
    artifactName: "KoteCode-desktop-linux-${arch}.${ext}",
    packageName: "kotecode",
  },
  rpm: {
    artifactName: "KoteCode-desktop-linux-${arch}.${ext}",
    packageName: "kotecode",
  },
})

function getConfig() {
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: APP_NAMES.dev,
        deb: { ...base.deb, packageName: "kotecode-dev" },
        rpm: { ...base.rpm, packageName: "kotecode-dev" },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName: APP_NAMES.beta,
        protocols: { name: "KoteCode Beta", schemes: ["kotecode"] },
        publish: { provider: "github", owner: "koteyye", repo: "KoteCode", channel: "beta" },
        deb: { ...base.deb, packageName: "kotecode-beta" },
        rpm: { ...base.rpm, packageName: "kotecode-beta" },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName: APP_NAMES.prod,
        protocols: { name: "KoteCode", schemes: ["kotecode"] },
        publish: { provider: "github", owner: "koteyye", repo: "KoteCode", channel: "latest" },
      }
    }
  }
}

export default getConfig()
