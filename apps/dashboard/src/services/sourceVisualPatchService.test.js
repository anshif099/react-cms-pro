import { describe, expect, it } from "vitest";
import {
  buildConnectedPageUrl,
  createRuntimeMessage,
  patchEditableRegionSource
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

  it("does not fabricate a patch for a region declared in another file", () => {
    const source = `<Team />`;
    const result = patchEditableRegionSource(source, "team.title", "Team");

    expect(result.changed).toBe(false);
    expect(result.content).toBe(source);
    expect(result.error).toContain("not declared");
  });
});

describe("connected visual routes", () => {
  it("builds the real deployed page route without exposing it in editor UI", () => {
    expect(buildConnectedPageUrl(
      { domain: "https://triosis.vercel.app/" },
      { route: "/our-team", slug: "our-team" },
      "preview"
    )).toBe(
      "/api/live-preview?target=https%3A%2F%2Ftriosis.vercel.app%2F&route=%2Four-team&mode=preview"
    );
  });

  it("sends the Home route directly to the live preview API", () => {
    expect(buildConnectedPageUrl(
      { domain: "https://triosis.vercel.app/" },
      { route: "/", slug: "home" },
      "preview"
    )).toBe(
      "/api/live-preview?target=https%3A%2F%2Ftriosis.vercel.app%2F&route=%2F&mode=preview"
    );
  });

  it("creates an edit bridge URL and a broadcast runtime message", () => {
    expect(buildConnectedPageUrl(
      { domain: "https://example.com/site" },
      { route: "/contact" },
      "edit"
    )).toBe(
      "/api/live-preview?target=https%3A%2F%2Fexample.com%2Fsite&route=%2Fcontact&mode=edit"
    );
    expect(createRuntimeMessage("rcms/v1/enter-edit-mode", {}).websiteId).toBe("");
  });
});
