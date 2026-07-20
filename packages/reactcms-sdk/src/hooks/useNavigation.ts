import { useContext } from 'react';
import { NavigationContext, NavigationContextType } from '../context/NavigationContext';

export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a CMSProvider');
  }
  return context;
}
