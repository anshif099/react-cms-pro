import { afterEach, describe, expect, it, vi } from "vitest";
import sourceProviderService from "./sourceProviderService";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("connected source providers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads and commits the actual GitHub source file", async () => {
    const calls = [];
    const original = "export default function Contact(){ return <h1>Hello</h1>; }";
    const encoded = btoa(original);
    const fetchMock = vi.fn(async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if ((options.method || "GET") === "PUT") {
        return jsonResponse({
          content: { html_url: "https://github.com/example/repo/blob/main/src/Contact.jsx" },
          commit: {
            sha: "next-revision",
            html_url: "https://github.com/example/repo/commit/next-revision"
          }
        });
      }
      return jsonResponse({
        type: "file",
        sha: "current-revision",
        encoding: "base64",
        content: encoded
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const connection = {
      repository: "example/repo",
      branch: "main",
      rootDirectory: ""
    };
    const read = await sourceProviderService.readGitHubFile(
      connection,
      "src/Contact.jsx"
    );
    expect(read.content).toBe(original);

    const result = await sourceProviderService.writeGitHubFile(
      connection,
      "src/Contact.jsx",
      "export default function Contact(){ return <h1>Updated</h1>; }",
      "Update Contact",
      "write-token"
    );
    expect(result.revision).toBe("next-revision");
    const put = calls.find((call) => call.options.method === "PUT");
    expect(put.options.headers.Authorization).toBe("Bearer write-token");
    expect(JSON.parse(put.options.body)).toEqual(expect.objectContaining({
      message: "Update Contact",
      branch: "main",
      sha: "current-revision"
    }));
  });

  it("refuses GitHub publishing without a write token", async () => {
    await expect(sourceProviderService.writeGitHubFile(
      { repository: "example/repo", branch: "main" },
      "src/App.jsx",
      "content",
      "Update",
      ""
    )).rejects.toThrow("Contents: Read and write");
  });

  it("uses the same-origin cPanel connector for file writes", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      data: { mtime: 1234 }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sourceProviderService.writeCPanelFile(
      {
        endpoint: "https://cpanel.example.com:2083",
        username: "account",
        token: "cpanel-token"
      },
      "public_html/index.html",
      "<h1>Updated</h1>"
    );

    expect(result).toEqual(expect.objectContaining({
      provider: "cpanel",
      path: "public_html/index.html"
    }));
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request).toEqual(expect.objectContaining({
      authMethod: "api-token",
      credential: "cpanel-token",
      operation: "write",
      parameters: {
        filePath: "public_html/index.html",
        content: "<h1>Updated</h1>"
      }
    }));
  });

  it("uses password authentication without trimming the cPanel password", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await sourceProviderService.listCPanelFiles(
      {
        endpoint: "https://cpanel.example.com:2083",
        username: "account",
        authMethod: "password",
        credential: " password with spaces "
      },
      "public_html"
    );

    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request).toEqual(expect.objectContaining({
      authMethod: "password",
      credential: " password with spaces "
    }));
  });

  it("uses the same-origin StackCP SFTP connector for file writes", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      data: { mtime: 4321 }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sourceProviderService.writeSftpFile(
      {
        host: "ftp.stackcp.com",
        port: 22,
        username: "example.com",
        credential: "ftp-password"
      },
      "public_html/index.html",
      "<h1>Updated through SFTP</h1>"
    );

    expect(result).toEqual(expect.objectContaining({
      provider: "sftp",
      revision: 4321,
      path: "public_html/index.html"
    }));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/sftp");
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request).toEqual(expect.objectContaining({
      host: "ftp.stackcp.com",
      port: 22,
      username: "example.com",
      credential: "ftp-password",
      operation: "write",
      parameters: {
        filePath: "public_html/index.html",
        content: "<h1>Updated through SFTP</h1>"
      }
    }));
  });
});
