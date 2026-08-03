import { useContext, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths, RouteEntry } from '@anshif.rainhopes/shared';
import { BuilderSections } from './BuilderSections';
import { RuntimeContext } from './RuntimeContext';

export interface RouteRegistryProps {
  websiteId: string;
  apiKey: string;
}

export function RouteRegistry({ websiteId, apiKey }: RouteRegistryProps) {
  const [dynamicRoutes, setDynamicRoutes] = useState<RouteEntry[]>([]);
  const runtime = useContext(RuntimeContext);

  useEffect(() => {
    const db = getFirebaseDatabase(apiKey);
    const routesRef = ref(db, paths.registryRoutes(websiteId));

    const unsubscribe = onValue(routesRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val() as Record<string, RouteEntry>;
        const list = Object.values(val).filter(
          (r) => r.source === 'cms-generated' || r.source === 'cms' || r.source === 'generated'
        );
        setDynamicRoutes(list);
      } else {
        setDynamicRoutes([]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [websiteId, apiKey]);

  if (dynamicRoutes.length === 0) return null;

  return (
    <Routes>
      {dynamicRoutes.map((route) => {
        const defaultLayout = Object.values(runtime?.layouts || {}).find(
          (layout) => layout.isDefault
        );
        const layout = runtime?.layouts?.[route.layout || ""]
          || defaultLayout
          || runtime?.layouts?.default;
        return (
          <Route
            key={route.id}
            path={route.path}
            element={(
              <BuilderSections
                websiteId={websiteId}
                apiKey={apiKey}
                pageId={route.path}
                layout={layout?.component}
              />
            )}
          />
        );
      })}
    </Routes>
  );
}
