const SOURCE_EXTENSIONS = new Set([
  "astro",
  "css",
  "html",
  "htm",
  "js",
  "jsx",
  "json",
  "less",
  "md",
  "mdx",
  "mjs",
  "cjs",
  "sass",
  "scss",
  "svelte",
  "ts",
  "tsx",
  "vue",
  "yaml",
  "yml"
]);

const SKIPPED_SEGMENTS = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out"
]);

function extension(path) {
  const filename = path.split("/").pop() || "";
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

function cleanPath(path) {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function commonArchiveRoot(paths) {
  if (!paths.length) return "";
  const firstSegments = paths.map((path) => cleanPath(path).split("/")[0]);
  const candidate = firstSegments[0];
  return candidate && firstSegments.every((segment) => segment === candidate)
    ? `${candidate}/`
    : "";
}

export function normalizeSourceFiles(entries, rootDirectory = "") {
  const sourceEntries = entries
    .map((entry) => ({ ...entry, path: cleanPath(entry.path) }))
    .filter((entry) => entry.path && !entry.path.endsWith("/"));
  const archiveRoot = commonArchiveRoot(sourceEntries.map((entry) => entry.path));
  const requestedRoot = cleanPath(rootDirectory).replace(/\/+$/, "");
  const effectiveRequestedRoot = archiveRoot.replace(/\/$/, "") === requestedRoot
    ? ""
    : requestedRoot;

  return sourceEntries
    .map((entry) => {
      let path = archiveRoot && entry.path.startsWith(archiveRoot)
        ? entry.path.slice(archiveRoot.length)
        : entry.path;
      if (effectiveRequestedRoot) {
        if (path !== effectiveRequestedRoot && !path.startsWith(`${effectiveRequestedRoot}/`)) {
          return null;
        }
        path = path === effectiveRequestedRoot
          ? path
          : path.slice(effectiveRequestedRoot.length + 1);
      }
      return { ...entry, path };
    })
    .filter(Boolean)
    .filter((entry) => {
      const segments = entry.path.split("/");
      return !segments.some((segment) => SKIPPED_SEGMENTS.has(segment));
    });
}

export function isSourceTextFile(path) {
  const normalized = cleanPath(path);
  if (!normalized || normalized.endsWith("/")) return false;
  if (normalized.split("/").some((segment) => SKIPPED_SEGMENTS.has(segment))) {
    return false;
  }
  return SOURCE_EXTENSIONS.has(extension(normalized));
}

function parsePackageJson(files) {
  const packageFile = files.find((file) => file.path === "package.json")
    || files.find((file) => file.path.endsWith("/package.json"));
  if (!packageFile?.content) return null;
  try {
    return JSON.parse(packageFile.content);
  } catch {
    return null;
  }
}

export function detectSourceFramework(files) {
  const pkg = parsePackageJson(files);
  const dependencies = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {})
  };
  const paths = files.map((file) => file.path);

  if (dependencies.next || paths.some((path) => /(^|\/)next\.config\./.test(path))) {
    return "Next.js";
  }
  if (dependencies.astro || paths.some((path) => /(^|\/)astro\.config\./.test(path))) {
    return "Astro";
  }
  if (dependencies["@sveltejs/kit"]) return "SvelteKit";
  if (dependencies.vue || dependencies.nuxt) return dependencies.nuxt ? "Nuxt" : "Vue";
  if (dependencies.vite || paths.some((path) => /(^|\/)vite\.config\./.test(path))) {
    return dependencies.react ? "React + Vite" : "Vite";
  }
  if (dependencies.react) return "React";
  if (paths.some((path) => /\.(html?|css)$/.test(path))) return "Static HTML";
  return "Other";
}

