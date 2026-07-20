export const paths = {
  // Registry (metadata)
  registry:           (id: string) => `registry/${id}`,
  registryRuntime:    (id: string) => `registry/${id}/runtime`,
  registryRoutes:     (id: string) => `registry/${id}/routes`,
  registryLayouts:    (id: string) => `registry/${id}/layouts`,
  registryNav:        (id: string) => `registry/${id}/navigation`,
  registryTheme:      (id: string) => `registry/${id}/theme`,
  registryModels:     (id: string) => `registry/${id}/contentModels`,
  registryComponents: (id: string) => `registry/${id}/components`,
  registryRegions:    (id: string, pageId: string) => `registry/${id}/editableRegions/${pageId}`,
  registryPlugins:    (id: string) => `registry/${id}/plugins`,

  // Content (data — existing + extended)
  contentTheme:       (id: string) => `content/${id}/theme`,
  contentSEO:         (id: string) => `content/${id}/seo`,
  contentDraft:       (id: string, pageId: string) => `content/${id}/sync/draft/pages/${pageId}`,
  contentPublished:   (id: string, pageId: string) => `content/${id}/sync/published/pages/${pageId}`,
  contentEntry:       (id: string, model: string, entryId: string) =>
                        `content/${id}/entries/${model}/${entryId}`,
  contentPlugin:      (id: string, pluginId: string) => `content/${id}/plugins/${pluginId}`,

  // Pages (existing)
  pages:              (id: string) => `pages/${id}`,
  page:               (id: string, pageId: string) => `pages/${id}/${pageId}`,
};
export type PathBuilders = typeof paths;
