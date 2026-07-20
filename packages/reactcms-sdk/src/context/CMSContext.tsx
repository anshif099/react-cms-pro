import { createContext } from 'react';

export interface CMSContextType {
  websiteId: string;
  apiKey: string;
  environment: string;
  editMode: boolean;
  isConnected: boolean;
  setEditMode: (mode: boolean) => void;
}

export const CMSContext = createContext<CMSContextType | null>(null);
