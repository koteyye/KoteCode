type ProviderModel = {
  provider: {
    id: string
  }
}

export function filterConnectedModels<T extends ProviderModel>(
  models: readonly T[],
  connectedProviderIDs: Iterable<string>,
  providerID?: string,
) {
  const connected = new Set(connectedProviderIDs)
  return models.filter((model) => connected.has(model.provider.id) && (!providerID || model.provider.id === providerID))
}
