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

function read(websiteId) {
  if (!websiteId) return {};
  if (typeof sessionStorage !== "undefined") {
    const sessionValue = parseStoredValue(
      sessionStorage.getItem(sessionKey(websiteId))
    );
    if (Object.keys(sessionValue).length) return sessionValue;
  }
  if (typeof localStorage !== "undefined") {
    return parseStoredValue(localStorage.getItem(githubStorageKey(websiteId)));
  }
  return {};
}

function write(websiteId, value) {
  if (!websiteId || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(sessionKey(websiteId), JSON.stringify(value));
}

function writeGitHub(websiteId, value) {
  write(websiteId, value);
  if (!websiteId || typeof localStorage === "undefined") return;
  localStorage.setItem(githubStorageKey(websiteId), JSON.stringify(value));
}

function clearStoredGitHub(websiteId) {
  if (!websiteId || typeof localStorage === "undefined") return;
  localStorage.removeItem(githubStorageKey(websiteId));
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
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(sessionKey(websiteId));
    }
    clearStoredGitHub(websiteId);
  }
};

export default sourceCredentialService;
