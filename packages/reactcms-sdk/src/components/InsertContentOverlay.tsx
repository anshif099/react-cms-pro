import React, { useEffect, useState } from 'react';
import { MessageBus } from '../messaging/MessageBus';

type Selection = { regionId: string; pageId: string; type?: string; value?: any; label?: string; html?: string };
type InsertType = 'paragraph' | 'image' | 'video';

function selectionContent(selection: Selection) {
  const value = selection.value;
  if (selection.type === 'section' && selection.html) {
    const cleanMarkup = selection.html
      .replace(/\sdata-rcms-(?:region|type|label)="[^"]*"/g, '')
      .replace(/\srcms-editable-[\w-]+/g, '')
      .replace(/\sstyle="([^"]*)outline:[^;\"]*;?([^\"]*)"/g, ' style="$1$2"');
    return { componentType: 'html', content: { props: { code: cleanMarkup } } };
  }
  if (selection.type === 'image') {
    const props = typeof value === 'object' ? value : { src: String(value || '') };
    return { componentType: 'image', content: { props } };
  }
  if (selection.type === 'video') {
    const props = typeof value === 'object' ? value : { url: String(value || '') };
    return { componentType: 'video', content: { props } };
  }
  if (selection.type === 'button') {
    const label = typeof value === 'object' ? value.text || value.label : value;
    return { componentType: 'button', content: { props: typeof value === 'object' ? value : {}, localized: { label: String(label || 'Button') } } };
  }
  const text = typeof value === 'object' ? value.text || value.html || value.value : value;
  return { componentType: 'paragraph', content: { localized: { text: String(text || '') } } };
}

