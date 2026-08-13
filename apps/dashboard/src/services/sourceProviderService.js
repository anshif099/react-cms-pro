import sourceCredentialService from "./sourceCredentialService";

function normalizeRepository(value) {
  const repository = String(value || "")
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error("The GitHub repository connection is invalid.");
  }
  return repository;
}

function normalizePath(value) {
  const path = String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
  if (!path || path.split("/").some((segment) => segment === "..")) {
    throw new Error("The source file path is invalid.");
  }
  return path;
}

function providerPath(connection, filePath) {
  const root = String(connection?.rootDirectory || "")
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");
  const path = normalizePath(filePath);
  return root ? `${root}/${path}` : path;
}

function githubHeaders(token, accept = "application/vnd.github+json") {
  return {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function bytesToBase64(content) {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToText(content) {
  const binary = atob(String(content || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

async function githubJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...githubHeaders(token),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  if (response.status === 401) {
    throw new Error("GitHub rejected the write token. Reconnect with a valid fine-grained token.");
  }
  if (response.status === 403) {
    throw new Error("GitHub denied this operation. Grant the token Contents: Read and write permission.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `GitHub source operation failed (${response.status}).`);
  }
  return response.json();
}

async function cpanelRequest(credentials, operation, parameters = {}) {
  const authMethod = credentials?.authMethod === "password" ? "password" : "api-token";
  const suppliedCredential = credentials?.credential ?? credentials?.token ?? "";
  const credential = authMethod === "password"
    ? String(suppliedCredential)
    : String(suppliedCredential).trim();
  const response = await fetch("/api/cpanel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: credentials.endpoint,
      username: credentials.username,
      authMethod,
      credential,
      operation,
      parameters
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `cPanel operation failed (${response.status}).`);
  }
  return payload.data;
}

async function sftpRequest(credentials, operation, parameters = {}) {
  const response = await fetch("/api/sftp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: credentials.host,
      port: credentials.port || 22,
      username: credentials.username,
      credential: credentials.credential,
      operation,
      parameters
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `StackCP SFTP operation failed (${response.status}).`);
  }
  return payload.data;
}

function hasSftpCredentials(credentials) {
  return Boolean(
    credentials?.host
    && credentials?.username
    && credentials?.credential
  );
}

function hasCpanelCredentials(credentials) {
  return Boolean(
    credentials?.endpoint
    && credentials?.username
    && (credentials?.credential ?? credentials?.token)
  );
}

const FIREBASE_PUSH_ID_PATTERN = "-[A-Za-z0-9_-]{19}";

export function bindRuntimeWebsiteId(content, websiteId) {
  const source = String(content ?? "");
  const nextWebsiteId = String(websiteId || "").trim();
  if (!new RegExp(`^${FIREBASE_PUSH_ID_PATTERN}$`).test(nextWebsiteId)) {
    return { content: source, changed: false, previousWebsiteIds: [] };
  }

  const previousWebsiteIds = new Set();
  const runtimeWebsiteId = new RegExp(
    "(\\bwebsiteId\\s*[:=]\\s*)([\"'\\x60])(" + FIREBASE_PUSH_ID_PATTERN + ")\\2",
    "g"
  );
  const updated = source.replace(
    runtimeWebsiteId,
    (match, prefix, quote, currentWebsiteId) => {
      if (currentWebsiteId === nextWebsiteId) return match;
      previousWebsiteIds.add(currentWebsiteId);
      return `${prefix}${quote}${nextWebsiteId}${quote}`;
    }
  );

  return {
    content: updated,
    changed: updated !== source,
    previousWebsiteIds: Array.from(previousWebsiteIds)
  };
}

export function versionLocalBuildAssets(html, version = Date.now()) {
  const source = String(html ?? "");
  const cacheVersion = String(version);
  let changedReferences = 0;
  const updated = source.replace(
    /(\b(?:src|href|data-reactcms-app)\s*=\s*)(["'])([^"']+)(\2)/gi,
    (match, prefix, quote, resource, closingQuote) => {
      if (
        /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(resource)
        || /^(?:data|blob):/i.test(resource)
      ) return match;

      const hashIndex = resource.indexOf("#");
      const hash = hashIndex >= 0 ? resource.slice(hashIndex) : "";
      const withoutHash = hashIndex >= 0 ? resource.slice(0, hashIndex) : resource;
      const queryIndex = withoutHash.indexOf("?");
      const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
      if (!/\.(?:js|css)$/i.test(path)) return match;

      const params = new URLSearchParams(
        queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : ""
      );
      params.set("rcms", cacheVersion);
      const nextResource = `${path}?${params.toString()}${hash}`;
      if (nextResource === resource) return match;
      changedReferences += 1;
      return `${prefix}${quote}${nextResource}${closingQuote}`;
    }
  );

  return {
    content: updated,
    changed: updated !== source,
    changedReferences,
    version: cacheVersion
  };
}

export function ensureSpaHtaccess(existingContent = "") {
  const content = String(existingContent || "");
  if (
    content.includes("RewriteEngine On")
    && (
      content.includes("RewriteRule . /index.html")
      || content.includes("RewriteRule ^ index.html")
      || content.includes("RewriteRule . index.html")
      || content.includes("RewriteRule ^/ index.html")
    )
  ) {
    return { content, changed: false };
  }

  const spaBlock = `# ReactCMS SPA Routing
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>
`;

  const updated = content ? `${content.trimEnd()}\n\n${spaBlock}` : spaBlock;
  return { content: updated, changed: true };
}

export const ROUTE_BOOTSTRAP_PATH = "reactcms-route-bootstrap.js";
const DEFAULT_FIREBASE_DATABASE_URL = "https://react-cms-pro-default-rtdb.firebaseio.com";

function escapeHtmlAttribute(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeHtmlAttribute(value) {
  return String(value || "")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

export function ensureRouteDeletionBootstrapHtml(
  existingContent,
  websiteId,
  databaseUrl = DEFAULT_FIREBASE_DATABASE_URL
) {
  const content = String(existingContent || "");
  const modulePattern = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']+["'])[^>]*>\s*<\/script>/gi;
  const moduleScripts = Array.from(content.matchAll(modulePattern));
  const existingBootstrap = moduleScripts.find((match) => (
    /\bdata-reactcms-route-bootstrap(?:\s|=|>)/i.test(match[0])
  ));
  const applicationScript = existingBootstrap || moduleScripts.find((match) => (
    !/reactcms-route-bootstrap\.js/i.test(match[0])
  ));
  if (!applicationScript) {
    throw new Error(
      "ReactCMS could not find the website application module in index.html. Confirm that the document root contains the deployed Vite index.html file."
    );
  }

  const sourceAttribute = applicationScript[0].match(/\bsrc=["']([^"']+)["']/i);
  const currentAppAttribute = applicationScript[0].match(/\bdata-reactcms-app=["']([^"']+)["']/i);
  const applicationSource = decodeHtmlAttribute(
    currentAppAttribute?.[1] || sourceAttribute?.[1]
  );
  if (!applicationSource || /reactcms-route-bootstrap\.js/i.test(applicationSource)) {
    throw new Error("ReactCMS could not identify the original website application module.");
  }

  const replacement = [
    '<script type="module"',
    ` src="/${ROUTE_BOOTSTRAP_PATH}"`,
    ' data-reactcms-route-bootstrap="true"',
    ` data-reactcms-app="${escapeHtmlAttribute(applicationSource)}"`,
    ` data-reactcms-website="${escapeHtmlAttribute(websiteId)}"`,
    ` data-reactcms-database="${escapeHtmlAttribute(String(databaseUrl).replace(/\/$/, ""))}"`,
    '></script>'
  ].join("");
  const start = applicationScript.index;
  const end = start + applicationScript[0].length;
  const updated = `${content.slice(0, start)}${replacement}${content.slice(end)}`;

  return {
    content: updated,
    changed: updated !== content,
    applicationSource
  };
}

export function routeDeletionBootstrapSource() {
  return `const bootstrap = document.querySelector("script[data-reactcms-route-bootstrap]");
const applicationSource = bootstrap?.dataset.reactcmsApp || "";
const websiteId = bootstrap?.dataset.reactcmsWebsite || "";
const databaseUrl = (bootstrap?.dataset.reactcmsDatabase || "").replace(/\\/$/, "");

function routePageKey() {
  try {
    const queryPage = new URLSearchParams(location.search).get("page");
    if (queryPage) return queryPage.replace(/^\\/+|\\/+$/g, "") || "home";
  } catch {}
  return decodeURIComponent(location.pathname).replace(/^\\/+|\\/+$/g, "") || "home";
}

function firebasePath(value) {
  return String(value).split("/").map(encodeURIComponent).join("/");
}

function showDeletedPage() {
  document.title = "404 - Page not found";
  const root = document.getElementById("root") || document.body;
  root.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:32px;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,sans-serif;text-align:center"><div><div style="font-size:72px;font-weight:800;line-height:1;color:#ef4444">404</div><h1 style="margin:20px 0 10px;font-size:36px">Page not found</h1><p style="margin:0 0 28px;color:#64748b">This page has been removed and is no longer available.</p><a href="/" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#2563eb;color:white;text-decoration:none;font-weight:700">Return home</a></div></main>';
  root.setAttribute("data-reactcms-deleted-route", "true");
}

async function start() {
  if (!applicationSource) throw new Error("The ReactCMS application module is missing.");
  if (websiteId && databaseUrl) {
    try {
      const pageKey = routePageKey();
      const response = await fetch(
        databaseUrl + "/content/" + encodeURIComponent(websiteId)
          + "/sync/published/pages/" + firebasePath(pageKey) + ".json",
        { cache: "no-store" }
      );
      const page = response.ok ? await response.json() : null;
      if (page?.deleted === true) {
        showDeletedPage();
        return;
      }
    } catch (error) {
      console.warn("[ReactCMS] Deleted-route check failed; loading the website.", error);
    }
  }
  await import(new URL(applicationSource, location.origin).href);
}

void start();
`;
}

export function isVercelWebsite(website) {
  try {
    const hostname = new URL(String(website?.domain || "")).hostname.toLowerCase();
    return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function ensureVercelSpaConfig(existingContent = "") {
  const source = String(existingContent || "").trim();
  let config = {};
  if (source) {
    try {
      config = JSON.parse(source);
    } catch {
      throw new Error("The connected project's vercel.json is not valid JSON.");
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error("The connected project's vercel.json must contain a JSON object.");
    }
  }

  if (config.rewrites !== undefined && !Array.isArray(config.rewrites)) {
    throw new Error("The connected project's vercel.json rewrites value must be an array.");
  }

  const rewrites = config.rewrites || [];
  const catchAllIndex = rewrites.findIndex((rewrite) => {
    const ruleSource = String(rewrite?.source || "");
    return ["/:path*", "/(.*)", "/**"].includes(ruleSource);
  });
  const configured = catchAllIndex >= 0
    && String(rewrites[catchAllIndex]?.destination || "").split("?")[0] === "/";
  if (configured) {
    return { content: source || `${JSON.stringify(config, null, 2)}\n`, changed: false };
  }

  const spaRewrite = { source: "/:path*", destination: "/" };
  const nextRewrites = catchAllIndex >= 0
    ? rewrites.map((rewrite, index) => index === catchAllIndex ? spaRewrite : rewrite)
    : [...rewrites, spaRewrite];

  return {
    content: `${JSON.stringify({
      ...config,
      rewrites: nextRewrites
    }, null, 2)}\n`,
    changed: true
  };
}

const GIT_CONTENT_GLOBAL = "__REACTCMS_GIT_CONTENT__";

export function parseReactCmsGitContent(existingContent = "") {
  const source = String(existingContent || "").trim();
  if (!source) return {};

  const match = source.match(
    /^(?:window|globalThis)\.__REACTCMS_GIT_CONTENT__\s*=\s*([\s\S]*?);?\s*$/
  );
  if (!match) {
    throw new Error(
      "public/reactcms-content.js is not a ReactCMS Git content manifest."
    );
  }

  let manifest;
  try {
    manifest = JSON.parse(match[1]);
  } catch {
    throw new Error("public/reactcms-content.js contains invalid JSON content.");
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("public/reactcms-content.js must contain a page content object.");
  }
  return manifest;
}

export function mergeReactCmsGitContent(existingContent, pageKey, regions = {}) {
  const page = String(pageKey || "").replace(/^\/+|\/+$/g, "") || "home";
  const manifest = parseReactCmsGitContent(existingContent);
  const currentPage = manifest[page];
  const currentRegions = currentPage && typeof currentPage === "object" && !Array.isArray(currentPage)
    ? currentPage
    : {};
  const safeRegions = Object.fromEntries(
    Object.entries(regions || {}).filter(([, value]) => value !== undefined)
  );
  const nextManifest = {
    ...manifest,
    [page]: {
      ...currentRegions,
      ...safeRegions
    }
  };

  return `window.${GIT_CONTENT_GLOBAL} = ${JSON.stringify(nextManifest, null, 2)};\n`;
}

export function ensureReactCmsContentLoader(existingHtml = "") {
  const source = String(existingHtml || "");
  if (/\bsrc=["']\/reactcms-content\.js["']/i.test(source)) {
    return { content: source, changed: false };
  }

  const loader = '  <script src="/reactcms-content.js"></script>\n';
  const moduleScript = /[ \t]*<script\b[^>]*\btype=["']module["'][^>]*>/i;
  if (moduleScript.test(source)) {
    return {
      content: source.replace(moduleScript, (match) => `${loader}${match.trimStart()}`),
      changed: true
    };
  }
  if (/<\/head>/i.test(source)) {
    return {
      content: source.replace(/<\/head>/i, `${loader}</head>`),
      changed: true
    };
  }
  throw new Error("The connected index.html does not contain a script or head element.");
}

export const sourceProviderService = {
  async readGitHubFile(connection, filePath, token = "") {
    const repository = normalizeRepository(connection?.repository);
    const branch = connection?.branch || "main";
    const path = providerPath(connection, filePath);
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const url = `https://api.github.com/repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
    const file = await githubJson(url, token);
    if (file.type !== "file") throw new Error("The connected GitHub path is not a file.");
    if (file.encoding === "base64" && file.content) {
      return {
        content: base64ToText(file.content),
        sha: file.sha,
        path
      };
    }
    if (!file.download_url) throw new Error("GitHub did not return readable file content.");
    const response = await fetch(file.download_url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) throw new Error(`GitHub could not read ${path}.`);
    return { content: await response.text(), sha: file.sha, path };
  },

  async writeGitHubFile(connection, filePath, content, message, token) {
    const effectiveToken = String(token || "").trim();
    if (!effectiveToken) {
      throw new Error("A GitHub token with Contents: Read and write permission is required to publish.");
    }
    const repository = normalizeRepository(connection?.repository);
    const branch = connection?.branch || "main";
    const path = providerPath(connection, filePath);
    let current = null;
    try {
      current = await this.readGitHubFile(connection, filePath, effectiveToken);
    } catch (error) {
      if (!/not found/i.test(error.message)) throw error;
    }
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const url = `https://api.github.com/repos/${repository}/contents/${encodedPath}`;
    const result = await githubJson(url, effectiveToken, {
      method: "PUT",
      body: JSON.stringify({
        message: message || `Update ${path} from ReactCMS`,
        content: bytesToBase64(String(content ?? "")),
        branch,
        ...(current?.sha ? { sha: current.sha } : {})
      })
    });
    return {
      provider: "github",
      path,
      revision: result.commit?.sha || null,
      url: result.commit?.html_url || result.content?.html_url || null
    };
  },

  async listCPanelFiles(credentials, directory) {
    return cpanelRequest(credentials, "list", { directory });
  },

  async readCPanelFile(credentials, filePath) {
    return cpanelRequest(credentials, "read", { filePath: normalizePath(filePath) });
  },

  async writeCPanelFile(credentials, filePath, content) {
    const data = await cpanelRequest(credentials, "write", {
      filePath: normalizePath(filePath),
      content: String(content ?? "")
    });
    return {
      provider: "cpanel",
      path: normalizePath(filePath),
      revision: data?.mtime || Date.now(),
      url: null
    };
  },

  async listSftpFiles(credentials, directory) {
    return sftpRequest(credentials, "list", { directory });
  },

  async readSftpFile(credentials, filePath) {
    return sftpRequest(credentials, "read", { filePath: normalizePath(filePath) });
  },

  async writeSftpFile(credentials, filePath, content) {
    const path = normalizePath(filePath);
    const data = await sftpRequest(credentials, "write", {
      filePath: path,
      content: String(content ?? "")
    });
    return {
      provider: "sftp",
      path,
      revision: data?.mtime || Date.now(),
      url: null
    };
  },

  async readFile(website, filePath) {
    const connection = website?.connection || {};
    const credentials = sourceCredentialService.get(website?.id);
    if (connection.provider === "github") {
      return this.readGitHubFile(connection, filePath, credentials.token || "");
    }
    if (connection.provider === "cpanel") {
      if (!hasCpanelCredentials(credentials)) {
        throw new Error("Reconnect the cPanel session before reading source files.");
      }
      const path = providerPath(connection, filePath);
      const content = await this.readCPanelFile(credentials, path);
      return { content, path };
    }
    if (connection.provider === "sftp") {
      if (!hasSftpCredentials(credentials)) {
        throw new Error("Reconnect the StackCP SFTP session before reading source files.");
      }
      const path = providerPath(connection, filePath);
      const content = await this.readSftpFile(credentials, path);
      return { content, path };
    }
    throw new Error("This website is not connected to a writable source provider.");
  },

  async writeFile(website, filePath, content, message) {
    const connection = website?.connection || {};
    const credentials = sourceCredentialService.get(website?.id);
    if (connection.provider === "github") {
      return this.writeGitHubFile(
        connection,
        filePath,
        content,
        message,
        credentials.token
      );
    }
    if (connection.provider === "cpanel") {
      if (!hasCpanelCredentials(credentials)) {
        throw new Error("Reconnect the cPanel session before publishing.");
      }
      return this.writeCPanelFile(
        credentials,
        providerPath(connection, filePath),
        content
      );
    }
    if (connection.provider === "sftp") {
      if (!hasSftpCredentials(credentials)) {
        throw new Error("Reconnect the StackCP SFTP session before publishing.");
      }
      return this.writeSftpFile(
        credentials,
        providerPath(connection, filePath),
        content
      );
    }
    throw new Error("This website is not connected to a writable source provider.");
  },

  async ensureSpaRouting(website, options = {}) {
    const provider = website?.connection?.provider;
    const usesHtaccess = provider === "cpanel" || provider === "sftp";
    const usesVercelConfig = provider === "github" && isVercelWebsite(website);
    if (!usesHtaccess && !usesVercelConfig) {
      return { changed: false, configured: false };
    }

    const configPath = usesVercelConfig ? "vercel.json" : ".htaccess";
    if (usesHtaccess && options.skipIfCredentialsUnavailable) {
      const credentials = sourceCredentialService.get(website?.id);
      const hasCredentials = provider === "sftp"
        ? hasSftpCredentials(credentials)
        : hasCpanelCredentials(credentials);
      if (!hasCredentials) {
        return {
          changed: false,
          configured: false,
          deploymentPending: false,
          skipped: true,
          reason: "credentials-unavailable",
          provider,
          path: configPath
        };
      }
    }

    let currentContent = "";
    try {
      const file = await this.readFile(website, configPath);
      currentContent = file?.content || "";
    } catch (error) {
      if (!/not found|no such file|does not exist|could not find/i.test(error?.message || "")) {
        throw error;
      }
    }

    const result = usesVercelConfig
      ? ensureVercelSpaConfig(currentContent)
      : ensureSpaHtaccess(currentContent);
    let writeResult = null;
    if (result.changed) {
      writeResult = await this.writeFile(
        website,
        configPath,
        result.content,
        usesVercelConfig
          ? "Configure Vercel SPA routing for ReactCMS"
          : "Configure SPA routing for ReactCMS"
      );
      const remote = await this.readFile(website, configPath);
      if (String(remote?.content ?? "") !== result.content) {
        throw new Error(
          `The hosting provider accepted ${configPath}, but SPA route verification did not match.`
        );
      }
    }

    const deletionGuard = usesHtaccess && website?.id
      ? await this.ensureRouteDeletionGuard(website)
      : { changed: false, configured: false };

    return {
      changed: result.changed || deletionGuard.changed,
      configured: true,
      deploymentPending: usesVercelConfig,
      provider,
      path: configPath,
      deletionGuardConfigured: deletionGuard.configured,
      deletionGuardChanged: deletionGuard.changed,
      revision: writeResult?.revision || null,
      url: writeResult?.url || null
    };
  },

  async ensureRouteDeletionGuard(website) {
    if (!website?.id) {
      return { changed: false, configured: false, reason: "website-id-unavailable" };
    }

    const indexFile = await this.readFile(website, "index.html");
    const nextIndex = ensureRouteDeletionBootstrapHtml(
      indexFile?.content,
      website.id
    );
    const bootstrapContent = routeDeletionBootstrapSource();
    let currentBootstrap = "";
    try {
      currentBootstrap = (await this.readFile(website, ROUTE_BOOTSTRAP_PATH))?.content || "";
    } catch (error) {
      if (!/not found|no such file|does not exist|could not find/i.test(error?.message || "")) {
        throw error;
      }
    }

    let changed = false;
    if (currentBootstrap !== bootstrapContent) {
      await this.writeFile(
        website,
        ROUTE_BOOTSTRAP_PATH,
        bootstrapContent,
        "Install ReactCMS deleted-route guard"
      );
      const remoteBootstrap = await this.readFile(website, ROUTE_BOOTSTRAP_PATH);
      if (String(remoteBootstrap?.content ?? "") !== bootstrapContent) {
        throw new Error("The deleted-route guard was uploaded but could not be verified.");
      }
      changed = true;
    }

    if (nextIndex.changed) {
      await this.writeFile(
        website,
        "index.html",
        nextIndex.content,
        "Load the ReactCMS deleted-route guard"
      );
      const remoteIndex = await this.readFile(website, "index.html");
      if (String(remoteIndex?.content ?? "") !== nextIndex.content) {
        throw new Error("index.html was updated but the deleted-route guard could not be verified.");
      }
      changed = true;
    }

    return {
      changed,
      configured: true,
      path: ROUTE_BOOTSTRAP_PATH,
      applicationSource: nextIndex.applicationSource
    };
  },

  async writeContentManifest(website, pageKey, regions) {
    const manifestPath = "public/reactcms-content.js";
    let currentManifest = "";
    try {
      currentManifest = (await this.readFile(website, manifestPath))?.content || "";
    } catch (error) {
      if (!/not found|no such file|does not exist|could not find/i.test(error?.message || "")) {
        throw error;
      }
    }

    const indexFile = await this.readFile(website, "index.html");
    const nextManifest = mergeReactCmsGitContent(
      currentManifest,
      pageKey,
      regions
    );
    const nextIndex = ensureReactCmsContentLoader(indexFile.content);
    const files = [];
    if (nextManifest !== currentManifest) {
      files.push({ path: manifestPath, content: nextManifest });
    }
    if (nextIndex.changed) {
      files.push({ path: "index.html", content: nextIndex.content });
    }

    if (!files.length) {
      return {
        provider: website?.connection?.provider,
        revision: null,
        files: [],
        changed: false,
        deploymentPending: false
      };
    }

    const result = await this.writeFiles(
      website,
      files,
      `Publish ${pageKey || "home"} content from ReactCMS`
    );
    return {
      ...result,
      changed: true,
      deploymentPending: isVercelWebsite(website)
    };
  },

  async writeFiles(website, files = [], message) {
    const provider = website?.connection?.provider;
    const verifiesRemoteWrites = provider === "cpanel" || provider === "sftp";

    if (!Array.isArray(files) || (!files.length && !verifiesRemoteWrites)) {
      throw new Error("No connected source files were provided.");
    }

    const preparedFiles = files.map((file) => {
      const binding = bindRuntimeWebsiteId(file.content, website?.id);
      return {
        path: file.path,
        content: binding.content,
        runtimeRebound: binding.changed,
        previousWebsiteIds: binding.previousWebsiteIds
      };
    });
    const results = [];
    for (const file of preparedFiles) {
      const writeResult = await this.writeFile(
        website,
        file.path,
        file.content,
        message || `Publish ${file.path} from ReactCMS`
      );
      if (verifiesRemoteWrites) {
        const remote = await this.readFile(website, file.path);
        if (String(remote?.content ?? "") !== file.content) {
          throw new Error(
            `The hosting server accepted ${file.path}, but read-back verification did not match.`
          );
        }
      }
      results.push({
        ...writeResult,
        verified: verifiesRemoteWrites,
        runtimeRebound: file.runtimeRebound
      });
    }

    let cacheBusted = false;
    let cacheVersion = null;
    if (
      verifiesRemoteWrites
      && preparedFiles.some((file) => /\.(?:js|css)$/i.test(file.path))
    ) {
      const entry = await this.readFile(website, "index.html");
      const versioned = versionLocalBuildAssets(entry.content);
      if (versioned.changed) {
        const writeResult = await this.writeFile(
          website,
          "index.html",
          versioned.content,
          "Refresh deployed ReactCMS assets"
        );
        const remote = await this.readFile(website, "index.html");
        if (String(remote?.content ?? "") !== versioned.content) {
          throw new Error(
            "The hosting server accepted index.html, but cache-refresh verification did not match."
          );
        }
        results.push({
          ...writeResult,
          verified: true,
          cacheManifest: true
        });
        cacheBusted = true;
        cacheVersion = versioned.version;
      }
    }

    if (verifiesRemoteWrites || isVercelWebsite(website)) {
      const htaccessResult = await this.ensureSpaRouting(website);
      if (htaccessResult.changed) {
        results.push({
          ...htaccessResult,
          verified: verifiesRemoteWrites,
          spaRoutingConfigured: true
        });
      }
    }

    return {
      provider: results.at(-1)?.provider || provider,
      revision: results.at(-1)?.revision || null,
      files: results,
      verified: verifiesRemoteWrites,
      cacheBusted,
      cacheVersion,
      runtimeRebound: preparedFiles.some((file) => file.runtimeRebound),
      previousWebsiteIds: Array.from(new Set(
        preparedFiles.flatMap((file) => file.previousWebsiteIds)
      ))
    };
  }
};

export default sourceProviderService;
