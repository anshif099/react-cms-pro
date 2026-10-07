import { describe, expect, it } from "vitest";
import {
  cloneDraftDocument,
  clonePageLocales,
  normalizePageSlug,
  pageRouteExists,
  resolveCreationLayout
} from "./pageCreationUtils";

describe("page creation helpers", () => {
  it('normalizes nested slugs and detects existing routes and translated slugs', () => {
    expect(normalizePageSlug('/New Page/Offer/')).toBe('new-page/offer');
    expect(pageRouteExists([{ route: '/offer/' }], 'offer')).toBe(true);
    expect(pageRouteExists([{ route: '/' }], 'home')).toBe(true);
    expect(pageRouteExists([{ locales: { fr: { slug: 'offre' } } }], 'offre')).toBe(true);
    expect(pageRouteExists([{ slug: 'offer' }], 'offer-copy')).toBe(false);
  });

  it('copies styles independently and assigns the new slug to translations', () => {
    const page = { locales: { en: { blocks: [] }, fr: { title: 'Bonjour', slug: 'old', blocks: [{ text: 'Bonjour' }] } } };
    const locales = clonePageLocales(page, { title: 'Copy', slug: 'copy' });
    expect(locales.fr.slug).toBe('copy');
    locales.fr.blocks[0].text = 'Changed';
    expect(page.locales.fr.blocks[0].text).toBe('Bonjour');
    const draft = { tree: { children: [{ styles: { mobile: { fontSize: '24px' } } }] }, regions: {} };
    const copy = cloneDraftDocument(draft, { sourcePageKey: 'old', targetPageKey: 'copy', title: 'Copy', slug: 'copy' });
    copy.tree.children[0].styles.mobile.fontSize = '36px';
    expect(draft.tree.children[0].styles.mobile.fontSize).toBe('24px');
  });

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
