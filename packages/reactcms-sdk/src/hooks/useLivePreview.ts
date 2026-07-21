import { useState, useEffect, useContext } from 'react';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';
import { setupFirebaseBridge } from '../messaging/firebaseBridge';

export function useLivePreview<T = Record<string, unknown>>(pageIdOverride?: string): {
  editMode: boolean;
  values: Record<string, T>;
  updateRegion: (regionId: string, value: T) => void;
} {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);

  const websiteId = cms?.websiteId || '';
  const apiKey = cms?.apiKey || '';
  const pageId = pageIdOverride || page?.currentPage?.id || 'global';

  const [values, setValues] = useState<Record<string, T>>({});

  useEffect(() => {
    if (!websiteId) return;

    // Listen for live field updates from MessageBus
    const unsubscribeBus = MessageBus.subscribe((msg) => {
      if (msg.websiteId !== websiteId) return;

      if (msg.type === 'rcms/v1/field-update') {
        const payload = msg.payload as { regionId: string; value: T };
        if (payload.regionId) {
          setValues((prev) => ({
            ...prev,
            [payload.regionId]: payload.value,
          }));
        }
      }
    });

    // Optionally bridge Firebase Realtime DB draft values if apiKey is available
    const unsubscribeBridge = apiKey ? setupFirebaseBridge(apiKey, websiteId, pageId) : () => {};

    return () => {
      unsubscribeBus();
      unsubscribeBridge();
    };
  }, [websiteId, apiKey, pageId]);

  const updateRegion = (regionId: string, newValue: T) => {
    setValues((prev) => ({ ...prev, [regionId]: newValue }));

    if (websiteId) {
      MessageBus.send('rcms/v1/field-update', websiteId, {
        regionId,
        value: newValue,
      });
    }
  };

  return {
    editMode: cms?.editMode || false,
    values,
    updateRegion,
  };
}