function routeTitle(path) {
  if (path === "/") return "Home";
  const last = path
    .split("/")
    .filter(Boolean)
    .filter((part) => !part.startsWith(":"))
    .pop() || "Page";
  return last
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function componentTitle(component) {
  if (!component) return null;
  return component
    .replace(/(?:Page|View|Screen)$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || null;
}

function sourceRouteLabel(content, path) {
  const objects = content.match(/\{[^{}]{0,500}\}/g) || [];
  for (const object of objects) {
    const objectPath = object.match(/\bpath\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
    if (normalizeRoutePath(objectPath) !== path) continue;
    const label = object.match(/\b(?:label|title)\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
    if (label) return label.trim();
  }
  return null;
}

function normalizeRoutePath(path) {
  const raw = String(path || "").trim();
  if (!raw || raw === "*" || raw.startsWith("http")) return null;
  const withoutQuery = raw.split("?")[0].split("#")[0];
  if (!withoutQuery || withoutQuery === "index") return "/";
  const prefixed = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return prefixed.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function routeId(path) {
  if (path === "/") return "home";
  return path
    .replace(/^\/+|\/+$/g, "")
    .replace(/[:*[\]]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "home";
}

function sourceComponentNear(content, matchIndex) {
  const nearby = content.slice(matchIndex, matchIndex + 400);
  const elementMatch = nearby.match(/\belement\s*=\s*\{\s*<([A-Z][A-Za-z0-9_]*)/);
  if (elementMatch) return elementMatch[1];
  const componentMatch = nearby.match(/\bComponent\s*:\s*([A-Z][A-Za-z0-9_]*)/);
  return componentMatch?.[1] || null;
}

function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = fromFile.split("/").slice(0, -1);
  specifier.split("/").forEach((segment) => {
    if (!segment || segment === ".") return;
    if (segment === "..") base.pop();
    else base.push(segment);
  });
  return base.join("/");
}

function resolveComponentSource(files, routerFile, component) {
  if (!component || !routerFile.content) return null;
  const escaped = component.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`import\\s+${escaped}\\s+from\\s+["']([^"']+)["']`),
    new RegExp(`import\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`)
  ];
  const specifier = patterns.map((pattern) => routerFile.content.match(pattern)?.[1]).find(Boolean);
  if (!specifier) return null;
  const resolved = resolveRelativeImport(routerFile.path, specifier);
  if (!resolved) return null;
  const candidates = [
    resolved,
    ...["js", "jsx", "ts", "tsx", "mjs", "cjs", "vue", "svelte", "astro"].map((ext) => `${resolved}.${ext}`),
    ...["js", "jsx", "ts", "tsx"].map((ext) => `${resolved}/index.${ext}`)
  ];
  return files.find((file) => candidates.includes(file.path)) || null;
}

function nextRouteFromFile(path) {
  const normalized = cleanPath(path);
  let relative = null;
  const appMatch = normalized.match(/(?:^|\/)(?:src\/)?app\/(.+\/)?page\.(?:js|jsx|ts|tsx)$/);
  if (appMatch) relative = appMatch[1] || "";

  if (relative === null) {
    const pagesMatch = normalized.match(/(?:^|\/)(?:src\/)?pages\/(.+)\.(?:js|jsx|ts|tsx|md|mdx)$/);
    if (!pagesMatch) return null;
    relative = pagesMatch[1]
      .replace(/(^|\/)index$/, "$1")
      .replace(/^_.*$/, "");
  }

  const parts = relative
    .split("/")
    .filter(Boolean)
    .filter((part) => !/^\(.+\)$/.test(part))
    .map((part) => part.replace(/^\[\.\.\.(.+)\]$/, "*$1").replace(/^\[(.+)\]$/, ":$1"));
  return normalizeRoutePath(parts.join("/") || "/");
}

function conventionalRouteFromFile(path) {
  const normalized = cleanPath(path);
  const match = normalized.match(/(?:^|\/)(?:src\/)?(?:pages|views|routes)\/(.+)\.(?:js|jsx|ts|tsx|astro|vue|svelte|html?)$/);
  if (!match) return null;
  const relative = match[1]
    .replace(/(^|\/)(index|home)$/i, "$1")
    .replace(/Page$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
  return normalizeRoutePath(relative);
}

export function discoverSourceRoutes(files, sourceMetadata = {}) {
  const discovered = [];

  const add = (path, file, component = null) => {
    const normalized = normalizeRoutePath(path);
    if (!normalized) return;
    const componentFile = resolveComponentSource(files, file, component);
    discovered.push({
      id: routeId(normalized),
      path: normalized,
      route: normalized,
      slug: normalized === "/" ? "home" : normalized.replace(/^\//, ""),
      title: sourceRouteLabel(file.content || "", normalized)
        || componentTitle(component)
        || routeTitle(normalized),
      layout: "default",
      source: "imported",
      isImported: true,
      sourceProvider: sourceMetadata.provider || null,
      sourceFile: componentFile?.path || file.path,
      sourceRouterFile: componentFile ? file.path : null,
      sourceComponent: component,
      sourceRevision: sourceMetadata.revision || null,
      nativeArtifactStatus: "source-only"
    });
  };

  files.forEach((file) => {
    if (!file.content || !/\.(?:js|jsx|ts|tsx|mjs|cjs)$/.test(file.path)) return;
    const patterns = [
      /<Route\b[^>]*\bpath\s*=\s*(?:["'`]([^"'`]+)["'`]|\{\s*["'`]([^"'`]+)["'`]\s*\})/g,
      /\bpath\s*:\s*["'`]([^"'`]+)["'`]/g
    ];
    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(file.content))) {
        add(match[1] || match[2], file, sourceComponentNear(file.content, match.index));
      }
    });

    const routeMapPattern = /["'`](\/[^"'`]*)["'`]\s*:\s*["'`]([^"'`]+)["'`]/g;
    let routeMapMatch;
    while ((routeMapMatch = routeMapPattern.exec(file.content))) {
      const stateKey = routeMapMatch[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const componentMatch = file.content.match(
        new RegExp(`currentPage\\s*===\\s*["'\`]${stateKey}["'\`][\\s\\S]{0,160}?<([A-Z][A-Za-z0-9_]*)`)
      );
      add(routeMapMatch[1], file, componentMatch?.[1] || null);
    }
  });

  if (!discovered.length) {
    files.forEach((file) => {
      const route = nextRouteFromFile(file.path) || conventionalRouteFromFile(file.path);
      if (route) add(route, file);
    });
  }

  if (!discovered.length) {
    const indexFile = files.find((file) => /(^|\/)index\.html?$/.test(file.path));
    if (indexFile) add("/", indexFile);
  }

  const unique = new Map();
  discovered.forEach((route) => {
    const current = unique.get(route.path);
    if (!current || (!current.sourceComponent && route.sourceComponent)) {
      unique.set(route.path, route);
    }
  });

  return Array.from(unique.values()).sort((a, b) => {
    if (a.path === "/") return -1;
    if (b.path === "/") return 1;
    return a.path.localeCompare(b.path);
  });
}

export function buildSourceManifest(files, metadata = {}) {
  const textFiles = files.filter((file) => isSourceTextFile(file.path));
  const framework = detectSourceFramework(textFiles);
  const routes = discoverSourceRoutes(textFiles, metadata);
  return {
    provider: metadata.provider,
    repository: metadata.repository || null,
    branch: metadata.branch || null,
    revision: metadata.revision || null,
    rootDirectory: metadata.rootDirectory || "",
    authentication: metadata.authentication || null,
    tokenIgnored: !!metadata.tokenIgnored,
    rootIgnored: !!metadata.rootIgnored,
    rootAdjusted: !!metadata.rootAdjusted,
    framework,
    fileCount: files.length,
    sourceFileCount: textFiles.length,
    totalBytes: files.reduce((total, file) => total + (file.size || 0), 0),
    files: files.map((file) => ({
      path: file.path,
      size: file.size || 0,
      source: isSourceTextFile(file.path)
    })),
    routes
  };
}
