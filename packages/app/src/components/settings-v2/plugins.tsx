import type { Component } from "solid-js"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { useLanguage } from "@/context/language"
import { useSettings } from "@/context/settings"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"

export const SettingsPluginsV2: Component = () => {
  const language = useLanguage()
  const settings = useSettings()

  return (
    <>
      <div class="settings-v2-tab-header">
        <h2 class="settings-v2-tab-title">{language.t("settings.plugins.title")}</h2>
      </div>
      <div class="settings-v2-tab-body">
        <SettingsListV2>
          <SettingsRowV2
            title={language.t("settings.plugins.row.planning.title")}
            description={language.t("settings.plugins.row.planning.description")}
          >
            <div data-action="settings-plugin-planning">
              <Switch checked={settings.plugins.planning()} onChange={settings.plugins.setPlanning} hideLabel>
                {language.t("settings.plugins.row.planning.title")}
              </Switch>
            </div>
          </SettingsRowV2>
        </SettingsListV2>
      </div>
    </>
  )
}
