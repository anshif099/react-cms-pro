
import React, { useEffect, useState } from 'react';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { ref, get } from 'firebase/database';

export function DynamicPageRenderer({ slug }: { slug: string }) {
  const cleanSlug = slug ? slug.replace(/^\/+|\/+$/g, '') || 'home' : 'home';
  const [regions, setRegions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const db = getFirebaseDatabase();
      if (db) {
        const publishedRef = ref(db, `contentPublished/${cleanSlug}`);
        get(publishedRef)
          .then((snap) => {
            if (snap.exists() && snap.val()?.regions) {
              setRegions(snap.val().regions);
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [cleanSlug]);

  return (
    <main style={{ minHeight: '60vh', padding: '3rem 1.5rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', textTransform: 'capitalize' }}>
          {cleanSlug.replace(/-/g, ' ')}
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Route Path: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>/{cleanSlug}</code>
        </p>
      </div>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading CMS page content...</div>
      ) : Object.keys(regions).length > 0 ? (
        <div className="rcms-published-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(regions).map(([key, val]) => (
            <div key={key} className={`rcms-region-${key}`}>
              {typeof val === 'string' ? (
                <div dangerouslySetInnerHTML={{ __html: val }} />
              ) : (
                <pre style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', overflowX: 'auto' }}>
                  {JSON.stringify(val, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '3rem 2rem', background: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
            Page Created & Ready
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto' }}>
            Content for this page can be updated live using the ReactCMS Visual Editor.
          </p>
        </div>
      )}
    </main>
  );
}
