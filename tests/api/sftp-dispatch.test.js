import { beforeEach, describe, expect, it, vi } from "vitest";
import rootHandler from "../../api/live-preview.js";
import dashboardHandler from "../../apps/dashboard/api/live-preview.js";

const client = vi.hoisted(() => ({
  connect: vi.fn(),
  list: vi.fn(),
  end: vi.fn()
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
}));
vi.mock("ssh2-sftp-client", () => ({
  default: class { constructor() { return client; } }
}));

describe.each([["repository", rootHandler], ["dashboard", dashboardHandler]])(
  "%s SFTP dispatch",
  (_name, handler) => {
    beforeEach(() => {
      vi.clearAllMocks();
      client.connect.mockResolvedValue(undefined);
      client.end.mockResolvedValue(undefined);
      client.list.mockResolvedValue([{ name: "index.html", type: "-", size: 20, modifyTime: 100 }]);
    });

    it("loads the client and returns the remote directory listing", async () => {
      const response = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      };
      await handler({
        method: "POST",
        query: { sftp: "1" },
        body: {
          host: "ftp.stackcp.com", username: "test-account", credential: "test-password",
          operation: "list", parameters: { directory: "public_html" }
        }
      }, response);
      expect(client.connect).toHaveBeenCalledOnce();
      expect(client.list).toHaveBeenCalledWith("public_html");
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        data: [{ name: "index.html", type: "file", size: 20, mtime: 100 }]
      });
      expect(client.end).toHaveBeenCalledOnce();
    });
  }
);
