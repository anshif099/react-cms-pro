import { describe, expect, it } from "vitest";
import {
  buildSourceManifest,
  discoverSourceRoutes,
  normalizeSourceFiles
} from "./sourceImportUtils";

describe("source import discovery", () => {
  it("discovers React Router paths without inventing page content", () => {
    const routes = discoverSourceRoutes([
      {
        path: "src/App.jsx",
        content: `
          import ContactUs from "./pages/ContactUs";
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/contact" element={<ContactUs />} />
          </Routes>
        `
      },
      {
        path: "src/pages/ContactUs.jsx",
        content: "export default function ContactUs() {}"
      }
    ], { provider: "github", revision: "abc123" });

    expect(routes).toEqual([
      expect.objectContaining({
        path: "/",
        title: "Home",
        sourceFile: "src/App.jsx",
        sourceComponent: "Home",
        nativeArtifactStatus: "source-only"
      }),
      expect.objectContaining({
        path: "/contact",
        title: "Contact Us",
        sourceFile: "src/pages/ContactUs.jsx",
        sourceComponent: "ContactUs",
        sourceRevision: "abc123"
      })
    ]);
  });

  it("discovers file-system routes for a Next.js app", () => {
    const files = [
      { path: "package.json", content: JSON.stringify({ dependencies: { next: "15.0.0" } }), size: 20 },
      { path: "app/page.tsx", content: "export default function Home() {}", size: 36 },
      { path: "app/contact/page.tsx", content: "export default function Contact() {}", size: 39 }
    ];
    const manifest = buildSourceManifest(files, { provider: "github" });

    expect(manifest.framework).toBe("Next.js");
    expect(manifest.routes.map((route) => route.path)).toEqual(["/", "/contact"]);
  });

  it("discovers custom path maps and resolves their rendered page components", () => {
    const routes = discoverSourceRoutes([
      {
        path: "src/App.jsx",
        content: `
          import ContactPage from './pages/ContactPage.jsx';
          const navigation = [{ label: 'Contact Us', path: '/contact' }];
          const pathToPage = { '/': 'home', '/contact': 'contact', '/career': 'career' };
          {currentPage === 'contact' && <ContactPage />}
        `
      },
      {
        path: "src/pages/ContactPage.jsx",
        content: "export default function ContactPage() {}"
      }
    ], { provider: "github" });

    expect(routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "/", title: "Home" }),
      expect.objectContaining({
        path: "/contact",
        title: "Contact Us",
        sourceComponent: "ContactPage",
        sourceFile: "src/pages/ContactPage.jsx"
      }),
      expect.objectContaining({ path: "/career", title: "Career" })
    ]));
  });

  it("discovers route metadata from a deployed Vite bundle", () => {
    const routes = discoverSourceRoutes([{
      path: "assets/index.js",
      content: "var routes=[{id:`home`,path:`/`,title:`Home`},{id:`about`,path:`/aboutus`,title:`About Us`},{id:`services`,path:`/services`,title:`Services`},{id:`portfolio`,path:`/portfolio`,title:`Portfolio`},{id:`blog`,path:`/blog`,title:`Blog`},{id:`contact`,path:`/contact`,title:`Contact Us`}];"
    }], { provider: "sftp", revision: "deployed" });

    expect(routes.map(({ path, title }) => ({ path, title }))).toEqual([
      { path: "/", title: "Home" },
      { path: "/aboutus", title: "About Us" },
      { path: "/blog", title: "Blog" },
      { path: "/contact", title: "Contact Us" },
      { path: "/portfolio", title: "Portfolio" },
      { path: "/services", title: "Services" }
    ]);
  });

  it("removes a generated archive root and ignored dependency folders", () => {
    const files = normalizeSourceFiles([
      { path: "owner-project-abc/src/App.jsx", size: 10 },
      { path: "owner-project-abc/node_modules/pkg/index.js", size: 10 },
      { path: "owner-project-abc/package.json", size: 10 }
    ]);

    expect(files.map((file) => file.path)).toEqual(["src/App.jsx", "package.json"]);
  });

  it("accepts a cPanel folder as both the ZIP root and selected project root", () => {
    const files = normalizeSourceFiles([
      { path: "public_html/src/App.jsx", size: 10 },
      { path: "public_html/package.json", size: 10 }
    ], "public_html");

    expect(files.map((file) => file.path)).toEqual(["src/App.jsx", "package.json"]);
  });
});
