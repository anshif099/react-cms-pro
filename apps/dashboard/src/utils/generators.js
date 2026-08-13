export function generateWebsiteId() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `rcms_${result}`;
}

export function generateApiKey() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `rcms_pk_${result}`;
}

export function generateSecretKey() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `rcms_sk_${result}`;
}

export function generateVerificationCode() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateSecurePassword(length = 18) {
  const safeLength = Math.max(12, length);
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*?"
  ];
  const alphabet = groups.join("");
  const randomValues = new Uint32Array(safeLength);
  globalThis.crypto.getRandomValues(randomValues);

  const characters = groups.map((group, index) => (
    group[randomValues[index] % group.length]
  ));

  for (let index = groups.length; index < safeLength; index += 1) {
    characters.push(alphabet[randomValues[index] % alphabet.length]);
  }

  // Shuffle so the required character groups are not always in fixed positions.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomValues[index] % (index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}

export function generateClientAdminEmail(website, forceUnique = false) {
  const ownerEmail = String(website?.ownerEmail || "").trim().toLowerCase();
  const domain = String(website?.domain || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/^www\./i, "")
    .replace(/[^a-z0-9.-]/gi, "") || "reactcms.local";

  const baseEmail = ownerEmail.includes("@") ? ownerEmail : `admin@${domain}`;
  if (!forceUnique) return baseEmail;

  const separatorIndex = baseEmail.lastIndexOf("@");
  const localPart = baseEmail.slice(0, separatorIndex).replace(/\+.*$/, "");
  const emailDomain = baseEmail.slice(separatorIndex + 1);
  const suffixValues = new Uint32Array(1);
  globalThis.crypto.getRandomValues(suffixValues);
  const suffix = suffixValues[0].toString(36).slice(0, 6).padEnd(6, "0");
  return `${localPart}+${suffix}@${emailDomain}`;
}
