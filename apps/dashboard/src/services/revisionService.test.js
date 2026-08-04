import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  get: vi.fn(),
  push: vi.fn(),
  ref: vi.fn(),
  set: vi.fn()
}));

vi.mock("../lib/firebase", () => ({ database: {} }));
vi.mock("firebase/database", () => firebaseMocks);

import revisionService from "./revisionService";

describe("revisionService Firebase key handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.ref.mockReturnValue({ path: "revisions/site/page/page-id" });
    firebaseMocks.push.mockReturnValue({ key: "revision-id" });
  });

  it("encodes dotted editable-region ids before saving a snapshot", async () => {
    await revisionService.save("site", "page", "page-id", {
      visualRegions: {
        "ad.body_section": { background: "#191919" }
      }
    }, "editor@example.com");

    expect(firebaseMocks.set).toHaveBeenCalledWith(
      { key: "revision-id" },
      expect.objectContaining({
        snapshot: {
          visualRegions: {
            "ad~2Ebody_section": { background: "#191919" }
          }
        }
      })
    );
  });

  it("decodes editable-region ids when loading a revision", async () => {
    firebaseMocks.get.mockResolvedValue({
      exists: () => true,
      val: () => ({
        id: "revision-id",
        savedAt: 123,
        snapshot: {
          visualRegions: {
            "ad~2Ebody_section": { background: "#191919" }
          }
        }
      })
    });

    const revision = await revisionService.getById(
      "site",
      "page",
      "page-id",
      "revision-id"
    );

    expect(revision.snapshot.visualRegions).toEqual({
      "ad.body_section": { background: "#191919" }
    });
  });
});
