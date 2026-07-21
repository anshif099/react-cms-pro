import { useState, useEffect, useContext } from 'react';
import { EditableType } from '@anshif.rainhopes/shared';
import { EditableRegistryContext } from '../context/EditableRegistryContext';
import { PageContext } from '../context/PageContext';
import { CMSContext } from '../context/CMSContext';
import { MessageBus } from '../messaging/MessageBus';

import { editableSync } from '../firebase/editableSync';

export function useEditable<T>(
  regionId: string,
  defaultValue: T,
  type: EditableType,
  label: string
): [T, (value: T) => void] {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);
  const registry = useContext(EditableRegistryContext);

  const pageId = page?.currentPage?.id || 'global';

  const [value, setLocalValue] = useState<T>(defaultValue);

  // Register region with Runtime Context on mount
  useEffect(() => {
    if (registry) {
      registry.registerRegion(pageId, regionId, type, label);
    }
    return () => {
      if (registry) {
        registry.unregisterRegion(pageId, regionId);
      }
    };
  }, [registry, pageId, regionId, type, label]);

  // Subscribe to live preview updates for this region
  useEffect(() => {
    if (!cms?.websiteId) return;

    const unsubscribe = MessageBus.subscribe((msg) => {
      if (msg.type === 'rcms/v1/field-update') {
        const payload = msg.payload as { regionId: string; value: unknown };
        if (payload.regionId === regionId) {
          setLocalValue(payload.value as T);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [cms?.websiteId, regionId]);

  const setValue = (newValue: T) => {
    setLocalValue(newValue);

    if (cms?.websiteId) {
      // Broadcast update to parent dashboard
      MessageBus.send('rcms/v1/field-update', cms.websiteId, {
        regionId,
        value: newValue,
      });

      // Write to contentDraft path directly in Firebase
      if (cms.apiKey) {
        editableSync.saveDraftRegion(cms.apiKey, cms.websiteId, pageId, regionId, newValue);
      }
    }
  };

  return [value, setValue];
}
