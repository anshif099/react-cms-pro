import { createContext } from 'react';
import { EditableType } from '@anshif.rainhopes/shared';

export interface EditableRegistryContextType {
  registerRegion: (pageId: string, regionId: string, type: EditableType, label: string) => void;
  unregisterRegion: (pageId: string, regionId: string) => void;
}

export const EditableRegistryContext = createContext<EditableRegistryContextType | null>(null);