export function InsertContentOverlay({ websiteId, enabled }: { websiteId: string; enabled: boolean }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<InsertType>('paragraph');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const clipboardKey = `reactcms_component_clipboard:${websiteId}`;
  const [clipboard, setClipboard] = useState<ReturnType<typeof selectionContent> | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(window.localStorage.getItem(clipboardKey) || 'null'); } catch { return null; }
  });

  const copySelection = () => {
    const copied = selectionContent(selection!);
    setClipboard(copied);
    try { window.localStorage.setItem(clipboardKey, JSON.stringify(copied)); } catch { /* Browser storage may be unavailable. */ }
  };

  useEffect(() => MessageBus.subscribe((message) => {
    if (message.type !== 'rcms/v1/region-selected') return;
    const payload = message.payload as Partial<Selection>;
    if (!payload?.regionId || payload.regionId === '__rcms_runtime_additions__') return;
    setSelection({ ...payload, regionId: payload.regionId, pageId: payload.pageId || 'global' });
  }), []);

  useEffect(() => {
    if (!enabled || !selection) return undefined;
    const update = () => {
      const escaped = typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(selection.regionId)
        : selection.regionId.replace(/["\\]/g, '\\$&');
      const element = document.querySelector<HTMLElement>(`[data-rcms-region="${escaped}"]`);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      setPosition({ left: rect.left + rect.width / 2, top: rect.bottom });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [enabled, selection]);

  if (!enabled || !selection) return null;

  const reset = () => {
    setOpen(false);
    setText('');
    setUrl('');
    setDescription('');
  };

  return (
    <>
      <div style={{ position: 'fixed', zIndex: 2147483000, left: position.left, top: position.top, transform: 'translate(-50%, -50%)', display: 'flex', gap: '6px' }}>
        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); copySelection(); }} style={{ height: '28px', padding: '0 10px', border: '1px solid #475569', borderRadius: '999px', background: '#0f172a', color: '#fff', boxShadow: '0 6px 20px rgba(15,23,42,.35)', cursor: 'pointer', font: '700 10px Inter,system-ui,sans-serif', whiteSpace: 'nowrap' }}>{clipboard ? '✓ Copied' : 'Copy'}</button>
        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }} style={{ height: '28px', padding: '0 12px', border: '1px solid #93c5fd', borderRadius: '999px', background: '#2563eb', color: '#fff', boxShadow: '0 6px 20px rgba(37,99,235,.4)', cursor: 'pointer', font: '700 10px Inter,system-ui,sans-serif', whiteSpace: 'nowrap' }}>+ Add below</button>
      </div>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Add content below selection" onClick={(event) => event.stopPropagation()} style={{ position: 'fixed', zIndex: 2147483640, inset: 0, display: 'grid', placeItems: 'center', padding: '20px', background: 'rgba(2,6,23,.76)', backdropFilter: 'blur(5px)' }}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const cleanText = text.trim();
              const cleanUrl = url.trim();
              if (type === 'paragraph' ? !cleanText : !cleanUrl) return;
              MessageBus.send('rcms/v1/insert-content', websiteId, {
                pageId: selection.pageId,
                anchorRegionId: selection.regionId,
                position: 'after',
                componentType: type,
                content: type === 'paragraph'
                  ? { localized: { text: `<p>${cleanText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />')}</p>` } }
                  : type === 'image'
                    ? { props: { src: cleanUrl, width: '100%', height: 'auto', objectFit: 'cover' }, localized: { alt: description.trim() } }
                    : { props: { url: cleanUrl, controls: true }, localized: { caption: description.trim() } },
              });
              reset();
            }}
            style={{ width: 'min(520px,100%)', padding: '22px', border: '1px solid #334155', borderRadius: '18px', background: '#0f172a', color: '#f8fafc', boxShadow: '0 28px 80px rgba(0,0,0,.55)', font: '500 14px Inter,system-ui,sans-serif' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><strong style={{ fontSize: '18px' }}>Add below selection</strong><div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '12px' }}>Choose content, complete the fields, then add it to the page.</div></div>
              <button type="button" aria-label="Close" onClick={reset} style={{ width: '32px', height: '32px', border: 0, borderRadius: '8px', background: '#1e293b', color: '#cbd5e1', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', margin: '20px 0' }}>
              {(['paragraph', 'image', 'video'] as const).map((item) => <button key={item} type="button" onClick={() => setType(item)} style={{ height: '42px', border: `1px solid ${type === item ? '#60a5fa' : '#334155'}`, borderRadius: '10px', background: type === item ? '#1d4ed8' : '#111827', color: '#fff', cursor: 'pointer', fontWeight: 700, textTransform: 'capitalize' }}>{item === 'paragraph' ? 'Text' : item}</button>)}
            </div>
            {clipboard && <button type="button" onClick={() => { MessageBus.send('rcms/v1/insert-content', websiteId, { pageId: selection.pageId, anchorRegionId: selection.regionId, position: 'after', ...clipboard }); reset(); }} style={{ width: '100%', height: '42px', marginBottom: '16px', border: '1px solid #a78bfa', borderRadius: '10px', background: '#4c1d95', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>Paste copied component here</button>}
            {type === 'paragraph' ? (
              <label style={{ display: 'grid', gap: '7px', color: '#cbd5e1', fontWeight: 700 }}>Text<textarea autoFocus required rows={6} value={text} onChange={(event) => setText(event.target.value)} placeholder="Write the text to add…" style={{ padding: '12px 14px', border: '1px solid #334155', borderRadius: '10px', background: '#020617', color: '#f8fafc', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} /></label>
            ) : (
              <div style={{ display: 'grid', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '7px', color: '#cbd5e1', fontWeight: 700 }}>{type === 'image' ? 'Image URL' : 'Video URL'}<input autoFocus required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder={`https://example.com/${type === 'image' ? 'image.jpg' : 'video.mp4'}`} style={{ height: '44px', padding: '0 13px', border: '1px solid #334155', borderRadius: '10px', background: '#020617', color: '#f8fafc', font: 'inherit' }} /></label>
                <label style={{ display: 'grid', gap: '7px', color: '#cbd5e1', fontWeight: 700 }}>{type === 'image' ? 'Alt text' : 'Caption'} (optional)<input value={description} onChange={(event) => setDescription(event.target.value)} style={{ height: '44px', padding: '0 13px', border: '1px solid #334155', borderRadius: '10px', background: '#020617', color: '#f8fafc', font: 'inherit' }} /></label>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '9px', marginTop: '22px' }}><button type="button" onClick={reset} style={{ height: '40px', padding: '0 16px', border: '1px solid #334155', borderRadius: '10px', background: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontWeight: 700 }}>Cancel</button><button type="submit" style={{ height: '40px', padding: '0 18px', border: 0, borderRadius: '10px', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>Add to page</button></div>
          </form>
        </div>
      )}
    </>
  );
}
