import { createMemo, Show, type Accessor } from "solid-js"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { ProjectAvatar } from "@opencode-ai/ui/v2/project-avatar-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import type { Project } from "@opencode-ai/sdk/v2/client"
import { useLanguage } from "@/context/language"
import { displayName, getProjectAvatarSource } from "@/pages/layout/helpers"
import { getProjectAvatarVariant } from "@/context/layout"
import { showToast } from "@/utils/toast"

// Compact, read-only indicator of the project the current session belongs to.
// Rendered in the prompt composer control bar, next to the submit button. Hover
// reveals the absolute worktree path with a copy button.
export function SessionProjectIndicator(props: {
  project: Accessor<Project | undefined>
  directory: Accessor<string>
}) {
  const language = useLanguage()
  const directory = createMemo(() => props.directory() || (props.project()?.worktree ?? ""))

  const copyPath = () => {
    const value = directory()
    if (!value) return
    navigator.clipboard
      .writeText(value)
      .then(() =>
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("session.share.copy.copied"),
          description: value,
        }),
      )
      .catch(() => undefined)
  }

  return (
    <Show when={props.project()} keyed>
      {(project) => (
        <TooltipV2
          placement="top"
          gutter={4}
          value={
            <div class="flex max-w-[360px] items-center gap-2">
              <span class="min-w-0 truncate text-v2-text-text-muted" title={directory()}>
                {directory()}
              </span>
              <IconButtonV2
                type="button"
                variant="ghost-muted"
                size="small"
                icon={<IconV2 name="outline-copy" size="small" />}
                aria-label={language.t("session.header.open.copyPath")}
                onPointerDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  copyPath()
                }}
              />
            </div>
          }
        >
          <div
            data-action="session-project-indicator"
            class="flex h-7 min-w-0 max-w-[220px] items-center gap-1.5 rounded-sm px-1.5 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted"
            aria-label={`${displayName(project)} ${directory()}`}
          >
            <ProjectAvatar
              fallback={displayName(project)}
              src={getProjectAvatarSource(project.id, project.icon)}
              variant={getProjectAvatarVariant(project.icon?.color)}
            />
            <span class="min-w-0 truncate leading-5">{displayName(project)}</span>
          </div>
        </TooltipV2>
      )}
    </Show>
  )
}
