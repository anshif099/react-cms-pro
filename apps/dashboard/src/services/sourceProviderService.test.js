import { afterEach, describe, expect, it, vi } from "vitest";
import sourceProviderService, {
  bindRuntimeWebsiteId,
  ensureReactCmsContentLoader,
  ensureRouteDeletionBootstrapHtml,
  ensureSpaHtaccess,
  ensureVercelSpaConfig,
  mergeReactCmsGitContent,
  parseReactCmsGitContent,
  routeDeletionBootstrapSource,
  verifyExistingLiveRouting,
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
      '<script data-reactcms-app="/assets/app.js?theme=dark"></script>',
      '<script src="https://cdn.example.com/library.js"></script>',
      '<img src="/assets/logo.png">'
    ].join("");

    const result = versionLocalBuildAssets(html, 12345);

    expect(result.changedReferences).toBe(3);
    expect(result.content).toContain('/assets/index.css?theme=dark&rcms=12345#app');
    expect(result.content).toContain('./assets/index.js?rcms=12345');
    expect(result.content).toContain('/assets/app.js?theme=dark&rcms=12345');
    expect(result.content).toContain('https://cdn.example.com/library.js');
    expect(result.content).toContain('/assets/logo.png');
  });

  it("merges page values into a deterministic Git content manifest", () => {
    const existing = 'window.__REACTCMS_GIT_CONTENT__ = {"home":{"home.title":"Home"}};\n';
    const content = mergeReactCmsGitContent(existing, "ad", {
      "ad.title": "API KEY",
      "ad.hero": { background: "#fff" }
    });

    expect(parseReactCmsGitContent(content)).toEqual({
      home: { "home.title": "Home" },
      ad: {
        "ad.title": "API KEY",
        "ad.hero": { background: "#fff" }
      }
    });
  });

  it("loads the Git content manifest before the application module", () => {
    const html = '<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.jsx"></script>\n</body>';
    const result = ensureReactCmsContentLoader(html);

    expect(result.changed).toBe(true);
    expect(result.content.indexOf('/reactcms-content.js')).toBeLessThan(
      result.content.indexOf('/src/main.jsx')
    );
    expect(ensureReactCmsContentLoader(result.content).changed).toBe(false);
  });

  it("replaces the deployed application module with a deleted-route bootstrap", () => {
    const html = '<div id="root"></div><script type="module" crossorigin src="/assets/index.js?theme=dark&amp;rcms=1"></script>';
    const result = ensureRouteDeletionBootstrapHtml(html, "website-1", undefined, 12345);

    expect(result.changed).toBe(true);
    expect(result.applicationSource).toBe("/assets/index.js?theme=dark&rcms=1");
    expect(result.content).toContain('src="/reactcms-route-bootstrap.js?rcms=12345"');
    expect(result.content).toContain('data-reactcms-app="/assets/index.js?theme=dark&amp;rcms=1"');
    expect(result.content).toContain('data-reactcms-website="website-1"');
    expect(ensureRouteDeletionBootstrapHtml(result.content, "website-1").changed).toBe(false);
  });

  it("builds a route guard that checks tombstones before importing the app", () => {
    const source = routeDeletionBootstrapSource();

    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain('page?.deleted === true');
    expect(source).toContain('data-reactcms-deleted-route');
    expect(source).toContain('data-reactcms-published-section-styles');
    expect(source).toContain('element.style.setProperty("background", value.background, "important")');
    expect(source).toContain('sendRuntimeMessage("rcms/v1/enter-edit-mode")');
    expect(source).toContain('window.self === window.top');
    expect(source).toContain('await import(new URL(applicationSource');
  });

  it("writes page content and its loader to the connected Git source", async () => {
    const remoteFiles = new Map([
      ["index.html", '<script type="module" src="/src/main.jsx"></script>']
    ]);
    vi.spyOn(sourceProviderService, "readFile").mockImplementation(
      async (_website, path) => {
        if (!remoteFiles.has(path)) throw new Error("Not Found");
        return { path, content: remoteFiles.get(path) };
      }
    );
    vi.spyOn(sourceProviderService, "writeFiles").mockImplementation(
      async (_website, files) => {
        files.forEach((file) => remoteFiles.set(file.path, file.content));
        return { provider: "github", revision: "content-commit", files };
      }
    );

    const result = await sourceProviderService.writeContentManifest({
      domain: "https://triosis.vercel.app",
      connection: { provider: "github" }
    }, "ad", { "ad.title": "API KEY" });

    expect(result).toEqual(expect.objectContaining({
      provider: "github",
      revision: "content-commit",
      deploymentPending: true
    }));
    expect(parseReactCmsGitContent(remoteFiles.get("public/reactcms-content.js")))
      .toEqual({ ad: { "ad.title": "API KEY" } });
    expect(remoteFiles.get("index.html")).toContain('/reactcms-content.js');
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
      /data-reactcms-app="\/assets\/index\.js\?rcms=\d+"/
    );
    expect(remoteFiles.get("index.html")).toMatch(
      /src="\/reactcms-route-bootstrap\.js\?rcms=\d+"/
    );
    expect(remoteFiles.get("reactcms-route-bootstrap.js"))
      .toContain("page?.deleted === true");
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

  it("merges a Vercel SPA rewrite without replacing existing project configuration", () => {
    const result = ensureVercelSpaConfig(JSON.stringify({
      framework: "vite",
      headers: [{ source: "/assets/:path*", headers: [] }]
    }));
    const config = JSON.parse(result.content);

    expect(result.changed).toBe(true);
    expect(config.framework).toBe("vite");
    expect(config.headers).toHaveLength(1);
    expect(config.rewrites).toContainEqual({
      source: "/:path*",
      destination: "/"
    });
    expect(ensureVercelSpaConfig(result.content).changed).toBe(false);
  });

  it("repairs a cleanUrls rewrite that incorrectly targets index.html", () => {
    const result = ensureVercelSpaConfig(JSON.stringify({
      cleanUrls: true,
      rewrites: [{ source: "/(.*)", destination: "/index.html" }]
    }));

    expect(result.changed).toBe(true);
    expect(JSON.parse(result.content).rewrites).toEqual([
      { source: "/:path*", destination: "/" }
    ]);
  });

  it("rejects an invalid connected vercel.json instead of overwriting it", () => {
    expect(() => ensureVercelSpaConfig("{ invalid"))
      .toThrow("vercel.json is not valid JSON");
  });

  it("writes and verifies SPA routing for a connected StackCP website", async () => {
    let remoteContent = null;
    vi.spyOn(sourceProviderService, "readFile").mockImplementation(
      async (_website, path) => {
        if (path !== ".htaccess") throw new Error("Unexpected path");
        if (remoteContent === null) throw new Error("The source file was not found.");
        return { path, content: remoteContent };
      }
    );
    vi.spyOn(sourceProviderService, "writeFile").mockImplementation(
      async (_website, path, content) => {
        remoteContent = content;
        return { provider: "sftp", path, revision: 10 };
      }
    );

    const result = await sourceProviderService.ensureSpaRouting({
      connection: { provider: "sftp" }
    });

    expect(result).toEqual(expect.objectContaining({
      changed: true,
      configured: true,
      provider: "sftp",
      path: ".htaccess"
    }));
    expect(remoteContent).toContain("RewriteRule . /index.html [L]");
  });

  it("does not report publish routing success when StackCP cannot be reached", async () => {
    vi.spyOn(sourceProviderService, "readFile").mockRejectedValue(
      new Error("Reconnect the StackCP SFTP session before publishing.")
    );
    const write = vi.spyOn(sourceProviderService, "writeFile");

    await expect(sourceProviderService.ensureSpaRouting({
      connection: { provider: "sftp" }
    })).rejects.toThrow("Reconnect the StackCP SFTP session");
    expect(write).not.toHaveBeenCalled();
  });

  it("skips the visual-only routing check when StackCP credentials are unavailable", async () => {
    const read = vi.spyOn(sourceProviderService, "readFile");
    const write = vi.spyOn(sourceProviderService, "writeFile");

    const result = await sourceProviderService.ensureSpaRouting({
      id: "client-site",
      connection: { provider: "sftp" }
    }, {
      skipIfCredentialsUnavailable: true
    });

    expect(result).toEqual(expect.objectContaining({
      changed: false,
      configured: false,
      skipped: true,
      reason: "credentials-unavailable",
      provider: "sftp",
      path: ".htaccess"
    }));
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("verifies existing customer routes without exposing hosting credentials", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        status: 200,
        url: "https://triosis.in/reactcms-route-check-test"
      }))
      .mockResolvedValueOnce(new Response(
        'document.querySelector("script[data-reactcms-route-bootstrap]"); data-reactcms-deleted-route data-reactcms-published-section-styles',
        { status: 200, headers: { "Content-Type": "text/javascript" } }
      ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyExistingLiveRouting({
      domain: "https://triosis.in",
      connection: { provider: "sftp", spaRoutingPath: ".htaccess" }
    });

    expect(result).toEqual(expect.objectContaining({
      configured: true,
      deletionGuardConfigured: true,
      publishedStyleBridgeConfigured: true,
      verified: true,
      provider: "sftp",
      path: ".htaccess"
    }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("%2Freactcms-route-check-");
    expect(fetchMock.mock.calls[1][0]).toContain("reactcms-route-bootstrap.js");
  });

  it("does not trust a failed nested route probe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ ok: false, status: 404, url: "https://triosis.in/missing" })
    ));

    await expect(verifyExistingLiveRouting({
      domain: "https://triosis.in",
      connection: { provider: "sftp" }
    })).rejects.toThrow("HTTP 404");
  });

  it("does not mark customer routing complete when the deletion guard is absent", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200 }))
      .mockResolvedValueOnce(new Response("console.log('site asset')", { status: 200 }))
    );

    await expect(verifyExistingLiveRouting({
      domain: "https://triosis.in",
      connection: { provider: "sftp" }
    })).rejects.toThrow("deleted-route guard is not installed");
  });

  it("requires a route repair when the published section-style bridge is outdated", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200 }))
      .mockResolvedValueOnce(new Response(
        'data-reactcms-route-bootstrap data-reactcms-deleted-route',
        { status: 200 }
      ))
    );

    await expect(verifyExistingLiveRouting({
      domain: "https://triosis.in",
      connection: { provider: "sftp" }
    })).rejects.toThrow("published-style bridge is outdated");
  });

  it("commits and verifies SPA routing for a GitHub-connected Vercel site", async () => {
    let remoteContent = null;
    vi.spyOn(sourceProviderService, "readFile").mockImplementation(
      async (_website, path) => {
        if (path !== "vercel.json") throw new Error("Unexpected path");
        if (remoteContent === null) throw new Error("Not Found");
        return { path, content: remoteContent };
      }
    );
    vi.spyOn(sourceProviderService, "writeFile").mockImplementation(
      async (_website, path, content) => {
        remoteContent = content;
        return {
          provider: "github",
          path,
          revision: "routing-commit",
          url: "https://github.com/example/site/commit/routing-commit"
        };
      }
    );

    const result = await sourceProviderService.ensureSpaRouting({
      domain: "https://triosis.vercel.app",
      connection: { provider: "github" }
    });

    expect(result).toEqual(expect.objectContaining({
      changed: true,
      configured: true,
      deploymentPending: true,
      provider: "github",
      path: "vercel.json",
      revision: "routing-commit"
    }));
    expect(JSON.parse(remoteContent).rewrites).toContainEqual({
      source: "/:path*",
      destination: "/"
    });
  });
});
