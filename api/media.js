const DEFAULT_DATABASE_URL = "https://react-cms-pro-default-rtdb.firebaseio.com";
const SAFE_FIREBASE_ID = /^[A-Za-z0-9_-]{1,160}$/;
const MAX_BASE64_LENGTH = 6 * 1024 * 1024;

function queryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function isSafeId(value) {
  return typeof value === "string" && SAFE_FIREBASE_ID.test(value);
}

function databaseOrigin() {
  return String(process.env.FIREBASE_DATABASE_URL || DEFAULT_DATABASE_URL).replace(/\/$/, "");
}

export function mediaBlobDatabaseUrl(websiteId, fileId) {
  if (!isSafeId(websiteId) || !isSafeId(fileId)) {
    throw new Error("Invalid media identifier.");
  }
  return `${databaseOrigin()}/mediaBlobs/${websiteId}/${fileId}.json`;
}

function safeContentType(value) {
  const contentType = String(value || "").toLowerCase().split(";", 1)[0].trim();
  const safeTypes = /^(image\/(?:avif|bmp|gif|jpeg|png|webp|x-icon)|audio\/(?:mpeg|ogg|wav|webm)|video\/(?:mp4|ogg|webm)|application\/pdf)$/;
  return safeTypes.test(contentType) ? contentType : "application/octet-stream";
}

export function decodeMediaBlob(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.data !== "string") {
    throw new Error("Media payload is missing.");
  }
  if (
    payload.data.length === 0 ||
    payload.data.length > MAX_BASE64_LENGTH ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(payload.data)
  ) {
    throw new Error("Media payload is invalid.");
  }

  const buffer = Buffer.from(payload.data, "base64");
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
    throw new Error("Media payload is too large.");
  }

  return {
    buffer,
    contentType: safeContentType(payload.contentType)
  };
}

function setSharedHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

export default async function handler(request, response) {
  setSharedHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD, OPTIONS");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const websiteId = queryValue(request.query?.websiteId);
  const fileId = queryValue(request.query?.fileId);
  if (!isSafeId(websiteId) || !isSafeId(fileId)) {
    response.status(400).json({ error: "Valid websiteId and fileId are required." });
    return;
  }

  let databaseResponse;
  try {
    databaseResponse = await fetch(mediaBlobDatabaseUrl(websiteId, fileId), {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
  } catch (error) {
    console.error("Realtime Database media read failed:", error);
    response.status(502).json({ error: "Media service is temporarily unavailable." });
    return;
  }

  if (!databaseResponse.ok) {
    console.error("Realtime Database media response:", databaseResponse.status);
    response.status(502).json({ error: "Media service is temporarily unavailable." });
    return;
  }

  const payload = await databaseResponse.json();
  if (!payload) {
    response.status(404).json({ error: "Media not found." });
    return;
  }

  let media;
  try {
    media = decodeMediaBlob(payload);
  } catch (error) {
    console.error("Invalid Realtime Database media payload:", error);
    response.status(500).json({ error: "Stored media is invalid." });
    return;
  }

  response.setHeader("Content-Type", media.contentType);
  response.setHeader("Content-Length", String(media.buffer.length));
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");

  response.status(200);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.end(media.buffer);
}
