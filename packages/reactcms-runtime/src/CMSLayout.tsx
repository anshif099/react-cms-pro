import React, { useContext, useEffect } from 'react';
import { RuntimeContext } from './RuntimeContext';

const DEFAULT_SLOTS = ['main'];

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
  component,
  isDefault = false,
  slots = DEFAULT_SLOTS,
}: CMSLayoutProps) {
  const context = useContext(RuntimeContext);
  const registerLayout = context?.registerLayout;

  useEffect(() => {
    if (registerLayout) {
      registerLayout({
        id,
        label,
        component,
        slots,
        isDefault,
        registeredAt: Date.now(),
      });
    }
  }, [component, id, isDefault, label, registerLayout, slots]);

  return null;
}
