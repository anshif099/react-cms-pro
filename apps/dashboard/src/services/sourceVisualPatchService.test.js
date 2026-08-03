import { describe, expect, it } from "vitest";
import {
  buildConnectedPageFallbackUrl,
  buildConnectedPageUrl,
  createRuntimeMessage,
  discoverLocalSourceImports,
  mergeRegionSelection,
  patchEditableRegionSource,
  shouldUseConnectedWebsiteCanvas
} from "./sourceVisualPatchService";

describe("source visual patches", () => {
  it("patches a multiline EditableText default value", () => {
    const source = `
      <EditableText
        regionId="hero.title"
        label="Hero title"
        defaultValue="Old title"
        className="hero"
      />
    `;

    const result = patchEditableRegionSource(source, "hero.title", "New \"visual\" title");

    expect(result.changed).toBe(true);
    expect(result.component).toBe("EditableText");
    expect(result.content).toContain('defaultValue={"New \\"visual\\" title"}');
  });

  it("preserves object values for buttons and images", () => {
    const source = `<EditableButton regionId={'hero.cta'} defaultValue={{ text: 'Start' }} />`;
    const result = patchEditableRegionSource(source, "hero.cta", {
      text: "Book now",
      href: "/contact"
    });

    expect(result.changed).toBe(true);
    expect(result.content).toContain(
      'defaultValue={{"text":"Book now","href":"/contact"}}'
    );
  });

  it("adds defaultValue when an editable section does not have one", () => {
    const source = `<EditableSection regionId="hero.section" className="hero">`;
    const result = patchEditableRegionSource(source, "hero.section", {
      background: "#fff"
    });

    expect(result.changed).toBe(true);
    expect(result.content).toContain(
      'defaultValue={{"background":"#fff"}}'
    );
  });

  it("patches editable values in a deployed Vite bundle", () => {
    const source = '(0,x.jsx)(X,{regionId:`hero.title`,label:`Hero Heading`,defaultValue:`Old heading`,className:`hero-heading`})';
    const result = patchEditableRegionSource(source, "hero.title", "New heading");

    expect(result.changed).toBe(true);
    expect(result.compiled).toBe(true);
    expect(result.content).toContain('defaultValue:"New heading"');
  });

  it("adds a compiled section default value when the bundle omitted it", () => {
    const source = '(0,x.jsx)(Gu,{regionId:`hero.section`,label:`Hero Section`,className:`hero-section`,children:[(0,x.jsx)(X,{regionId:`hero.title`,defaultValue:`Original child heading`})]})';
    const result = patchEditableRegionSource(source, "hero.section", {
      background: "#101010",
      paddingY: 48
    });

    expect(result.changed).toBe(true);
    expect(result.compiled).toBe(true);
    expect(result.content).toContain(
      'defaultValue:{"background":"#101010","paddingY":48}'
    );
    expect(result.content).toContain('defaultValue:`Original child heading`');
  });

  it("does not fabricate a patch for a region declared in another file", () => {
    const source = `<Team />`;
    const result = patchEditableRegionSource(source, "team.title", "Team");

    expect(result.changed).toBe(false);
    expect(result.content).toBe(source);
    expect(result.error).toContain("not declared");
  });

  it("patches a repeated image region through its backing collection item", () => {
    const source = `
      const servicesData = [
        { num: '01', title: 'Digital Marketing', image: img5 },
        { num: '02', title: 'Social Media', image: img6 }
      ];
      {servicesData.map((service) => (
        <EditableImage
          regionId={\`services.\${service.num}.image\`}
          defaultValue={{ src: service.image, alt: service.title }}
        />
      ))}
    `;
    const result = patchEditableRegionSource(
      source,
      "services.01.image",
      { src: "https://cdn.example.com/new.jpg", alt: "Digital Marketing" }
    );

    expect(result.changed).toBe(true);
    expect(result.dynamic).toBe(true);
    expect(result.content).toContain(
      `num: '01', title: 'Digital Marketing', image: "https://cdn.example.com/new.jpg"`
    );
    expect(result.content).toContain(`num: '02', title: 'Social Media', image: img6`);
  });
});

describe("connected source imports", () => {
  it("resolves local component imports and ignores styles and packages", () => {
    const imports = discoverLocalSourceImports(
      "src/pages/home.jsx",
      `
        import React from "react";
        import Services from "../components/Services.jsx";
        import Footer from "../components/Footer";
        import "./home.css";
      `
    );

    expect(imports).toEqual([
      {
        specifier: "../components/Services.jsx",
        candidates: ["src/components/Services.jsx"]
      },
      {
        specifier: "../components/Footer",
        candidates: expect.arrayContaining([
          "src/components/Footer.jsx",
          "src/components/Footer.tsx"
        ])
      }
    ]);
  });
});

describe("connected region selections", () => {
  it("preserves editable metadata when a style-only selection follows", () => {
    const complete = {
      regionId: "hero.title",
      type: "text",
      pageId: "home",
      value: "Strategic Digital Solutions"
    };

    expect(mergeRegionSelection(complete, {
      regionId: "hero.title",
      computedStyle: { fontSize: "72px" }
    })).toEqual({
      ...complete,
      computedStyle: { fontSize: "72px" }
    });
  });
});

describe("connected visual routes", () => {
  it("uses the real website canvas for CMS pages on source-connected sites", () => {
    expect(shouldUseConnectedWebsiteCanvas(
      { sourceConnected: true, domain: "https://triosis.vercel.app/" },
      { source: "cms", isImported: false }
    )).toBe(true);
    expect(shouldUseConnectedWebsiteCanvas(
      { sourceConnected: true, domain: "https://triosis.vercel.app/" },
      { source: "imported", isImported: true }
    )).toBe(false);
  });

  it("loads the real deployed page route in preview mode", () => {
    expect(buildConnectedPageUrl(
      { domain: "https://triosis.vercel.app/" },
      { route: "/our-team", slug: "our-team" },
      "preview"
    )).toBe(
      "https://triosis.vercel.app/our-team?rcms_preview=1"
    );
  });

  it("loads the deployed Home route instead of the proxy endpoint path", () => {
    expect(buildConnectedPageUrl(
      { domain: "https://triosis.vercel.app/" },
      { route: "/", slug: "home" },
      "preview"
    )).toBe(
      "https://triosis.vercel.app/?rcms_preview=1"
    );
  });

  it("creates an edit bridge URL and a broadcast runtime message", () => {
    expect(buildConnectedPageUrl(
      { domain: "https://example.com/site" },
      { route: "/contact" },
      "edit"
    )).toBe(
      "https://example.com/contact?rcms_edit=1"
    );
    expect(createRuntimeMessage("rcms/v1/enter-edit-mode", {}).websiteId).toBe("");
  });

  it("creates a root fallback URL for hosts without SPA deep-link rewrites", () => {
    expect(buildConnectedPageFallbackUrl(
      { domain: "https://triosis.in/" },
      { route: "/faqs", slug: "faqs" },
      "preview"
    )).toBe(
      "https://triosis.in/?page=faqs&rcms_preview=1"
    );
  });
});
