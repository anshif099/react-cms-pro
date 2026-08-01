import { afterEach, describe, expect, it, vi } from "vitest";
import sourceImportService from "./sourceImportService";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("GitHub source authentication", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a public repository anonymously when a supplied token is invalid", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url) === "https://api.github.com/repos/anshif099/Triosis") {
        return options.headers?.Authorization
          ? jsonResponse({ message: "Bad credentials" }, 401)
          : jsonResponse({ default_branch: "main", private: false });
      }
      if (String(url).includes("/commits/main")) {
        return jsonResponse({ sha: "abc123" });
      }
      if (String(url).includes("/git/trees/abc123")) {
        return jsonResponse({
          truncated: false,
          tree: [{ type: "blob", path: "src/App.jsx", size: 70 }]
        });
      }
      if (String(url).startsWith("https://raw.githubusercontent.com/")) {
        return new Response(
          '<Route path="/contact" element={<ContactUs />} />',
          { status: 200 }
        );
      }
      return jsonResponse({ message: "Not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const imported = await sourceImportService.importGitHub({
      repositoryUrl: "https://github.com/anshif099/Triosis",
      branch: "main",
      rootDirectory: "main",
      token: "invalid-token"
    });

    expect(imported.manifest.authentication).toBe("anonymous");
    expect(imported.manifest.tokenIgnored).toBe(true);
    expect(imported.manifest.rootIgnored).toBe(true);
    expect(imported.manifest.rootDirectory).toBe("");
    expect(imported.archive).toBeNull();
    expect(sourceImportService.persistCodebase).toBeUndefined();
    expect(imported.routes).toEqual([
      expect.objectContaining({ path: "/contact", title: "Contact Us" })
    ]);
    expect(calls[0].options.headers.Authorization).toBe("Bearer invalid-token");
    expect(calls.slice(1).every((call) => !call.options.headers?.Authorization)).toBe(true);
  });

  it("imports routes through the StackCP SFTP connector", async () => {
    const requests = [];
    const fetchMock = vi.fn(async (url, options = {}) => {
      const request = JSON.parse(options.body);
      requests.push({ url: String(url), request });
      if (request.operation === "list" && request.parameters.directory === "public_html") {
        return jsonResponse({
          data: [
            { name: "package.json", type: "file", size: 60 },
            { name: "src", type: "directory", size: 0 }
          ]
        });
      }
      if (request.operation === "list" && request.parameters.directory === "public_html/src") {
        return jsonResponse({
          data: [{ name: "App.jsx", type: "file", size: 80 }]
        });
      }
      if (request.parameters.filePath === "public_html/package.json") {
        return jsonResponse({
          data: JSON.stringify({ dependencies: { react: "^19.0.0" } })
        });
      }
      return jsonResponse({
        data: '<Route path="/contact" element={<ContactUs />} />'
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const imported = await sourceImportService.importSftp({
      host: "ftp.stackcp.com",
      username: "example.com",
      credential: "rotated-ftp-password",
      rootDirectory: "public_html"
    });

    expect(imported.manifest).toEqual(expect.objectContaining({
      provider: "sftp",
      repository: "sftp://ftp.stackcp.com:22",
      rootDirectory: "public_html",
      authentication: "password"
    }));
    expect(imported.routes).toEqual([
      expect.objectContaining({ path: "/contact", title: "Contact Us" })
    ]);
    expect(requests.every(({ url }) => url === "/api/sftp")).toBe(true);
    expect(requests.every(({ request }) => (
      request.username === "example.com"
      && request.credential === "rotated-ftp-password"
    ))).toBe(true);
  });
});
