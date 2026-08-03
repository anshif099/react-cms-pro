function cloneValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function updateTreeIdentity(tree, { pageKey, title, locale }) {
  if (!tree || typeof tree !== "object" || !Array.isArray(tree.children)) {
    return tree;
  }

  return {
    ...tree,
    id: pageKey,
    title: title || tree.title,
    locale: locale || tree.locale
  };
}

export function resolveCreationLayout(layouts, requestedLayout, copiedLayout) {
  if (requestedLayout) return requestedLayout;
  if (copiedLayout) return copiedLayout;

  const entries = Object.entries(layouts || {});
  const defaultEntry = entries.find(([, layout]) => layout?.isDefault);
  if (defaultEntry) return defaultEntry[0];
  if (layouts?.default) return "default";
  return entries[0]?.[0] || "default";
}

export function clonePageLocales(sourcePage, {
  title,
  slug,
  metaTitle,
  metaDescription,
  keywords
}) {
  const locales = cloneValue(sourcePage?.locales || {});
  const english = locales.en || {};
  const seo = english.seo || {};

  locales.en = {
    ...english,
    title,
    slug,
    seo: {
      ...seo,
      metaTitle: metaTitle || title,
      ...(metaDescription !== undefined ? { metaDescription } : {}),
      ...(keywords !== undefined ? { keywords } : {})
    },
    blocks: Array.isArray(english.blocks) ? english.blocks : [],
    ...(english.componentTree
      ? {
        componentTree: updateTreeIdentity(english.componentTree, {
          pageKey: slug || "home",
          title,
          locale: "en"
        })
      }
      : {})
  };

  Object.entries(locales).forEach(([locale, value]) => {
    if (locale === "en" || !value?.componentTree) return;
    locales[locale] = {
      ...value,
      componentTree: updateTreeIdentity(value.componentTree, {
        pageKey: slug || "home",
        title: value.title,
        locale
      })
    };
  });

  return locales;
}

function remapRegionKeys(regions, sourcePageKey, targetPageKey) {
  if (!regions || typeof regions !== "object" || !sourcePageKey) {
    return regions || {};
  }

  const sourcePrefix = `${sourcePageKey}.`;
  return Object.fromEntries(Object.entries(regions).map(([key, value]) => [
    key.startsWith(sourcePrefix)
      ? `${targetPageKey}.${key.slice(sourcePrefix.length)}`
      : key,
    value
  ]));
}

export function cloneDraftDocument(sourceDraft, {
  sourcePageKey,
  targetPageKey,
  title,
  slug,
  updatedAt = Date.now()
}) {
  if (!sourceDraft || typeof sourceDraft !== "object") return null;

  const draft = cloneValue(sourceDraft);
  delete draft.publishedAt;

  return {
    ...draft,
    id: targetPageKey,
    title,
    slug,
    ...(draft.tree
      ? {
        tree: updateTreeIdentity(draft.tree, {
          pageKey: targetPageKey,
          title,
          locale: draft.tree.locale
        })
      }
      : {}),
    regions: remapRegionKeys(
      draft.regions,
      sourcePageKey,
      targetPageKey
    ),
    updatedAt
  };
}

export function resolvePageKey(page) {
  const route = page?.route || page?.slug || "home";
  const clean = String(route).split("?")[0].replace(/^\/+|\/+$/g, "");
  return clean || "home";
}

export default {
  cloneDraftDocument,
  clonePageLocales,
  resolveCreationLayout,
  resolvePageKey
};
