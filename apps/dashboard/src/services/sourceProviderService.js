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
  const response = await fetch("/api/cpanel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: credentials.endpoint,
      username: credentials.username,
      token: credentials.token,
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

  async readFile(website, filePath) {
    const connection = website?.connection || {};
    const credentials = sourceCredentialService.get(website?.id);
    if (connection.provider === "github") {
      return this.readGitHubFile(connection, filePath, credentials.token || "");
    }
    if (connection.provider === "cpanel") {
      if (!credentials.endpoint || !credentials.username || !credentials.token) {
        throw new Error("Reconnect the cPanel API session before reading source files.");
      }
      const path = providerPath(connection, filePath);
      const content = await this.readCPanelFile(credentials, path);
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
      if (!credentials.endpoint || !credentials.username || !credentials.token) {
        throw new Error("Reconnect the cPanel API session before publishing.");
      }
      return this.writeCPanelFile(
        credentials,
        providerPath(connection, filePath),
        content
      );
    }
    throw new Error("This website is not connected to a writable source provider.");
  },

  async writeFiles(website, files, message) {
    if (!Array.isArray(files) || !files.length) {
      throw new Error("No connected source files were provided.");
    }
    const results = [];
    for (const file of files) {
      results.push(await this.writeFile(
        website,
        file.path,
        file.content,
        message || `Publish ${file.path} from ReactCMS`
      ));
    }
    return {
      provider: results.at(-1)?.provider || website?.connection?.provider,
      revision: results.at(-1)?.revision || null,
      files: results
    };
  }
};

export default sourceProviderService;
