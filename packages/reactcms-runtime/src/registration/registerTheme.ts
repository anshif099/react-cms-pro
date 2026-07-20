import { ref, set } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths, ThemeTokens } from '@anshif.rainhopes/shared';

export async function registerTheme(
  websiteId: string,
  apiKey: string,
  theme: ThemeTokens | null
) {
  if (!theme) return;
  try {
    const db = getFirebaseDatabase(apiKey);
    const themeRef = ref(db, paths.registryTheme(websiteId));
    await set(themeRef, theme);
  } catch (error) {
    console.error('[ReactCMS Runtime] Failed to register theme tokens:', error);
  }
}
