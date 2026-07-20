import { PageSEO } from '@anshif.rainhopes/shared';

export function injectSEO(seo: PageSEO) {
  if (typeof document === 'undefined') return;

  // Title
  if (seo.metaTitle) {
    document.title = seo.metaTitle;
  }

  // Helper to get or create meta tag
  const getOrCreateMeta = (nameAttr: 'name' | 'property', attrValue: string) => {
    let el = document.querySelector(`meta[${nameAttr}="${attrValue}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(nameAttr, attrValue);
      document.head.appendChild(el);
    }
    return el as HTMLMetaElement;
  };

  // Description
  if (seo.metaDescription) {
    getOrCreateMeta('name', 'description').content = seo.metaDescription;
  }

  // Open Graph
  if (seo.ogTitle) getOrCreateMeta('property', 'og:title').content = seo.ogTitle;
  if (seo.ogDescription) getOrCreateMeta('property', 'og:description').content = seo.ogDescription;
  if (seo.ogImage) getOrCreateMeta('property', 'og:image').content = seo.ogImage;

  // Robots
  if (seo.robots) {
    getOrCreateMeta('name', 'robots').content = seo.robots;
  }

  // Canonical
  if (seo.canonicalUrl) {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = seo.canonicalUrl;
  }
}
