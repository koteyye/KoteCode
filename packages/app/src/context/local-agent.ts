export function hasCustomAgent(items: Array<{ native?: boolean }>) {
  return items.some((item) => item.native === false)
}

export function resolveAgent<T extends { name: string }>(items: T[], name?: string) {
  return items.find((item) => item.name === name) ?? items.find((item) => item.name === "build") ?? items[0]
}

export function serverAgentState<T>(
  previous: { model?: T; variant?: string | null } | undefined,
  agent: string,
  next?: { model?: T; variant?: string | null },
) {
  return {
    agent,
    model: next?.model ?? previous?.model,
    variant: next && "variant" in next ? next.variant : previous?.variant,
  }
}

type ServerAgentSelection = {
  agent?: string
  model?: { providerID: string; modelID: string }
  variant?: string | null
}

export function sameServerAgentState(previous: ServerAgentSelection | undefined, next: ServerAgentSelection) {
  return (
    previous?.agent === next.agent &&
    previous?.model?.providerID === next.model?.providerID &&
    previous?.model?.modelID === next.model?.modelID &&
    previous?.variant === next.variant
  )
}
