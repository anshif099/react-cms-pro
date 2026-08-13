import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/firebase", () => ({ database: {} }));
vi.mock("firebase/database", () => ({
  get: vi.fn(),
  onValue: vi.fn(),
  push: vi.fn(),
  ref: vi.fn(),
  remove: vi.fn(),
  serverTimestamp: vi.fn(),
  set: vi.fn(),
  update: vi.fn()
}));
vi.mock("./activityLogService", () => ({ default: {} }));
vi.mock("./contentSyncService", () => ({ default: {} }));
vi.mock("./revisionService", () => ({ default: {} }));
vi.mock("./searchService", () => ({ default: {} }));

import {
  createDeletedPageTombstone,
  createPageDeletionUpdates
} from "./pageService";

describe("page deletion cleanup", () => {
  it("cleans content by route slug and leaves a live 404 tombstone", () => {
    const updates = createPageDeletionUpdates(
      "website-1",
      "-firebase-page-id",
      {
        title: "Ad",
        slug: "ad",
        route: "/ad",
        routeId: "ad",
        source: "cms",
        isImported: false
      },
      1234
    );

    expect(updates["pages/website-1/-firebase-page-id"]).toBeNull();
    expect(updates["content/website-1/sync/draft/pages/ad"]).toBeNull();
    expect(updates["registry/website-1/routes/ad"]).toBeNull();
    expect(updates["registry/website-1/editableRegions/ad"]).toBeNull();
    expect(updates["revisions/website-1/page/-firebase-page-id"]).toBeNull();
    expect(updates["searchIndex/website-1/-firebase-page-id"]).toBeNull();
    expect(updates["content/website-1/sync/published/pages/ad"]).toMatchObject({
      deleted: true,
      deletedAt: 1234,
      tree: {
        type: "page",
        version: 2,
        metadata: { deleted: true, deletedAt: 1234 }
      }
    });
  });

  it("does not mask a source-owned imported route", () => {
    const updates = createPageDeletionUpdates(
      "website-1",
      "source-page-id",
      {
        slug: "services",
        route: "/services",
        routeId: "services",
        source: "imported",
        isImported: true
      }
    );

    expect(updates["content/website-1/sync/published/pages/services"]).toBeNull();
  });

  it("creates a renderer-compatible deleted page tree", () => {
    const tombstone = createDeletedPageTombstone("nested/page", 99);

    expect(tombstone.tree).toMatchObject({
      id: "deleted-nested-page",
      type: "page",
      version: 2,
      title: "Page not found",
      children: [{
        id: "nested-page-not-found",
        type: "container"
      }]
    });
  });
});
