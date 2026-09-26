import { describe, expect, it } from "vitest";
import {
  generateStaticPageSource,
  generateReactPageSource,
  patchReactStateRouter,
  reactPageComponentName,
  reactPageSourcePath,
  staticPageSourcePath
} from "./sourceGenerationService";

describe("connected React page generation", () => {
  it("generates a hosted static page for StackCP and cPanel sites", () => {
    const html = generateStaticPageSource({
      title: "Case Studies",
      slug: "case-studies",
      tree: { id: "page", type: "page", children: [{ id: "heading-1", type: "heading", props: { text: "Selected work" }, children: [] }] }
    });
    expect(staticPageSourcePath("case-studies")).toBe("case-studies/index.html");
    expect(html).toContain('<iframe id="rcms-shell" src="/"');
    expect(html).toContain('"Selected work"');
    expect(html).toContain('id="rcms-content"');
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
