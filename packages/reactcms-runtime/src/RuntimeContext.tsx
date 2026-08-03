import { createContext } from 'react';
import type { ComponentType } from 'react';
import { LayoutDefinition, NavMenu } from '@anshif.rainhopes/shared';

export interface RuntimeLayoutDefinition extends LayoutDefinition {
  component?: ComponentType<any>;
}

export interface RuntimeContextType {
  layouts: Record<string, RuntimeLayoutDefinition>;
  navigations: Record<string, NavMenu>;
  registerLayout: (layout: RuntimeLayoutDefinition) => void;
  unregisterLayout: (id: string) => void;
  registerNavigation: (nav: NavMenu) => void;
  unregisterNavigation: (id: string) => void;
}

export const RuntimeContext = createContext<RuntimeContextType | null>(null);
