import { unzipSync } from "fflate";
import {
  buildSourceManifest,
  isSourceTextFile,
  normalizeSourceFiles
} from "./sourceImportUtils";
import sourceProviderService from "./sourceProviderService";

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 100 * 1024 * 1024;
const MAX_EXTRACTED_FILES = 12000;
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const SKIPPED_SOURCE_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out"
]);

function parseGitHubRepository(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid GitHub repository URL.");
  }
  if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) {
    throw new Error("The repository must be hosted on github.com.");
  }
  const [owner, repositoryName] = url.pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/");
  const repository = repositoryName?.replace(/\.git$/i, "");
  if (!owner || !repository) {
    throw new Error("Use a repository URL such as https://github.com/owner/project.");
  }
  return { owner, repository, fullName: `${owner}/${repository}` };
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token.trim()}` } : {})
  };
}

function inspectZipArchive(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const minimumOffset = Math.max(0, bytes.length - 65557);
  let endOffset = -1;
  for (let index = bytes.length - 22; index >= minimumOffset; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }
  if (endOffset === -1) throw new Error("The ZIP end record is missing.");

  const entryCount = view.getUint16(endOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);
  if (entryCount === 0xffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error("ZIP64 source archives are not supported.");
  }
  if (entryCount > MAX_EXTRACTED_FILES) {
    throw new Error("The archive contains too many files (maximum 12,000).");
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  let cursor = centralDirectoryOffset;
  let totalExtractedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > view.byteLength || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("The ZIP central directory is invalid.");
    }
    const extractedSize = view.getUint32(cursor + 24, true);
    const filenameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const filename = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + filenameLength)
    ).replaceAll("\\", "/");
    if (
      filename.startsWith("/")
      || filename.split("/").some((segment) => segment === "..")
    ) {
      throw new Error(`Unsafe archive path rejected: ${filename}`);
    }
    totalExtractedBytes += extractedSize;
    if (totalExtractedBytes > MAX_EXTRACTED_BYTES) {
      throw new Error("The extracted source exceeds the 100 MB safety limit.");
    }
    cursor += 46 + filenameLength + extraLength + commentLength;
  }
}

async function fetchGitHubJson(url, token) {
  const response = await fetch(url, { headers: githubHeaders(token) });
  if (!response.ok) {
    if (response.status === 401) {
      const error = new Error("GitHub rejected the token. Check its repository access.");
      error.code = "github/unauthorized";
      throw error;
    }
    if (response.status === 403) {
      throw new Error("GitHub rate limit or repository permission blocked the import.");
    }
    if (response.status === 404) {
      throw new Error("GitHub repository or branch was not found.");
    }
    throw new Error(`GitHub import failed (${response.status}).`);
  }
  return response.json();
}

function decodeArchive(archiveBuffer, rootDirectory = "") {
  if (archiveBuffer.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error("The source archive exceeds the 50 MB import limit.");
  }
  inspectZipArchive(archiveBuffer);

  let extracted;
  try {
    extracted = unzipSync(new Uint8Array(archiveBuffer));
  } catch {
    throw new Error("The selected file is not a readable ZIP source archive.");
  }

  const entries = Object.entries(extracted);
  if (entries.length > MAX_EXTRACTED_FILES) {
    throw new Error("The archive contains too many files (maximum 12,000).");
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  return normalizeSourceFiles(entries.map(([path, bytes]) => ({
    path,
    size: bytes.byteLength,
    content: isSourceTextFile(path) && bytes.byteLength <= MAX_TEXT_FILE_BYTES
      ? decoder.decode(bytes)
      : null
  })), rootDirectory);
}

async function sha256(buffer) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sourceResult(files, metadata, filename, buffer = null) {
  const manifest = buildSourceManifest(files, metadata);
  if (!manifest.sourceFileCount) {
    throw new Error("No source files were found in the selected repository root.");
  }
  if (!manifest.routes.length) {
    throw new Error(
      "No website routes were discovered. Select the project root containing package.json and src/pages, app, or router files."
    );
  }
  return {
    archive: buffer ? new Blob([buffer], { type: "application/zip" }) : null,
    filename,
    manifest,
    routes: manifest.routes
  };
}

function cpanelEntries(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function cpanelEntryName(entry) {
  return String(entry?.name || entry?.file || entry?.filename || "")
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");
}

function isCPanelDirectory(entry) {
  return entry?.type === "dir"
    || entry?.type === "directory"
    || entry?.is_dir === 1
    || entry?.is_dir === true;
}

async function downloadCPanelFiles(credentials, rootDirectory, onProgress) {
  const root = String(rootDirectory || "public_html")
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");
  if (!root || root.split("/").some((segment) => segment === "..")) {
    throw new Error("Enter a valid cPanel project root such as public_html.");
  }

  const queue = [root];
  const files = [];
  while (queue.length) {
    const directory = queue.shift();
    onProgress?.(`Reading cPanel directory ${directory}...`);
    const listing = cpanelEntries(
      await sourceProviderService.listCPanelFiles(credentials, directory)
    );
    for (const entry of listing) {
      const name = cpanelEntryName(entry);
      if (!name || name === "." || name === "..") continue;
      const fullPath = `${directory}/${name}`.replace(/\/+/g, "/");
      const relativePath = fullPath.slice(root.length).replace(/^\/+/, "");
      if (!relativePath) continue;
      const segments = relativePath.split("/");
      if (segments.some((segment) => SKIPPED_SOURCE_DIRECTORIES.has(segment))) {
        continue;
      }
      if (isCPanelDirectory(entry)) {
        queue.push(fullPath);
        continue;
      }
      files.push({
        repositoryPath: fullPath,
        path: relativePath,
        size: Number(entry.size || entry.bytes || 0),
        content: null
      });
      if (files.length > MAX_EXTRACTED_FILES) {
        throw new Error("The cPanel project contains too many files (maximum 12,000).");
      }
    }
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_EXTRACTED_BYTES) {
    throw new Error("The cPanel project exceeds the 100 MB inspection limit.");
  }

  const readableFiles = files.filter((file) => (
    isSourceTextFile(file.path) && file.size <= MAX_TEXT_FILE_BYTES
  ));
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(6, readableFiles.length) },
    async () => {
      while (cursor < readableFiles.length) {
        const index = cursor;
        cursor += 1;
        const file = readableFiles[index];
        file.content = await sourceProviderService.readCPanelFile(
          credentials,
          file.repositoryPath
        );
        if ((index + 1) % 20 === 0 || index + 1 === readableFiles.length) {
          onProgress?.(`Reading cPanel source files (${index + 1}/${readableFiles.length})...`);
        }
      }
    }
  );
  await Promise.all(workers);
  return files;
}

function githubTreeFiles(tree, rootDirectory) {
  const root = String(rootDirectory || "")
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");
  const blobs = tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => {
      const repositoryPath = entry.path.replaceAll("\\", "/").replace(/^\/+/, "");
      if (root && repositoryPath !== root && !repositoryPath.startsWith(`${root}/`)) {
        return null;
      }
      const path = root ? repositoryPath.slice(root.length).replace(/^\/+/, "") : repositoryPath;
      if (!path || path.split("/").some((segment) => SKIPPED_SOURCE_DIRECTORIES.has(segment))) {
        return null;
      }
      return {
        repositoryPath,
        path,
        size: entry.size || 0
      };
    })
    .filter(Boolean);

  if (blobs.length > MAX_EXTRACTED_FILES) {
    throw new Error("The repository contains too many files (maximum 12,000).");
  }
  const totalBytes = blobs.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_ARCHIVE_BYTES) {
    throw new Error("The repository source exceeds the 50 MB import limit.");
  }
  return blobs;
}

async function downloadGitHubFiles(files, repository, revision, token, onProgress) {
  const results = new Array(files.length);
  let cursor = 0;
  let completed = 0;
  const workerCount = Math.min(8, files.length);

  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor;
      cursor += 1;
      const file = files[index];
      const encodedPath = file.repositoryPath
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const response = token
        ? await fetch(
          `https://api.github.com/repos/${repository.owner}/${repository.repository}/contents/${encodedPath}?ref=${revision}`,
          {
            headers: {
              ...githubHeaders(token),
              Accept: "application/vnd.github.raw+json"
            }
          }
        )
        : await fetch(
          `https://raw.githubusercontent.com/${repository.owner}/${repository.repository}/${revision}/${encodedPath}`
        );
      if (!response.ok) {
        throw new Error(`GitHub could not download ${file.repositoryPath} (${response.status}).`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      results[index] = { ...file, bytes };
      completed += 1;
      if (completed === files.length || completed % 25 === 0) {
        onProgress?.(`Downloading source files (${completed}/${files.length})...`);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export const sourceImportService = {
  async importGitHub({
    repositoryUrl,
    branch,
    rootDirectory = "",
    token = "",
    onProgress
  }) {
    const repository = parseGitHubRepository(repositoryUrl);
    onProgress?.("Checking GitHub repository...");
    const repositoryApiUrl = `https://api.github.com/repos/${repository.owner}/${repository.repository}`;
    let effectiveToken = token.trim();
    let tokenIgnored = false;
    let repo;
    try {
      repo = await fetchGitHubJson(repositoryApiUrl, effectiveToken);
    } catch (error) {
      if (error.code !== "github/unauthorized" || !effectiveToken) throw error;
      onProgress?.("Token rejected; checking whether the repository is public...");
      try {
        repo = await fetchGitHubJson(repositoryApiUrl, "");
        effectiveToken = "";
        tokenIgnored = true;
      } catch {
        throw error;
      }
    }
    const selectedBranch = branch?.trim() || repo.default_branch;
    const commit = await fetchGitHubJson(
      `https://api.github.com/repos/${repository.owner}/${repository.repository}/commits/${encodeURIComponent(selectedBranch)}`,
      effectiveToken
    );
    const tree = await fetchGitHubJson(
      `https://api.github.com/repos/${repository.owner}/${repository.repository}/git/trees/${commit.sha}?recursive=1`,
      effectiveToken
    );
    if (tree.truncated) {
      throw new Error("GitHub truncated this large repository tree. Choose a smaller project root.");
    }

    let selectedRoot = rootDirectory?.trim() || "";
    let rootIgnored = false;
    if (selectedRoot === selectedBranch) {
      const branchNamedFolderExists = (tree.tree || []).some((entry) => (
        entry.path === selectedRoot || entry.path.startsWith(`${selectedRoot}/`)
      ));
      if (!branchNamedFolderExists) {
        selectedRoot = "";
        rootIgnored = true;
        onProgress?.("Project Root matched the branch name; using the repository root...");
      }
    }

    const treeFiles = githubTreeFiles(tree.tree || [], selectedRoot);
    if (!treeFiles.length) {
      throw new Error("No files were found at the selected GitHub project root.");
    }
    if (effectiveToken && treeFiles.length > 4500) {
      throw new Error("This private repository exceeds the 4,500-file authenticated import limit.");
    }
    onProgress?.(`Downloading source files (0/${treeFiles.length})...`);
    const downloaded = await downloadGitHubFiles(
      treeFiles,
      repository,
      commit.sha,
      effectiveToken,
      onProgress
    );

    const decoder = new TextDecoder("utf-8", { fatal: false });
    const files = downloaded.map((file) => ({
      path: file.path,
      size: file.bytes.byteLength,
      content: isSourceTextFile(file.path) && file.bytes.byteLength <= MAX_TEXT_FILE_BYTES
        ? decoder.decode(file.bytes)
        : null
    }));
    onProgress?.("Inspecting framework and routes...");
    return sourceResult(files, {
      provider: "github",
      repository: repository.fullName,
      branch: selectedBranch,
      revision: commit.sha,
      rootDirectory: selectedRoot,
      authentication: effectiveToken ? "token" : "anonymous",
      tokenIgnored,
      rootIgnored
    }, `${repository.repository}-${commit.sha.slice(0, 8)}`);
  },

  async importCPanelArchive({ file, rootDirectory = "", onProgress }) {
    if (!file) throw new Error("Choose the source ZIP downloaded from cPanel.");
    if (!/\.zip$/i.test(file.name)) {
      throw new Error("The cPanel source backup must be a .zip file.");
    }
    onProgress?.("Reading cPanel source backup...");
    const buffer = await file.arrayBuffer();
    onProgress?.("Inspecting framework and routes...");
    const revision = await sha256(buffer);
    const files = decodeArchive(buffer, rootDirectory);
    return sourceResult(files, {
      provider: "cpanel",
      repository: file.name,
      branch: null,
      revision,
      rootDirectory
    }, file.name, buffer);
  },

  async importCPanel({
    endpoint,
    username,
    authMethod = "api-token",
    credential,
    token,
    rootDirectory = "public_html",
    onProgress
  }) {
    const normalizedAuthMethod = authMethod === "password" ? "password" : "api-token";
    const suppliedCredential = credential ?? token ?? "";
    const credentials = {
      endpoint: String(endpoint || "").trim(),
      username: String(username || "").trim(),
      authMethod: normalizedAuthMethod,
      credential: normalizedAuthMethod === "password"
        ? String(suppliedCredential)
        : String(suppliedCredential).trim()
    };
    if (!credentials.endpoint || !credentials.username || !credentials.credential.trim()) {
      throw new Error(
        `cPanel URL, username, and ${normalizedAuthMethod === "password" ? "password" : "API token"} are required.`
      );
    }
    onProgress?.("Connecting to cPanel File Manager...");
    const files = await downloadCPanelFiles(credentials, rootDirectory, onProgress);
    const revision = String(Date.now());
    onProgress?.("Inspecting framework and routes...");
    return sourceResult(files, {
      provider: "cpanel",
      repository: credentials.endpoint,
      branch: null,
      revision,
      rootDirectory: rootDirectory || "public_html",
      authentication: normalizedAuthMethod
    }, "cpanel-live-source");
  },

  // Source archives intentionally remain with the connected provider.
  // ReactCMS inspects them in memory to discover routes, but never uploads a
  // customer's repository or cPanel files into the ReactCMS Firebase project.
};

export default sourceImportService;
