import { Website } from '../types/website';
import { Page } from '../types/page';
import { ThemeTokens } from '../types/theme';
import { ProjectRegistry } from '../types/registry';

export interface FirebaseSchema {
  websites: Record<string, Website>;
  pages: Record<string, Record<string, Page>>;
  content: Record<string, {
    theme?: ThemeTokens;
    seo?: Record<string, unknown>;
    sync?: Record<string, unknown>;
    entries?: Record<string, Record<string, unknown>>;
  }>;
  registry: Record<string, ProjectRegistry>;
}
