import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  get: vi.fn(),
  push: vi.fn(),
  ref: vi.fn(),
  remove: vi.fn(),
  set: vi.fn()
}));
const activityMock = vi.hoisted(() => vi.fn());
const indexMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/firebase", () => ({ database: {} }));
vi.mock("firebase/database", () => firebaseMocks);
vi.mock("./activityLogService", () => ({
  default: { logActivity: activityMock }
}));
vi.mock("./searchService", () => ({
  default: { index: indexMock, removeFromIndex: vi.fn() }
}));

import { MAX_REALTIME_MEDIA_BYTES, mediaService } from "./mediaService";

describe("Realtime Database media service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.ref.mockImplementation((_database, path) => ({ path }));
    firebaseMocks.push.mockReturnValue({ path: "media/site-1/file-1", key: "file-1" });
    firebaseMocks.set.mockResolvedValue(undefined);
    firebaseMocks.remove.mockResolvedValue(undefined);
    indexMock.mockResolvedValue(undefined);
    activityMock.mockResolvedValue(undefined);
  });

  it("uploads bytes and metadata only to Realtime Database", async () => {
    const bytes = new TextEncoder().encode("image-bytes");
    const progress = [];
    const file = {
      name: "logo rose.png",
      type: "image/png",
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.buffer
    };

    const result = await mediaService.upload(
      "site-1",
      file,
      "ai-edited",
      (value) => progress.push(value)
    );

    expect(firebaseMocks.set).toHaveBeenNthCalledWith(1,
      { path: "mediaBlobs/site-1/file-1" },
      expect.objectContaining({
        data: "aW1hZ2UtYnl0ZXM=",
        contentType: "image/png",
        name: "logo rose.png"
      })
    );
    expect(firebaseMocks.set).toHaveBeenNthCalledWith(2,
      { path: "media/site-1/file-1", key: "file-1" },
      expect.objectContaining({
        databasePath: "mediaBlobs/site-1/file-1",
        storage: "realtime-database",
        url: "https://react-cms-pro.vercel.app/api/media?websiteId=site-1&fileId=file-1"
      })
    );
    expect(result.url).toContain("/api/media?");
    expect(result).not.toHaveProperty("storagePath");
    expect(progress).toEqual([5, 45, 85, 100]);
  });

  it("rejects files that cannot be safely delivered by the media endpoint", async () => {
    await expect(mediaService.upload("site-1", {
      name: "large.png",
      type: "image/png",
      size: MAX_REALTIME_MEDIA_BYTES + 1,
      arrayBuffer: vi.fn()
    })).rejects.toThrow("4 MB or smaller");
    expect(firebaseMocks.set).not.toHaveBeenCalled();
  });

  it("deletes both the RTDB blob and metadata", async () => {
    firebaseMocks.get.mockResolvedValue({
      exists: () => true,
      val: () => ({
        name: "logo.png",
        databasePath: "mediaBlobs/site-1/file-1"
      })
    });

    await mediaService.delete("site-1", "file-1");

    expect(firebaseMocks.remove).toHaveBeenNthCalledWith(1,
      { path: "mediaBlobs/site-1/file-1" }
    );
    expect(firebaseMocks.remove).toHaveBeenNthCalledWith(2,
      { path: "media/site-1/file-1" }
    );
  });
});
