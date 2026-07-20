import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths, RouteEntry } from '@anshif.rainhopes/shared';
import { DynamicPageRenderer } from './routing/dynamicPageRenderer';

export interface RouteRegistryProps {
  websiteId: string;
  apiKey: string;
}

export function RouteRegistry({ websiteId, apiKey }: RouteRegistryProps) {
  const [dynamicRoutes, setDynamicRoutes] = useState<RouteEntry[]>([]);

  useEffect(() => {
    const db = getFirebaseDatabase(apiKey);
    const routesRef = ref(db, paths.registryRoutes(websiteId));

    const unsubscribe = onValue(routesRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val() as Record<string, RouteEntry>;
        const list = Object.values(val).filter((r) => r.source === 'cms-generated');
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
      {dynamicRoutes.map((route) => (
        <Route
          key={route.id}
          path={route.path}
          element={<DynamicPageRenderer slug={route.path} />}
        />
      ))}
    </Routes>
  );
}
