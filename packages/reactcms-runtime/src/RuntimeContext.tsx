import { createContext } from 'react';
import { LayoutDefinition, NavMenu } from '@anshif.rainhopes/shared';

export interface RuntimeContextType {
  layouts: Record<string, LayoutDefinition>;
  navigations: Record<string, NavMenu>;
  registerLayout: (layout: LayoutDefinition) => void;
  unregisterLayout: (id: string) => void;
  registerNavigation: (nav: NavMenu) => void;
  unregisterNavigation: (id: string) => void;
}

export const RuntimeContext = createContext<RuntimeContextType | null>(null);
