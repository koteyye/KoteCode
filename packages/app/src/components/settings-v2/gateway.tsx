import type { Config } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { RadioGroupV2, RadioItemV2 } from "@opencode-ai/ui/v2/radio-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { type Component, type JSX, For, Show, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useServerSync } from "@/context/server-sync"
import {
  KOTE_GATEWAY_ID,
  displayGatewayProxyUrl,
  gatewayConfig,
  normalizeGatewayProxyUrl,
  withGateway,
  type GatewayConfig,
  type GatewayProxy,
} from "@/utils/gateway"
import { showToast } from "@/utils/toast"
import { SettingsListV2 } from "./parts/list"
import "./settings-v2.css"

export const SettingsGatewayV2: Component = () => {
  const dialog = useDialog()
  const language = useLanguage()
  const serverSync = useServerSync()
  const [state, setState] = createStore({ saving: false })
  const gateway = createMemo(() => gatewayConfig(serverSync().data.config))

  const save = (next: GatewayConfig) => {
    const before = serverSync().data.config.gateway
    serverSync().set("config", "gateway", next)
    setState("saving", true)
    return serverSync()
      .updateConfig(withGateway({} as Config, next))
      .then(() => undefined)
      .catch((error: unknown) => {
        serverSync().set("config", "gateway", before)
        showToast({
          title: language.t("common.requestFailed"),
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      })
      .finally(() => setState("saving", false))
  }

  const open = (proxy?: GatewayProxy) => {
    void dialog.push(() => (
      <DialogGatewayProxy
        proxy={proxy}
        proxies={gateway().proxies}
        onSave={(next) => {
          const current = gateway()
          return save({
            active: proxy ? current.active : next.id,
            proxies: proxy
              ? current.proxies.map((item) => (item.id === proxy.id ? next : item))
              : [...current.proxies, next],
          })
        }}
      />
    ))
  }

  const remove = (proxy: GatewayProxy) => {
    const current = gateway()
    void save({
      active: current.active === proxy.id ? KOTE_GATEWAY_ID : current.active,
      proxies: current.proxies.filter((item) => item.id !== proxy.id),
    })
  }

  const select = (active: string) => {
    if (active === gateway().active) return
    void save({ ...gateway(), active })
  }

  return (
    <>
      <div class="settings-v2-tab-header settings-v2-gateway-header">
        <div class="settings-v2-tab-header-row">
          <h2 class="settings-v2-tab-title">{language.t("settings.gateway.title")}</h2>
          <ButtonV2 size="normal" variant="neutral" icon="plus" disabled={state.saving} onClick={() => open()}>
            {language.t("settings.gateway.action.add")}
          </ButtonV2>
        </div>
      </div>
      <div class="settings-v2-tab-body settings-v2-gateway">
        <div class="settings-v2-section">
          <div class="settings-v2-gateway-intro">
            <h3 class="settings-v2-section-title">{language.t("settings.gateway.section.active")}</h3>
            <p>{language.t("settings.gateway.description")}</p>
          </div>
          <SettingsListV2>
            <RadioGroupV2
              value={gateway().active}
              onChange={select}
              label={language.t("settings.gateway.section.active")}
              hideLabel
              class="settings-v2-gateway-options"
            >
              <RadioItemV2
                value={KOTE_GATEWAY_ID}
                disabled={state.saving}
                label={
                  <GatewayOption
                    name={language.t("settings.gateway.kote.name")}
                    description={language.t("settings.gateway.kote.description")}
                  />
                }
              />
              <For each={gateway().proxies}>
                {(proxy) => (
                  <RadioItemV2
                    value={proxy.id}
                    disabled={state.saving}
                    label={
                      <GatewayOption
                        name={proxy.name}
                        description={displayGatewayProxyUrl(proxy.url)}
                        actions={
                          <GatewayProxyMenu proxy={proxy} onEdit={() => open(proxy)} onRemove={() => remove(proxy)} />
                        }
                      />
                    }
                  />
                )}
              </For>
            </RadioGroupV2>
          </SettingsListV2>
        </div>
      </div>
    </>
  )
}

const GatewayOption: Component<{
  name: string
  description: string
  actions?: JSX.Element
}> = (props) => (
  <div class="settings-v2-gateway-option">
    <span class="settings-v2-gateway-option-copy">
      <span class="settings-v2-gateway-option-name">{props.name}</span>
      <span class="settings-v2-gateway-option-description">{props.description}</span>
    </span>
    {props.actions}
  </div>
)

const GatewayProxyMenu: Component<{
  proxy: GatewayProxy
  onEdit: () => void
  onRemove: () => void
}> = (props) => {
  const language = useLanguage()
  return (
    <span
      class="settings-v2-gateway-option-actions"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <MenuV2 gutter={6} modal={false} placement="bottom-end">
        <MenuV2.Trigger
          as={IconButtonV2}
          variant="ghost-muted"
          size="small"
          icon={<IconV2 name="outline-dots" />}
          aria-label={language.t("common.moreOptions")}
        />
        <MenuV2.Portal>
          <MenuV2.Content>
            <MenuV2.Group>
              <MenuV2.GroupLabel>{props.proxy.name}</MenuV2.GroupLabel>
              <MenuV2.Item onSelect={props.onEdit}>{language.t("common.edit")}</MenuV2.Item>
              <MenuV2.Separator />
              <MenuV2.Item onSelect={props.onRemove}>{language.t("common.delete")}</MenuV2.Item>
            </MenuV2.Group>
          </MenuV2.Content>
        </MenuV2.Portal>
      </MenuV2>
    </span>
  )
}

const DialogGatewayProxy: Component<{
  proxy?: GatewayProxy
  proxies: GatewayProxy[]
  onSave: (proxy: GatewayProxy) => Promise<void>
}> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
  const [form, setForm] = createStore({
    name: props.proxy?.name ?? "",
    url: props.proxy?.url ?? "",
    nameError: "",
    urlError: "",
    saveError: "",
    saving: false,
  })

  const submit = () => {
    const name = form.name.trim()
    const url = normalizeGatewayProxyUrl(form.url)
    const nameError = !name
      ? language.t("settings.gateway.dialog.error.name")
      : props.proxies.some(
            (proxy) => proxy.id !== props.proxy?.id && proxy.name.trim().toLowerCase() === name.toLowerCase(),
          )
        ? language.t("settings.gateway.dialog.error.duplicate")
        : ""
    const urlError = url ? "" : language.t("settings.gateway.dialog.error.url")
    setForm({ nameError, urlError, saveError: "" })
    if (nameError || urlError || !url) return

    setForm("saving", true)
    void props
      .onSave({
        id: props.proxy?.id ?? `proxy_${crypto.randomUUID()}`,
        name,
        url,
      })
      .then(() => dialog.close())
      .catch((error: unknown) => setForm("saveError", error instanceof Error ? error.message : String(error)))
      .finally(() => setForm("saving", false))
  }

  const keyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.isComposing) return
    event.preventDefault()
    submit()
  }

  return (
    <Dialog fit class="settings-v2-gateway-dialog">
      <DialogHeader hideClose={true}>
        <DialogTitle>
          {language.t(props.proxy ? "settings.gateway.dialog.editTitle" : "settings.gateway.dialog.addTitle")}
        </DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <DialogBody class="flex w-full min-w-0 flex-1 flex-col px-4 pt-4 pb-2">
        <div class="flex w-full min-w-0 flex-col gap-6">
          <div class="flex w-full min-w-0 flex-col gap-2">
            <label class="settings-v2-gateway-dialog-label">{language.t("settings.gateway.dialog.name")}</label>
            <TextInputV2
              type="text"
              appearance="large"
              class="!w-full self-stretch"
              value={form.name}
              placeholder={language.t("settings.gateway.dialog.namePlaceholder")}
              invalid={!!form.nameError}
              disabled={form.saving}
              autofocus
              onInput={(event) => {
                setForm("name", event.currentTarget.value)
                setForm("nameError", "")
              }}
              onKeyDown={keyDown}
            />
            <Show when={form.nameError}>
              <span class="settings-v2-gateway-dialog-error">{form.nameError}</span>
            </Show>
          </div>
          <div class="flex w-full min-w-0 flex-col gap-2">
            <label class="settings-v2-gateway-dialog-label">{language.t("settings.gateway.dialog.url")}</label>
            <TextInputV2
              type="text"
              appearance="large"
              class="!w-full self-stretch"
              value={form.url}
              placeholder={language.t("settings.gateway.dialog.urlPlaceholder")}
              invalid={!!form.urlError}
              disabled={form.saving}
              spellcheck={false}
              autocorrect="off"
              autocomplete="off"
              autocapitalize="off"
              onInput={(event) => {
                setForm("url", event.currentTarget.value)
                setForm("urlError", "")
              }}
              onKeyDown={keyDown}
            />
            <Show when={form.urlError}>
              <span class="settings-v2-gateway-dialog-error">{form.urlError}</span>
            </Show>
            <Show when={form.saveError}>
              <span class="settings-v2-gateway-dialog-error">{form.saveError}</span>
            </Show>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <ButtonV2 variant="neutral" disabled={form.saving} onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2 variant="contrast" disabled={form.saving} onClick={submit}>
          {language.t("common.save")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
