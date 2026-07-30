const SESSION_PREFIX = "reactcms_source_credentials:";

function sessionKey(websiteId) {
  return `${SESSION_PREFIX}${websiteId}`;
}

function read(websiteId) {
  if (!websiteId || typeof sessionStorage === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey(websiteId)) || "{}");
  } catch {
    return {};
  }
}

function write(websiteId, value) {
  if (!websiteId || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(sessionKey(websiteId), JSON.stringify(value));
}

export const sourceCredentialService = {
  rememberGitHub(websiteId, token) {
    const normalized = String(token || "").trim();
    if (!normalized) return;
    write(websiteId, {
      provider: "github",
      token: normalized
    });
  },

  rememberCPanel(websiteId, credentials) {
    write(websiteId, {
      provider: "cpanel",
      endpoint: String(credentials?.endpoint || "").trim(),
      username: String(credentials?.username || "").trim(),
      token: String(credentials?.token || "").trim()
    });
  },

  get(websiteId) {
    return read(websiteId);
  },

  clear(websiteId) {
    if (!websiteId || typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(sessionKey(websiteId));
  }
};

export default sourceCredentialService;
