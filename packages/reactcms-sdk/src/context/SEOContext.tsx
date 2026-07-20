import { createContext } from 'react';
import { PageSEO } from '@anshif.rainhopes/shared';

export interface SEOContextType {
  seo: PageSEO | null;
  setSEO: (seo: PageSEO) => void;
}

export const SEOContext = createContext<SEOContextType | null>(null);
