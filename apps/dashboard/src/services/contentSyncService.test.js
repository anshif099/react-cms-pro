import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  get: vi.fn(),
  ref: vi.fn(),
  remove: vi.fn(),
  set: vi.fn()
}));

vi.mock("../lib/firebase", () => ({ database: {} }));
vi.mock("firebase/database", () => firebaseMocks);

import contentSyncService from "./contentSyncService";

describe("contentSyncService.publishDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.ref.mockImplementation((_database, path) => ({ path }));
    firebaseMocks.set.mockResolvedValue();
  });

  it("repairs serialization placeholders before publishing", async () => {
    firebaseMocks.get.mockImplementation((refObj) => {
      if (refObj.path.includes("/editableRegions/")) {
        return Promise.resolve({
          exists: () => true,
          val: () => ({
            "header~2Enav_link_2": {
              defaultValue: { text: "ABOUT US", href: "about" }
            }
          })
        });
      }
      return Promise.resolve({
        exists: () => true,
        val: () => ({
          title: "Ad",
          regions: {
            "header~2Enav_link_2": "[circular]",
            "hero~2Etitle": "API"
          }
        })
      });
    });

    await expect(contentSyncService.publishDraft("website-1", "ad"))
      .resolves.toBe(true);

    const repairedDraft = {
      title: "Ad",
      regions: {
        "header~2Enav_link_2": { text: "ABOUT US", href: "about" },
        "hero~2Etitle": "API"
      }
    };
    expect(firebaseMocks.set).toHaveBeenCalledWith(
      { path: "content/website-1/sync/draft/pages/ad" },
      repairedDraft
    );
    expect(firebaseMocks.set).toHaveBeenCalledWith(
      { path: "content/website-1/sync/published/pages/ad" },
      expect.objectContaining(repairedDraft)
    );
  });
});
