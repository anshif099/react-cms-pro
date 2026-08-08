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
    /(\b(?:src|href)\s*=\s*)(["'])([^"']+)(\2)/gi,
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
      if (
        !credentials.endpoint
        || !credentials.username
        || !(credentials.credential ?? credentials.token)
      ) {
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
      if (
        !credentials.endpoint
        || !credentials.username
        || !(credentials.credential ?? credentials.token)
      ) {
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

  async ensureSpaRouting(website) {
    const provider = website?.connection?.provider;
    if (provider !== "cpanel" && provider !== "sftp") {
      return { changed: false, configured: false };
    }

    let currentContent = "";
    try {
      const file = await this.readFile(website, ".htaccess");
      currentContent = file?.content || "";
    } catch (error) {
      if (!/not found|no such file|does not exist|could not find/i.test(error?.message || "")) {
        throw error;
      }
    }

    const result = ensureSpaHtaccess(currentContent);
    if (!result.changed) {
      return { changed: false, configured: true, provider, path: ".htaccess" };
    }

    await this.writeFile(
      website,
      ".htaccess",
      result.content,
      "Configure SPA routing for ReactCMS"
    );
    const remote = await this.readFile(website, ".htaccess");
    if (String(remote?.content ?? "") !== result.content) {
      throw new Error(
        "The hosting server accepted .htaccess, but SPA route verification did not match."
      );
    }

    return {
      changed: true,
      configured: true,
      provider,
      path: ".htaccess"
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

    if (verifiesRemoteWrites) {
      const htaccessResult = await this.ensureSpaRouting(website);
      if (htaccessResult.changed) {
        results.push({
          provider,
          path: ".htaccess",
          revision: Date.now(),
          verified: true,
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
