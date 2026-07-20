import { createContext } from 'react';
import { NavMenu } from '@anshif.rainhopes/shared';

export interface NavigationContextType {
  menus: Record<string, NavMenu>;
  setMenus: (menus: Record<string, NavMenu>) => void;
}

export const NavigationContext = createContext<NavigationContextType | null>(null);
