import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import BLOCK_SCHEMAS from '../components/blocks/blockSchemas';
import {
  generateStaticPageSource,
  generateReactPageSource,
  patchReactStateRouter,
  reactPageComponentName,
  reactPageSourcePath,
  staticPageSourcePath,
  STATIC_PAGE_RUNTIME_VERSION
} from "./sourceGenerationService";

describe("connected React page generation", () => {
  it('publishes heading links while preserving heading text and level', () => {
    const html = generateStaticPageSource({ title: 'Links', slug: 'links', tree: { children: [
      { type: 'heading', props: { level: 'h3', text: 'Contact us', linkUrl: '/contact', newTab: true } }
    ] } });
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.com/links/' });
    const link = dom.window.document.querySelector('#rcms-content h3 a');
    expect(link.textContent).toBe('Contact us');
    expect(link.getAttribute('href')).toBe('/contact');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    dom.window.close();
  });
  it.each([
    [{ alignment: 'center' }, 'auto', 'auto', ''],
    [{ alignment: 'left' }, '0px', 'auto', ''],
    [{ alignment: 'right' }, 'auto', '0px', ''],
    [{ alignment: 'center', horizontalPosition: 0.5, offsetX: 300 }, '0px', '0px', '50%'],
  ])('preserves standalone button placement %j', (props, leftMargin, rightMargin, left) => {
    const html = generateStaticPageSource({ title: 'Button', slug: 'button', tree: { children: [
      { type: 'button', props: { label: 'Contact us', ...props } }
    ] } });
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.com/button/' });
    const button = dom.window.document.querySelector('#rcms-content a');
    expect(button.style.marginLeft).toBe(leftMargin);
    expect(button.style.marginRight).toBe(rightMargin);
    expect(button.style.left).toBe(left);
    expect(button.style.width).toBe('fit-content');
    if (left) expect(button.style.translate).toBe('-50% 0');
    dom.window.close();
  });
  it.each(BLOCK_SCHEMAS.map(schema => [schema.type, schema]))('renders the catalog element %s in a hosted page', (type, schema) => {
    const props = { locales: { en: {} } };
    const sample = fields => Object.fromEntries(fields.map(field => [field.key,
      field.type === 'array' ? [sample(field.fields)] : field.type === 'image' || field.type === 'url' ? 'https://example.com/media' : field.type === 'number' ? 3 : field.type === 'boolean' ? true : field.defaultValue || 'Sample content'
    ]));
    for (const field of schema.fields) {
      const val = sample([field])[field.key];
      (field.localized ? props.locales.en : props)[field.key] = val;
    }
    const html = generateStaticPageSource({ title: 'Catalog', slug: 'catalog', tree: { children: [{ type, props }] } });
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.com/catalog/' });
    const content = dom.window.document.querySelector(type === 'button' ? '#rcms-content' : '.rcms-node-inner');
    expect(content.children.length).toBeGreaterThan(0);
    if (!['section', 'container', 'columns', 'grid', 'flex', 'spacer', 'divider'].includes(type)) {
      expect(content.textContent.trim().length > 0 || !!content.querySelector('img,video,audio,iframe,input,textarea,select')).toBe(true);
    }
    dom.window.close();
  });
  it.each(['faq', 'accordion'])('publishes localized %s questions and answers as separate expandable rows', (type) => {
    const html = generateStaticPageSource({ title: 'FAQ', slug: 'faq', locale: 'ml', tree: { children: [
      { type, props: { locales: { ml: { title: 'Questions', items: [
        { question: 'First question?', answer: 'First answer' },
        { question: 'Second question?', answer: 'Second answer' }
      ] } } } }
    ] } });
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.com/faq/' });
    const rows = dom.window.document.querySelectorAll('#rcms-content details');
    expect(dom.window.document.querySelector('#rcms-content h2').textContent).toBe('Questions');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('summary').textContent).toBe('First question?');
    expect(rows[1].querySelector('summary').textContent).toBe('Second question?');
    expect(rows[0].querySelector('p').textContent).toBe('First answer');
    expect(rows[1].querySelector('p').textContent).toBe('Second answer');
    dom.window.close();
  });
  it.each(['100%', '', undefined])("renders full-width images without page gutters (width: %s)", (width) => {
    const html = generateStaticPageSource({ title: "Photo", slug: "photo", tree: { children: [
      { type: "image", props: { src: "/photo.jpg", width } }
    ] } });
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.com/photo/" });
    const shell = dom.window.document.querySelector('.rcms-node-shell');
    expect(shell.style.paddingLeft).toBe('0px');
    expect(shell.style.paddingRight).toBe('0px');
    expect(shell.querySelector('.rcms-node-inner').style.maxWidth).toBe('none');
    expect(shell.querySelector('img').style.width).toBe('100%');
    dom.window.close();
  });
  it("generates a hosted static page for StackCP and cPanel sites", () => {
    const html = generateStaticPageSource({
      title: "Case Studies",
      slug: "case-studies",
      websiteId: "website-1",
      pageKey: "case-studies",
      tree: { id: "page", type: "page", children: [{ id: "heading-1", type: "heading", props: { text: "Selected work" }, children: [] }] }
    });
    expect(staticPageSourcePath("case-studies")).toBe("case-studies/index.html");
    expect(STATIC_PAGE_RUNTIME_VERSION).toBe(7);
    expect(html).toContain('<iframe id="rcms-header" class="rcms-site-shell" src="/?rcms_preview=1"');
    expect(html).toContain('<iframe id="rcms-footer" class="rcms-site-shell" src="/?rcms_preview=1"');
    expect(html).toContain("showSitePart(document.getElementById('rcms-header')");
    expect(html).toContain('title="Drag handle to resize text area width"');
    expect(html).toContain('new frame.contentWindow.MutationObserver(hideHandles)');
    expect(html).toContain('"Selected work"');
    expect(html).toContain('id="rcms-content"');
    expect(html).toContain('"websiteId":"website-1"');
    expect(html).toContain('/sync/published/pages/');
  });
  it("renders rich text as content without editor markers on the hosted page", () => {
    const html = generateStaticPageSource({
      title: "New page",
      slug: "new-page",
      tree: { children: [{ type: "paragraph", props: { text: "<p><strong>Hello</strong></p><script>alert(1)</script>" } }] }
    });
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.com/new-page/" });
    expect(dom.window.document.querySelector("#rcms-content strong")?.textContent).toBe("Hello");
    expect(dom.window.document.querySelector("#rcms-content script")).toBeNull();
    expect(dom.window.document.querySelector("[data-rcms-node]")).toBeNull();
    dom.window.close();
  });
  it("publishes adjacent buttons in the same row with their saved styles", () => {
    const html = generateStaticPageSource({
      title: "Buttons", slug: "buttons",
      tree: { children: [
        { id: "one", type: "button", props: { label: "First", color: "#ff0000", offsetY: 40 } },
        { id: "two", type: "button", props: { label: "Second", width: 200, offsetY: -20 } }
      ] }
    });
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.com/buttons/" });
    const row = dom.window.document.querySelector("#rcms-content .rcms-button-row");
    expect(row?.children.length).toBe(2);
    expect(row?.children[0].style.background).toBe("rgb(255, 0, 0)");
    expect(row?.children[1].style.width).toBe("200px");
    expect(row?.children[0].style.marginTop).toBe("");
    dom.window.close();
  });
  it("replaces embedded content with the latest published tree", async () => {
    const html = generateStaticPageSource({
      title: "Buttons", slug: "buttons", websiteId: "site-1", pageKey: "buttons",
      tree: { children: [{ id: "old", type: "button", props: { label: "Old" } }] }
    });
    const dom = new JSDOM(html, {
      runScripts: "dangerously", url: "https://example.com/buttons/",
      beforeParse(window) {
        window.fetch = async () => ({ ok: true, json: async () => ({
          title: "Updated buttons",
          tree: { children: [
            { id: "new-1", type: "button", props: { label: "WhatsApp" } },
            { id: "new-2", type: "button", props: { label: "Audit" } }
          ] }
        }) });
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Array.from(dom.window.document.querySelectorAll(".rcms-button-row a")).map((node) => node.textContent)).toEqual(["WhatsApp", "Audit"]);
    expect(dom.window.document.title).toBe("Updated buttons");
    dom.window.close();
  });
  it("generates a standalone React page from native blocks", () => {
    const source = generateReactPageSource({
      title: "Case Studies",
      slug: "case-studies",
      blocks: [{
        id: "heading-1",
        type: "heading",
        locales: { en: { text: "Selected work" } }
      }]
    });
    expect(reactPageComponentName("case-studies")).toBe("CaseStudiesPage");
    expect(reactPageSourcePath("case-studies")).toBe("src/pages/CaseStudiesPage.jsx");
    expect(source).toContain("export default function CaseStudiesPage()");
    expect(source).toContain('"Selected work"');
  });

  it("registers a new page in the Triosis-style state router", () => {
    const router = `import React from 'react';
import Home from './pages/home.jsx';

const mainNavigationItems = [
  { id: 'nav-home', label: 'Home', path: '/', order: 1 },
];

const pathToPage = {
  '/': 'home'
};

const pageToPath = {
  'home': '/'
};

export default function App() {
  const [currentPage] = React.useState('home');
  return (
    <div>
      {currentPage === 'home' && <Home />}
    </div>
  );
}`;
    const patched = patchReactStateRouter(router, {
      title: "Case Studies",
      slug: "case-studies",
      component: "CaseStudiesPage",
      importPath: "./pages/CaseStudiesPage.jsx"
    });

    expect(patched).toContain("import CaseStudiesPage from './pages/CaseStudiesPage.jsx';");
    expect(patched).toContain("'/case-studies': 'case-studies'");
    expect(patched).toContain("'case-studies': '/case-studies'");
    expect(patched).toContain("currentPage === 'case-studies' && <CaseStudiesPage />");
    expect(patched).toContain("label: \"Case Studies\"");
  });
});
