import { afterEach, describe, expect, it, vi } from "vitest";
import sourceProviderService, {
  bindRuntimeWebsiteId,
  ensureSpaHtaccess,
  versionLocalBuildAssets
} from "./sourceProviderService";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("connected source providers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rebinds source and compiled runtime providers to the connected website", () => {
    const currentId = "-OyvyiRgLl6QPoiQ9edi";
    const previousId = "-Oy2TPk_l2cl0Fe-H1h1";
    const source = [
      `<RuntimeProvider websiteId="${previousId}" apiKey="key">`,
      `jsx(RuntimeProvider,{websiteId:\`${previousId}\`,apiKey:\`key\`})`,
      `const unrelated = "${previousId}";`
    ].join("\n");

    const result = bindRuntimeWebsiteId(source, currentId);

    expect(result.changed).toBe(true);
    expect(result.previousWebsiteIds).toEqual([previousId]);
    expect(result.content).toContain(`websiteId="${currentId}"`);
    expect(result.content).toContain(`websiteId:\`${currentId}\``);
    expect(result.content).toContain(`unrelated = "${previousId}"`);
  });

  it("versions local JavaScript and CSS references without changing remote assets", () => {
    const html = [
      '<link rel="stylesheet" href="/assets/index.css?theme=dark#app">',
      '<script src="./assets/index.js"></script>',
      '<script src="https://cdn.example.com/library.js"></script>',
      '<img src="/assets/logo.png">'
    ].join("");

    const result = versionLocalBuildAssets(html, 12345);

    expect(result.changedReferences).toBe(2);
    expect(result.content).toContain('/assets/index.css?theme=dark&rcms=12345#app');
    expect(result.content).toContain('./assets/index.js?rcms=12345');
    expect(result.content).toContain('https://cdn.example.com/library.js');
    expect(result.content).toContain('/assets/logo.png');
  });

  it("verifies StackCP writes, reconnects the runtime, and refreshes asset URLs", async () => {
    const currentId = "-OyvyiRgLl6QPoiQ9edi";
    const previousId = "-Oy2TPk_l2cl0Fe-H1h1";
    const remoteFiles = new Map([
      ["index.html", '<script type="module" src="/assets/index.js"></script>']
    ]);
    vi.spyOn(sourceProviderService, "writeFile").mockImplementation(
      async (_website, path, content) => {
        remoteFiles.set(path, content);
        return { provider: "sftp", path, revision: 10, url: null };
      }
    );
    vi.spyOn(sourceProviderService, "readFile").mockImplementation(
      async (_website, path) => ({ path, content: remoteFiles.get(path) })
    );

    const result = await sourceProviderService.writeFiles(
      {
        id: currentId,
        connection: { provider: "sftp", rootDirectory: "." }
      },
      [{
        path: "assets/index.js",
        content: `render({websiteId:\`${previousId}\`})`
      }]
    );

    expect(remoteFiles.get("assets/index.js")).toContain(currentId);
    expect(remoteFiles.get("assets/index.js")).not.toContain(previousId);
    expect(remoteFiles.get("index.html")).toMatch(
      /src="\/assets\/index\.js\?rcms=\d+"/
    );
    expect(result).toEqual(expect.objectContaining({
      provider: "sftp",
      verified: true,
      runtimeRebound: true,
      cacheBusted: true
    }));
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

  it("generates SPA rewrite rules in .htaccess for cPanel/SFTP servers without duplicating", () => {
    const fresh = ensureSpaHtaccess("");
    expect(fresh.changed).toBe(true);
    expect(fresh.content).toContain("RewriteEngine On");
    expect(fresh.content).toContain("RewriteRule . /index.html [L]");

    const existing = ensureSpaHtaccess(fresh.content);
    expect(existing.changed).toBe(false);
  });
});
