import { createContext } from 'react';
import { Page } from '@anshif.rainhopes/shared';

export interface PageContextType {
  currentPage: Page | null;
  locale: string;
  setLocale: (locale: string) => void;
}

export const PageContext = createContext<PageContextType | null>(null);
