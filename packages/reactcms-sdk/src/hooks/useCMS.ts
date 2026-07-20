import { useContext } from 'react';
import { CMSContext, CMSContextType } from '../context/CMSContext';

export function useCMS(): CMSContextType {
  const context = useContext(CMSContext);
  if (!context) {
    throw new Error('useCMS must be used within a CMSProvider');
  }
  return context;
}
