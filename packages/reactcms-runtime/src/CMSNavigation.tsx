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
  const registerNavigation = context?.registerNavigation;

  useEffect(() => {
    if (registerNavigation) {
      registerNavigation({
        id,
        label,
        items,
        registeredAt: Date.now(),
      });
    }
  }, [id, items, label, registerNavigation]);

  return null;
}
