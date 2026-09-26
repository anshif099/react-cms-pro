import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import SftpClient from "ssh2-sftp-client";

const ALLOWED_OPERATIONS = new Set(["list", "read", "write"]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;

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

export function isStackCpHostname(value) {
  const hostname = String(value || "").trim().toLowerCase().replace(/\.$/, "");
  return hostname === "stackcp.com" || hostname.endsWith(".stackcp.com");
}

async function safeStackCpHost(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("/") || raw.includes("@")) {
    throw new Error("Enter a StackCP SFTP hostname such as ftp.stackcp.com.");
  }
  const hostname = raw.replace(/\.$/, "").toLowerCase();
  if (isIP(hostname) || !isStackCpHostname(hostname)) {
    throw new Error("For this connection, use an official StackCP SFTP hostname ending in stackcp.com.");
  }
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("The StackCP SFTP hostname must resolve to a public server.");
  }
  return hostname;
}

export function safeSftpPath(value) {
  const path = String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
  if (
    !path
    || path.includes("\0")
    || path.split("/").some((segment) => segment === ".." || !segment)
  ) {
    throw new Error("The StackCP SFTP path is invalid.");
  }
  return path;
}

function parentDirectory(filePath) {
  const parts = safeSftpPath(filePath).split("/");
  parts.pop();
  return parts.join("/");
}

function connectionFailure(error) {
  const message = String(error?.message || "");
  if (/authentication|all configured authentication methods failed|permission denied/i.test(message)) {
    return {
      status: 401,
      message: "StackCP SFTP rejected the username or password. Use the package FTP details after rotating the exposed password."
    };
  }
  if (/timed?\s*out|econnrefused|not connected|no response/i.test(message)) {
    return {
      status: 502,
      message: "StackCP SFTP could not connect. Unlock FTP/SFTP for a time period in StackCP, then try again."
    };
  }
  if (/no such file|not exist|not found/i.test(message)) {
    return {
      status: 404,
      message: "The selected StackCP project root or source file was not found. Usually the project root is public_html."
    };
  }
  return {
    status: 502,
    message: "StackCP SFTP failed. Verify the official hostname, package username, rotated FTP password, FTP unlock, and project root."
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  let client = null;
  try {
    const {
      host,
      port = 22,
      username,
      credential,
      operation,
      parameters = {}
    } = request.body || {};
    if (!ALLOWED_OPERATIONS.has(operation)) {
      return response.status(400).json({ error: "Unsupported StackCP SFTP operation." });
    }
    if (!String(username || "").trim() || !String(credential || "").trim()) {
      return response.status(400).json({ error: "StackCP SFTP username and password are required." });
    }
    const normalizedPort = Number(port);
    if (normalizedPort !== 22) {
      return response.status(400).json({ error: "StackCP SFTP must use port 22." });
    }
    if (String(parameters.content || "").length > MAX_FILE_BYTES) {
      return response.status(413).json({ error: "A StackCP source file cannot exceed 2 MB." });
    }

    const normalizedHost = await safeStackCpHost(host);
    client = new SftpClient("reactcms-stackcp");
    await client.connect({
      host: normalizedHost,
      port: normalizedPort,
      username: String(username).trim(),
      password: String(credential),
      readyTimeout: 15000,
      keepaliveInterval: 5000,
      keepaliveCountMax: 2
    });

    let data;
    if (operation === "list") {
      const entries = await client.list(safeSftpPath(parameters.directory));
      data = entries
        .filter((entry) => entry.type === "-" || entry.type === "d")
        .map((entry) => ({
          name: entry.name,
          type: entry.type === "d" ? "directory" : "file",
          size: Number(entry.size || 0),
          mtime: Number(entry.modifyTime || 0)
        }));
    } else if (operation === "read") {
      const filePath = safeSftpPath(parameters.filePath);
      const stats = await client.stat(filePath);
      if (!stats.isFile) {
        return response.status(400).json({ error: "The selected StackCP path is not a file." });
      }
      if (Number(stats.size || 0) > MAX_FILE_BYTES) {
        return response.status(413).json({ error: "A StackCP source file cannot exceed 2 MB." });
      }
      const content = await client.get(filePath);
      data = Buffer.isBuffer(content) ? content.toString("utf8") : String(content || "");
    } else {
      const filePath = safeSftpPath(parameters.filePath);
      const directory = parentDirectory(filePath);
      if (directory) await client.mkdir(directory, true);
      await client.put(Buffer.from(String(parameters.content ?? ""), "utf8"), filePath);
      data = { mtime: Date.now() };
    }

    return response.status(200).json({ data });
  } catch (error) {
    if (
      error?.message?.startsWith("Enter a StackCP")
      || error?.message?.startsWith("For this connection")
      || error?.message?.startsWith("The StackCP SFTP hostname")
      || error?.message?.startsWith("The StackCP SFTP path")
    ) {
      return response.status(400).json({ error: error.message });
    }
    const failure = connectionFailure(error);
    return response.status(failure.status).json({ error: failure.message });
  } finally {
    if (client) await client.end().catch(() => {});
  }
}
