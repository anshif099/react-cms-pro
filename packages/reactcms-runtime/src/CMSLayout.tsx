import React, { useContext, useEffect } from 'react';
import { RuntimeContext } from './RuntimeContext';

export interface CMSLayoutProps {
  id: string;
  label: string;
  component: React.ComponentType<any>;
  isDefault?: boolean;
  slots?: string[];
}

export function CMSLayout({
  id,
  label,
  isDefault = false,
  slots = ['main'],
}: CMSLayoutProps) {
  const context = useContext(RuntimeContext);

  useEffect(() => {
    if (context) {
      context.registerLayout({
        id,
        label,
        slots,
        isDefault,
        registeredAt: Date.now(),
      });
    }
    return () => {
      if (context) {
        context.unregisterLayout(id);
      }
    };
  }, [context, id, label, isDefault, slots]);

  return null;
}
