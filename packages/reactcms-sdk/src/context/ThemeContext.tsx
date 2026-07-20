import { createContext } from 'react';
import { ThemeTokens } from '@anshif.rainhopes/shared';

export interface ThemeContextType {
  theme: ThemeTokens | null;
  setTheme: (theme: ThemeTokens) => void;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);
