import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const ALLOWED_OPERATIONS = new Set(["list", "read", "write"]);

function isPrivateAddress(address) {
  const normalized = String(address || "").toLowerCase();
  if (normalized.includes(":")) {
    return normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe8")
      || normalized.startsWith("fe9")
      || normalized.startsWith("fea")
      || normalized.startsWith("feb");
  }
  const octets = normalized.split(".").map(Number);
  return (
    octets[0] === 0
    || octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
    || octets[0] >= 224
  );
}

async function safeEndpoint(value) {
  const url = new URL(String(value || ""));
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:") throw new Error("cPanel must use an HTTPS URL.");
  if (url.port && !["2083", "443"].includes(url.port)) {
    throw new Error("cPanel must use port 2083 or 443.");
  }
  if (
    hostname === "localhost"
    || hostname.endsWith(".local")
    || isIP(hostname)
  ) {
    throw new Error("The cPanel hostname is not allowed.");
  }
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("The cPanel hostname must resolve to a public server.");
  }
  return `${url.protocol}//${url.host}`;
}

function safePath(value) {
  const path = String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
  if (!path || path.split("/").some((segment) => segment === "..")) {
    throw new Error("The cPanel path is invalid.");
  }
  return path;
}

function splitFilePath(value) {
  const path = safePath(value);
  const parts = path.split("/");
  const file = parts.pop();
  return { directory: parts.join("/") || ".", file };
}

function cpanelError(payload) {
  const candidates = [
    payload?.result?.errors,
    payload?.result?.messages,
    payload?.errors,
    payload?.error,
    payload?.message,
    payload?.cpanelresult?.error,
    payload?.cpanelresult?.data?.reason
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const message = candidate.filter(Boolean).join(" ");
      if (message) return message;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "cPanel rejected the file operation.";
}

export function incompatiblePanelError(hostname, status, location = "") {
  const redirectDetail = location ? ` It redirected to ${location}.` : "";
  return `The server ${hostname} does not provide the cPanel UAPI endpoint (${status}).${redirectDetail} If this hosting account uses StackCP/20i, connect with its unlocked SFTP/FTP details instead of the control-panel URL.`;
}

export function cpanelAuthorizationHeader(username, credential, authMethod = "api-token") {
  const normalizedUsername = String(username || "").trim();
  const suppliedCredential = String(credential || "");
  if (authMethod === "password") {
    return `Basic ${Buffer.from(
      `${normalizedUsername}:${suppliedCredential}`,
      "utf8"
    ).toString("base64")}`;
  }
  return `cpanel ${normalizedUsername}:${suppliedCredential.trim()}`;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const {
      endpoint,
      username,
      authMethod = "api-token",
      credential,
      token,
      operation,
      parameters = {}
    } = request.body || {};
    if (!ALLOWED_OPERATIONS.has(operation)) {
      return response.status(400).json({ error: "Unsupported cPanel operation." });
    }
    const normalizedAuthMethod = authMethod === "password" ? "password" : "api-token";
    const suppliedCredential = credential ?? token ?? "";
    if (!String(username || "").trim() || !String(suppliedCredential).trim()) {
      return response.status(400).json({
        error: `cPanel username and ${normalizedAuthMethod === "password" ? "password" : "API token"} are required.`
      });
    }
    if (String(parameters.content || "").length > 2 * 1024 * 1024) {
      return response.status(413).json({ error: "A cPanel source file cannot exceed 2 MB." });
    }

    const baseUrl = await safeEndpoint(endpoint);
    let functionName;
    let form;
    if (operation === "list") {
      functionName = "list_files";
      form = new URLSearchParams({
        dir: safePath(parameters.directory),
        show_hidden: "1",
        include_mime: "1"
      });
    } else if (operation === "read") {
      functionName = "get_file_content";
      const { directory, file } = splitFilePath(parameters.filePath);
      form = new URLSearchParams({
        dir: directory,
        file,
        from_charset: "UTF-8",
        to_charset: "UTF-8"
      });
    } else {
      functionName = "save_file_content";
      const { directory, file } = splitFilePath(parameters.filePath);
      form = new URLSearchParams({
        dir: directory,
        file,
        content: String(parameters.content ?? ""),
        from_charset: "UTF-8",
        to_charset: "UTF-8"
      });
    }

    const upstream = await fetch(`${baseUrl}/execute/Fileman/${functionName}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        Authorization: cpanelAuthorizationHeader(
          username,
          suppliedCredential,
          normalizedAuthMethod
        ),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: form
    });
    const responseText = await upstream.text();
    let payload = null;
    try {
      payload = JSON.parse(responseText);
    } catch {
      // A real cPanel UAPI response is JSON. HTML commonly means the URL is
      // another control panel or a web-login redirect.
    }
    if (upstream.status === 401) {
      return response.status(401).json({
        error: normalizedAuthMethod === "password"
          ? "cPanel rejected the username or password. Check the account login details."
          : "cPanel rejected the username or API token. Check the token and account details."
      });
    }
    if (!payload && (upstream.status === 404 || upstream.status >= 300 && upstream.status < 400)) {
      return response.status(400).json({
        error: incompatiblePanelError(
          new URL(baseUrl).hostname,
          upstream.status,
          upstream.headers.get("location") || ""
        )
      });
    }
    if (!payload) {
      return response.status(502).json({
        error: `cPanel returned a non-JSON response (${upstream.status}). Check that the URL is the secure cPanel hostname, usually on port 2083.`
      });
    }
    if (!upstream.ok || payload?.result?.status !== 1) {
      return response.status(502).json({
        error: cpanelError(payload)
      });
    }

    let data = payload.result.data;
    if (operation === "read") data = data?.content ?? data;
    return response.status(200).json({ data });
  } catch (error) {
    return response.status(400).json({ error: error.message || "Invalid cPanel request." });
  }
}
