import React from 'react';

export function DynamicPageRenderer({ slug }: { slug: string }) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>CMS Generated Page</h1>
      <p>This page (slug: <code>{slug}</code>) is dynamically served from the ReactCMS registry.</p>
    </div>
  );
}
