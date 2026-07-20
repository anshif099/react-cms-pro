import React, { useContext, useEffect } from 'react';
import { SEOContext } from '../context/SEOContext';
import { injectSEO } from '../utils/seoInjector';

export function CMSSEOProvider({ children }: { children: React.ReactNode }) {
  const context = useContext(SEOContext);

  useEffect(() => {
    if (context && context.seo) {
      injectSEO(context.seo);
    }
  }, [context?.seo]);

  return <>{children}</>;
}
