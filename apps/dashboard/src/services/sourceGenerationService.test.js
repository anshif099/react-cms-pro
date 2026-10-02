import { describe, expect, it, vi } from "vitest";
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
  it('preserves CTA banner styling independently of the page background', () => {
    const tree = { styles: { base: { background: '#f3f4f6' } }, children: [{
      type: 'cta', props: { title: 'Ready to get started?', subtitle: '', background: '#ef4444', primaryButtonText: 'Book Your Free Growth Audit', primaryButtonUrl: '/contact', design: { background: '#f3f4f6' } },
      styles: { base: { background: '#f3f4f6', color: '#f59e0b', fontFamily: 'Georgia', fontSize: '36px' }, mobile: { fontSize: '24px' } }
    }] };
    const dom = new JSDOM(generateStaticPageSource({ title: 'CTA', slug: 'cta', tree }), { runScripts: 'dangerously', url: 'https://example.com/' });
    for (const [width, size] of [[1440, '36px'], [390, '24px']]) {
      dom.window.innerWidth = width;
      dom.window.dispatchEvent(new dom.window.Event('resize'));
      const heading = dom.window.document.querySelector('#rcms-content h2');
      const banner = heading.parentElement;
      const button = banner.querySelector('a');
      expect(banner.style.background).toBe('rgb(239, 68, 68)');
      expect(banner.style.borderRadius).toBe('22px');
      expect(heading.style.color).toBe('rgb(245, 158, 11)');
      expect(heading.style.fontFamily).toBe('Georgia');
      expect(heading.style.fontSize).toBe(size);
      expect(button.style.background).toBe('rgb(15, 23, 42)');
      expect(button.querySelector('span').style.color).toBe('rgb(245, 158, 11)');
      expect(button.getAttribute('href')).toBe('/contact');
      expect(dom.window.document.body.style.background).toBe('rgb(243, 244, 246)');
    }
    dom.window.close();
  });
  it('paints the published page canvas behind button rows and section gaps on every device', () => {
    const tree = { styles: { base: { background: '#f3f4f6' }, mobile: { background: '#123456' } }, children: [
      { type: 'heading', props: { text: 'Title' } },
      { type: 'button', props: { label: 'WhatsApp', color: '#ef4444' } },
      { type: 'button', props: { label: 'Audit', color: '#ef4444' } },
      { type: 'spacer', props: { height: 64 } }
    ] };
    const dom = new JSDOM(generateStaticPageSource({ title: 'Background', slug: 'background', tree }), { runScripts: 'dangerously', url: 'https://example.com/' });
    for (const [width, color] of [[1440, 'rgb(243, 244, 246)'], [390, 'rgb(18, 52, 86)'], [1440, 'rgb(243, 244, 246)']]) {
      dom.window.innerWidth = width;
      dom.window.dispatchEvent(new dom.window.Event('resize'));
      expect(dom.window.document.getElementById('rcms-content').style.background).toBe(color);
      expect(dom.window.document.body.style.background).toBe(color);
      expect(dom.window.document.documentElement.style.background).toBe(color);
      expect(dom.window.document.querySelector('.rcms-button-row')).not.toBeNull();
      expect(dom.window.document.querySelector('.rcms-button').style.background).toBe('rgb(239, 68, 68)');
    }
    dom.window.close();
  });
  it('publishes device styles and switches them when the viewport changes', () => {
    const html = generateStaticPageSource({ title: 'Responsive', slug: 'responsive', tree: { children: [
      { type: 'heading', props: { level: 'h1', text: 'Best Marketing Agency in Kerala' }, styles: {
        base: { color: 'red' }, desktop: { fontSize: '50px', padding: '24px' },
        laptop: { fontSize: '40px' }, tablet: { fontSize: '30px' },
        mobile: { fontSize: '20px', padding: 8, lineHeight: 1.2 }
      } }
    ] } });
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.com/' });
    const heading = () => dom.window.document.querySelector('#rcms-content h1');
    for (const [width, size] of [[1440, '50px'], [1100, '40px'], [800, '30px'], [390, '20px'], [1440, '50px']]) {
      dom.window.innerWidth = width;
      dom.window.dispatchEvent(new dom.window.Event('resize'));
      expect(heading().style.fontSize).toBe(size);
      expect(heading().style.color).toBe('red');
      expect(heading().style.padding).toBe(width === 390 ? '8px' : '24px');
      if (width === 390) expect(heading().style.lineHeight).toBe('1.2');
    }
    dom.window.close();
  });
  it('waits for shell route resolution before navigating out of the iframe', async () => {
    const html = generateStaticPageSource({ title: 'Page', slug: 'page', tree: { children: [] } });
    const dom = new JSDOM('<footer><a href="/about" target="_top">About Us</a></footer>', { runScripts: 'outside-only', url: 'https://triosis.in/' });
    dom.window.eval(html.slice(html.indexOf('function resolvePublishedShellLinks'), html.indexOf('function lockPublishedSitePart')));
    dom.window.eval('shellRoutesPromise=Promise.resolve({aboutus:{path:"/aboutus",title:"About Us",published:true}})');
    const footer = dom.window.document.querySelector('footer');
    const link = footer.querySelector('a');
    const assign = vi.fn();
    const target = {
      contains: element => footer.contains(element),
      querySelectorAll: selector => footer.querySelectorAll(selector),
      ownerDocument: { baseURI: dom.window.document.baseURI, location: dom.window.location, defaultView: { top: { location: { assign } } } },
    };
    const preventDefault = vi.fn();
    dom.window.activatePublishedShellLink({ target: link, button: 0, preventDefault }, target);
    expect(preventDefault).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(assign).toHaveBeenCalledWith('https://triosis.in/aboutus');
    assign.mockClear();
    dom.window.activatePublishedShellLink({ target: link, button: 0, ctrlKey: true, preventDefault }, target);
    await Promise.resolve();
    expect(assign).not.toHaveBeenCalled();
    dom.window.close();
  });
  it('corrects missing shell routes by matching a unique published page title', () => {
    const html = generateStaticPageSource({ title: 'Page', slug: 'page', tree: { children: [] } });
    const helper = html.slice(html.indexOf('function resolvePublishedShellLinks'), html.indexOf('var shellRoutesPromise'));
    const dom = new JSDOM('<header><a href="/about?ref=header#team">About Us</a><a href="/services">Services</a><a href="https://other.example/about">About Us</a></header>', { runScripts: 'outside-only', url: 'https://triosis.in/?rcms_preview=1' });
    dom.window.eval(helper);
    dom.window.resolvePublishedShellLinks(dom.window.document.querySelector('header'), {
      aboutus: { path: '/aboutus', title: 'About Us', published: true },
      services: { path: '/services', title: 'Services', published: true },
    });
    const links = dom.window.document.querySelectorAll('a');
    expect(links[0].href).toBe('https://triosis.in/aboutus?ref=header#team');
    expect(links[1].getAttribute('href')).toBe('/services');
    expect(links[2].href).toBe('https://other.example/about');
    dom.window.close();
  });
  it('blocks delegated editor handlers in published site parts without cancelling links', () => {
    const html = generateStaticPageSource({ title: 'Page', slug: 'page', tree: { children: [] } });
    const script = html.match(/function lockPublishedSitePart\(target\)\{[\s\S]*?\n\}/)[0];
    const dom = new JSDOM('<div id="root"><footer><a href="#contact">Contact</a></footer></div>', { runScripts: 'outside-only', url: 'https://example.com/' });
    dom.window.eval(html.slice(html.indexOf('function resolvePublishedShellLinks'), html.indexOf('function lockPublishedSitePart')));
    dom.window.eval(script);
    const footer = dom.window.document.querySelector('footer');
    const link = footer.querySelector('a');
    const editorHandler = vi.fn();
    dom.window.document.querySelector('#root').addEventListener('mousedown', editorHandler);
    dom.window.document.querySelector('#root').addEventListener('click', editorHandler);
    dom.window.lockPublishedSitePart(footer);
    for (const type of ['mousedown', 'mousemove', 'mouseup', 'click', 'touchstart', 'pointerdown']) {
      const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
      expect(link.dispatchEvent(event)).toBe(true);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(editorHandler).not.toHaveBeenCalled();
    expect(dom.window.getComputedStyle(footer).cursor).toContain('data:image/svg+xml');
    expect(dom.window.getComputedStyle(link).cursor).toContain('pointer');
    expect(dom.window.getComputedStyle(link).cursor).toContain('data:image/svg+xml');
    expect(link.getAttribute('href')).toBe('#contact');
    expect(html).toContain('lockPublishedSitePart(target);');
    dom.window.close();
  });
  it('removes captured editor insertion controls without removing published content', () => {
    const html = generateStaticPageSource({ title: 'Page', slug: 'page', tree: { children: [
      { type: 'html', props: { code: '<div data-rcms-runtime-additions-host><p>Published section</p><div data-rcms-empty-additions="true"><span>CMS insertion area above the footer</span><button>+ Section</button></div><div data-rcms-toolbar>Delete</div></div>' } }
    ] } });
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.com/page/' });
    const content = dom.window.document.querySelector('#rcms-content');
    expect(content.textContent).toContain('Published section');
    expect(content.textContent).not.toContain('CMS insertion area');
    expect(content.querySelector('[data-rcms-empty-additions]')).toBeNull();
    expect(content.querySelector('[data-rcms-toolbar]')).toBeNull();
    dom.window.close();
  });
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
    expect(STATIC_PAGE_RUNTIME_VERSION).toBe(16);
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
