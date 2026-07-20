import { useContext, useEffect } from 'react';
import { RuntimeContext } from './RuntimeContext';
import { NavItem } from '@anshif.rainhopes/shared';

export interface CMSNavigationProps {
  id: string;
  label: string;
  items: NavItem[];
}

export function CMSNavigation({ id, label, items }: CMSNavigationProps) {
  const context = useContext(RuntimeContext);

  useEffect(() => {
    if (context) {
      context.registerNavigation({
        id,
        label,
        items,
        registeredAt: Date.now(),
      });
    }
    return () => {
      if (context) {
        context.unregisterNavigation(id);
      }
    };
  }, [context, id, label, items]);

  return null;
}
