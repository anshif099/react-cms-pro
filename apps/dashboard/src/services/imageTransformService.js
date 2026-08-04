function normalizeHex(value) {
  const match = String(value || "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) throw new Error("The replacement logo color must be a 3- or 6-digit hex value.");
  const raw = match[1].length === 3
    ? match[1].split("").map((character) => `${character}${character}`).join("")
    : match[1];
  return `#${raw.toLowerCase()}`;
}

function resolvedAssetUrl(source, baseUrl) {
  const raw = String(source || "").trim();
  if (!raw) throw new Error("The selected image does not contain a source URL.");
  if (/^(?:data:|blob:)/i.test(raw)) return raw;
  const fallbackBase = baseUrl || globalThis.location?.origin;
  const absolute = new URL(raw, fallbackBase).toString();
  const localOrigin = globalThis.location?.origin;
  if (localOrigin && new URL(absolute).origin === localOrigin) return absolute;
  return `/api/live-preview?asset=${encodeURIComponent(absolute)}`;
}

export function requestedImageColor(intent, theme = {}) {
  const explicit = String(intent || "").match(/#[0-9a-f]{3,6}\b/i)?.[0];
  if (explicit) return normalizeHex(explicit);
  const candidates = [
    theme?.colors?.primary,
    theme?.colors?.accent,
    theme?.colors?.secondary,
    "#ff5757"
  ];
  return normalizeHex(candidates.find((candidate) => (
    /^#[0-9a-f]{3,6}$/i.test(String(candidate || ""))
    && !/^#(?:fff|ffffff)$/i.test(String(candidate))
  )) || "#ff5757");
}

export function isImageRecolorRequest(intent) {
  const text = String(intent || "").trim().toLowerCase();
  const mentionsVisual = /\b(logo|image|icon|picture|photo|graphic)\b/.test(text);
  const mentionsColor = /\b(colou?r|recolou?r|tint|without white|remove white|not white)\b/.test(text);
  return mentionsVisual && mentionsColor;
}

export function recolorSvgMarkup(markup, targetColor) {
  const color = normalizeHex(targetColor);
  let replacements = 0;
  const value = String(markup || "").replace(
    /((?:fill|stroke|stop-color|color)\s*(?:=|:)\s*["']?\s*)(#(?:f{3}|f{6})\b|\bwhite\b|rgba?\(\s*255\s*,\s*255\s*,\s*255(?:\s*,\s*(?:1|1\.0+))?\s*\))/gi,
    (_match, prefix) => {
      replacements += 1;
      return `${prefix}${color}`;
    }
  );
  if (!replacements) {
    throw new Error("The selected SVG does not contain a white logo color to replace.");
  }
  return { markup: value, replacements, color };
}

function parseHexChannels(value) {
  const color = normalizeHex(value);
  return {
    color,
    red: Number.parseInt(color.slice(1, 3), 16),
    green: Number.parseInt(color.slice(3, 5), 16),
    blue: Number.parseInt(color.slice(5, 7), 16)
  };
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected logo image could not be decoded."));
    };
    image.src = objectUrl;
  });
}

async function recolorRasterBlob(blob, targetColor) {
  const image = await loadImage(blob);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("The selected logo image has no usable dimensions.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot edit the selected logo image.");
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const channels = parseHexChannels(targetColor);
  let replacements = 0;
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const alpha = pixels.data[index + 3];
    const neutralRange = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (alpha > 0 && red >= 190 && green >= 190 && blue >= 190 && neutralRange <= 48) {
      const intensity = Math.max(red, green, blue) / 255;
      pixels.data[index] = Math.round(channels.red * intensity);
      pixels.data[index + 1] = Math.round(channels.green * intensity);
      pixels.data[index + 2] = Math.round(channels.blue * intensity);
      replacements += 1;
    }
  }
  if (!replacements) {
    throw new Error("The selected image does not contain light or white logo pixels to replace.");
  }
  context.putImageData(pixels, 0, 0);
  const output = await new Promise((resolve, reject) => canvas.toBlob(
    (result) => result ? resolve(result) : reject(new Error("The recolored logo could not be encoded.")),
    "image/png"
  ));
  return { blob: output, replacements, color: channels.color, extension: "png" };
}

export async function recolorImageAsset({ source, baseUrl, targetColor }) {
  const sourceUrl = resolvedAssetUrl(source, baseUrl);
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`The selected logo asset could not be loaded (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const contentType = String(blob.type || response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("svg") || /\.svg(?:[?#]|$)/i.test(source)) {
    const result = recolorSvgMarkup(await blob.text(), targetColor);
    return {
      ...result,
      blob: new Blob([result.markup], { type: "image/svg+xml" }),
      extension: "svg"
    };
  }
  return recolorRasterBlob(blob, targetColor);
}

export default {
  isImageRecolorRequest,
  recolorImageAsset,
  recolorSvgMarkup,
  requestedImageColor
};
