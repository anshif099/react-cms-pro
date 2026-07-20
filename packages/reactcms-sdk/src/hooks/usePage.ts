import { useContext } from 'react';
import { PageContext, PageContextType } from '../context/PageContext';

export function usePage(): PageContextType {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePage must be used within a CMSProvider');
  }
  return context;
}
