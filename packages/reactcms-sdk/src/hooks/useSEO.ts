import { useContext } from 'react';
import { SEOContext, SEOContextType } from '../context/SEOContext';

export function useSEO(): SEOContextType {
  const context = useContext(SEOContext);
  if (!context) {
    throw new Error('useSEO must be used within a CMSProvider');
  }
  return context;
}
