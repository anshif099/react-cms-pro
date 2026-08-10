import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { decodeMediaBlob, mediaBlobDatabaseUrl } from "../../api/media";

function responseRecorder() {
  const headers = new Map();
  return {
    headers,
    statusCode: 200,
    body: undefined,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end(value) {
      this.body = value;
      return this;
    }
  };
}

describe("Realtime Database media delivery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a constrained Firebase REST URL", () => {
    expect(mediaBlobDatabaseUrl("site-1", "file_1"))
      .toBe("https://react-cms-pro-default-rtdb.firebaseio.com/mediaBlobs/site-1/file_1.json");
    expect(() => mediaBlobDatabaseUrl("site/../../", "file"))
      .toThrow("Invalid media identifier");
  });

  it("decodes base64 and blocks executable content types", () => {
    const result = decodeMediaBlob({
      data: Buffer.from("image-bytes").toString("base64"),
      contentType: "image/png"
    });
    expect(result.buffer.toString()).toBe("image-bytes");
    expect(result.contentType).toBe("image/png");

    expect(decodeMediaBlob({
      data: Buffer.from("<svg/>").toString("base64"),
      contentType: "image/svg+xml"
    }).contentType).toBe("application/octet-stream");
  });

  it("serves a public immutable media response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: Buffer.from("image-bytes").toString("base64"),
        contentType: "image/png"
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = responseRecorder();

    await handler({
      method: "GET",
      query: { websiteId: "site-1", fileId: "file-1" }
    }, response);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://react-cms-pro-default-rtdb.firebaseio.com/mediaBlobs/site-1/file-1.json",
      expect.any(Object)
    );
    expect(response.statusCode).toBe(200);
    expect(response.body.toString()).toBe("image-bytes");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toContain("immutable");
  });

  it("rejects invalid paths without contacting Firebase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = responseRecorder();

    await handler({
      method: "GET",
      query: { websiteId: "../private", fileId: "file" }
    }, response);

    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not found for an absent Realtime Database blob", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => null
    }));
    const response = responseRecorder();

    await handler({
      method: "GET",
      query: { websiteId: "site-1", fileId: "missing" }
    }, response);

    expect(response.statusCode).toBe(404);
  });
});
