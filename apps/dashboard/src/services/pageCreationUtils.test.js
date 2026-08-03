import { describe, expect, it } from "vitest";
import {
  cloneDraftDocument,
  clonePageLocales,
  resolveCreationLayout
} from "./pageCreationUtils";

describe("page creation helpers", () => {
  it("uses the registered website default layout for a new page", () => {
    const layouts = {
      marketing: { isDefault: true },
      minimal: { isDefault: false }
    };

    expect(resolveCreationLayout(layouts)).toBe("marketing");
    expect(resolveCreationLayout(layouts, "minimal")).toBe("minimal");
  });

  it("copies locale content while assigning a fresh page identity", () => {
    const source = {
      locales: {
        en: {
          title: "Old page",
          slug: "old-page",
          seo: { metaTitle: "Old SEO", metaDescription: "Keep this" },
          blocks: [{ id: "hero-1", type: "hero" }],
          componentTree: {
            id: "old-page",
            title: "Old page",
            locale: "en",
            children: []
          }
        }
      }
    };

    const locales = clonePageLocales(source, {
      title: "New page",
      slug: "new-page",
      metaTitle: "New SEO"
    });

    expect(locales.en.title).toBe("New page");
    expect(locales.en.slug).toBe("new-page");
    expect(locales.en.seo).toEqual({
      metaTitle: "New SEO",
      metaDescription: "Keep this"
    });
    expect(locales.en.blocks).toEqual([{ id: "hero-1", type: "hero" }]);
    expect(locales.en.componentTree.id).toBe("new-page");
    expect(source.locales.en.componentTree.id).toBe("old-page");
  });

  it("copies a draft without published state and remaps page-scoped regions", () => {
    const draft = cloneDraftDocument({
      id: "old-page",
      publishedAt: 10,
      tree: { id: "old-page", locale: "en", children: [] },
      regions: {
        "old-page.title": "Copied title",
        "shared.promo": "Keep shared key"
      }
    }, {
      sourcePageKey: "old-page",
      targetPageKey: "new-page",
      title: "New page",
      slug: "new-page",
      updatedAt: 20
    });

    expect(draft.publishedAt).toBeUndefined();
    expect(draft.tree.id).toBe("new-page");
    expect(draft.regions).toEqual({
      "new-page.title": "Copied title",
      "shared.promo": "Keep shared key"
    });
  });
});
