/**
 * Encodes a string key so it is safe to use as a key or path component in Firebase Realtime Database.
 * Replaces invalid characters (., #, $, /, [, ]) and escape character (~) with ~xx hex escape sequences.
 */
export function encodeFirebaseKey(key: string): string {
  if (!key || typeof key !== 'string') return key;
  return key
    .replace(/~/g, '~7E')
    .replace(/\./g, '~2E')
    .replace(/#/g, '~23')
    .replace(/\$/g, '~24')
    .replace(/\//g, '~2F')
    .replace(/\[/g, '~5B')
    .replace(/\]/g, '~5D');
}

/**
 * Decodes a Firebase Realtime Database key back to its original string representation.
 */
export function decodeFirebaseKey(key: string): string {
  if (!key || typeof key !== 'string') return key;
  return key
    .replace(/~5D/g, ']')
    .replace(/~5B/g, '[')
    .replace(/~2F/g, '/')
    .replace(/~24/g, '$')
    .replace(/~23/g, '#')
    .replace(/~2E/g, '.')
    .replace(/~7E/g, '~');
}

/**
 * Recursively encodes keys in an object for Firebase RTDB storage.
 */
export function encodeFirebaseObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const encodedKey = encodeFirebaseKey(key);
    result[encodedKey] = val && typeof val === 'object' && !Array.isArray(val) ? encodeFirebaseObject(val) : val;
  }
  return result as T;
}

/**
 * Recursively decodes keys in an object read from Firebase RTDB.
 */
export function decodeFirebaseObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const decodedKey = decodeFirebaseKey(key);
    result[decodedKey] = val && typeof val === 'object' && !Array.isArray(val) ? decodeFirebaseObject(val) : val;
  }
  return result as T;
}
