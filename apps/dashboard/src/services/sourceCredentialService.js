const SESSION_PREFIX = "reactcms_source_credentials:";
const GITHUB_STORAGE_PREFIX = "reactcms_github_credentials:";

function sessionKey(websiteId) {
  return `${SESSION_PREFIX}${websiteId}`;
}

function githubStorageKey(websiteId) {
  return `${GITHUB_STORAGE_PREFIX}${websiteId}`;
}

function parseStoredValue(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function getStorage(name) {
  try {
    return globalThis[name] || null;
  } catch {
    return null;
  }
}

function readStoredValue(storageName, key) {
  try {
    return parseStoredValue(getStorage(storageName)?.getItem(key));
  } catch {
    return {};
  }
}

function writeStoredValue(storageName, key, value) {
  try {
    getStorage(storageName)?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function removeStoredValue(storageName, key) {
  try {
    getStorage(storageName)?.removeItem(key);
  } catch {
    // Treat an unavailable storage area as already cleared.
  }
}

function read(websiteId) {
  if (!websiteId) return {};

  const persistentGitHubValue = readStoredValue(
    "localStorage",
    githubStorageKey(websiteId)
  );
  if (
    persistentGitHubValue.provider === "github"
    && persistentGitHubValue.token
  ) {
    return persistentGitHubValue;
  }

  const sessionValue = readStoredValue("sessionStorage", sessionKey(websiteId));
  if (Object.keys(sessionValue).length) {
    // Migrate tokens saved by older builds from session-only to durable storage.
    if (sessionValue.provider === "github" && sessionValue.token) {
      writeStoredValue(
        "localStorage",
        githubStorageKey(websiteId),
        sessionValue
      );
    }
    return sessionValue;
  }

  return persistentGitHubValue;
}

function write(websiteId, value) {
  if (!websiteId) return;
  writeStoredValue("sessionStorage", sessionKey(websiteId), value);
}

function writeGitHub(websiteId, value) {
  write(websiteId, value);
  if (!websiteId) return;
  writeStoredValue("localStorage", githubStorageKey(websiteId), value);
}

function clearStoredGitHub(websiteId) {
  if (!websiteId) return;
  removeStoredValue("localStorage", githubStorageKey(websiteId));
}

function clearSessionGitHub(websiteId) {
  if (!websiteId) return;
  const value = readStoredValue("sessionStorage", sessionKey(websiteId));
  if (value.provider === "github") {
    removeStoredValue("sessionStorage", sessionKey(websiteId));
  }
}

export const sourceCredentialService = {
  rememberGitHub(websiteId, token) {
    const normalized = String(token || "").trim();
    if (!normalized) return;
    writeGitHub(websiteId, {
      provider: "github",
      token: normalized
    });
  },

  forgetGitHub(websiteId) {
    clearSessionGitHub(websiteId);
    clearStoredGitHub(websiteId);
  },

  rememberCPanel(websiteId, credentials) {
    clearStoredGitHub(websiteId);
    const authMethod = credentials?.authMethod === "password" ? "password" : "api-token";
    const suppliedCredential = credentials?.credential ?? credentials?.token ?? "";
    write(websiteId, {
      provider: "cpanel",
      endpoint: String(credentials?.endpoint || "").trim(),
      username: String(credentials?.username || "").trim(),
      authMethod,
      credential: authMethod === "password"
        ? String(suppliedCredential)
        : String(suppliedCredential).trim()
    });
  },

  rememberSftp(websiteId, credentials) {
    clearStoredGitHub(websiteId);
    write(websiteId, {
      provider: "sftp",
      host: String(credentials?.host || "").trim().toLowerCase(),
      port: Number(credentials?.port || 22),
      username: String(credentials?.username || "").trim(),
      credential: String(credentials?.credential || "")
    });
  },

  get(websiteId) {
    return read(websiteId);
  },

  clear(websiteId) {
    if (!websiteId) return;
    removeStoredValue("sessionStorage", sessionKey(websiteId));
    clearStoredGitHub(websiteId);
  }
};

export default sourceCredentialService;
