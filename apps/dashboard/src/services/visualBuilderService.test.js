import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  get: vi.fn(),
  ref: vi.fn(),
  set: vi.fn(),
  update: vi.fn()
}));

vi.mock("../lib/firebase", () => ({ database: {} }));
vi.mock("firebase/database", () => firebaseMocks);

import { visualBuilderService } from "./visualBuilderService";

describe("visualBuilderService draft persistence & hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.ref.mockImplementation((_db, path) => ({ path }));
    firebaseMocks.set.mockResolvedValue();
    firebaseMocks.update.mockResolvedValue();
  });

  it("loads draft regions from candidate keys including hyphenated routes and pageId", async () => {
    firebaseMocks.get.mockImplementation((refObj) => {
      const path = refObj.path || "";
      if (path.includes("api-live-preview")) {
        return Promise.resolve({
          exists: () => true,
          val: () => ({
            regions: {
              "api-live-preview_DOT_hero": { background: "#ffffff" }
            }
          })
        });
      }
      return Promise.resolve({ exists: () => false });
    });

    const regions = await visualBuilderService.loadSavedDraftRegions("website-1", "api/live-preview", {
      pageId: "-Oz64Anykjc0kKIgTaMu",
      route: "/api/live-preview",
      slug: "api-live-preview"
    });

    expect(regions).toEqual({
      "api-live-preview.hero": { background: "#ffffff" }
    });
  });

  it("persists draft payloads across all target candidate keys during saveDraft", async () => {
    await visualBuilderService.saveDraft({
      websiteId: "website-1",
      pageId: "-Oz64Anykjc0kKIgTaMu",
      pageKey: "api/live-preview",
      locale: "en",
      page: { id: "-Oz64Anykjc0kKIgTaMu", slug: "api-live-preview", route: "/api/live-preview" },
      pageSettings: { title: "API Live Preview", slug: "api-live-preview", route: "/api/live-preview" },
      regions: { "api-live-preview.hero": { background: "#ffffff" } },
      blocks: [],
      tree: null
    });

    expect(firebaseMocks.set).toHaveBeenCalledWith(
      { path: "content/website-1/sync/draft/pages/api/live-preview" },
      expect.anything()
    );
    expect(firebaseMocks.set).toHaveBeenCalledWith(
      { path: "content/website-1/sync/draft/pages/api-live-preview" },
      expect.anything()
    );
    expect(firebaseMocks.set).toHaveBeenCalledWith(
      { path: "content/website-1/sync/draft/pages/-Oz64Anykjc0kKIgTaMu" },
      expect.anything()
    );
  });
});
