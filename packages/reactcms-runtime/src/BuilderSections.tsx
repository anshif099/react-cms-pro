import React, { CSSProperties, ElementType, useContext, useEffect, useMemo, useState } from 'react';
import {
  CMSContext,
  MessageBus,
  PageContext,
} from '@anshif.rainhopes/reactcms-sdk';

export const BUILDER_BLOCKS_REGION = '__rcms_builder_blocks__';

type BuilderBlock = {
  id: string;
  type: string;
  locales?: Record<string, Record<string, any>>;
  design?: {
    background?: string;
    paddingY?: number;
    maxWidth?: number;
  };
  [key: string]: any;
};

function resolvePageId(currentPage: any): string {
  if (currentPage?.id) return currentPage.id;
  if (currentPage?.slug) return currentPage.slug;
  try {
    const query = new URLSearchParams(window.location.search).get('page');
    if (query) return query;
  } catch {
    // Continue to pathname.
  }
  return window.location.pathname.replace(/^\/+|\/+$/g, '') || 'home';
}

function localized(block: BuilderBlock, locale: string, key: string, fallback: any = '') {
  return block.locales?.[locale]?.[key]
    ?? block.locales?.en?.[key]
    ?? block[key]
    ?? fallback;
}

function sanitizeHtml(html: any): string {
  return String(html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
}

function useLiveRegion(pageId: string, regionId: string, fallback: any) {
  const initial = MessageBus.getStoredRegionValue(pageId, regionId);
  const [value, setValue] = useState(initial !== undefined ? initial : fallback);

  useEffect(() => {
    const stored = MessageBus.getStoredRegionValue(pageId, regionId);
    setValue(stored !== undefined ? stored : fallback);
  }, [fallback, pageId, regionId]);

  useEffect(() => MessageBus.subscribe((message) => {
    if (message.type !== 'rcms/v1/field-update') return;
    const payload = message.payload as { pageId?: string; regionId?: string; value?: unknown };
    if (payload.regionId === regionId && (!payload.pageId || payload.pageId === pageId)) {
      setValue(payload.value);
    }
  }), [pageId, regionId]);

  return value;
}

function textFrom(value: any): string {
  if (value && typeof value === 'object') return String(value.text ?? value.label ?? '');
  return String(value ?? '');
}

function styleFrom(value: any): CSSProperties {
  if (!value || typeof value !== 'object') return {};
  return {
    color: value.color,
    fontSize: value.fontSize,
    fontWeight: value.fontWeight,
    textAlign: value.align,
    width: value.width,
    maxWidth: value.maxWidth,
  };
}

function LiveText({
  pageId,
  regionId,
  label,
  value,
  as: Component = 'span',
  className,
  style,
  html = false,
}: {
  pageId: string;
  regionId: string;
  label: string;
  value: any;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  html?: boolean;
}) {
  const liveValue = useLiveRegion(pageId, regionId, value);
  const content = textFrom(liveValue);
  const props = {
    className: `rcms-editable-region ${className || ''}`,
    style: { ...style, ...styleFrom(liveValue) },
    'data-rcms-region': regionId,
    'data-rcms-type': html ? 'richtext' : 'text',
    'data-rcms-label': label,
  };

  if (html) {
    return <Component {...props} dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />;
  }
  return <Component {...props}>{content}</Component>;
}

function LiveImage({
  pageId,
  regionId,
  label,
  value,
  className,
}: {
  pageId: string;
  regionId: string;
  label: string;
  value: any;
  className?: string;
}) {
  const liveValue = useLiveRegion(pageId, regionId, value);
  const data = typeof liveValue === 'string' ? { src: liveValue } : (liveValue || {});
  if (!data.src) return null;
  return (
    <img
      src={data.src}
      alt={data.alt || ''}
      className={`rcms-editable-region ${className || ''}`}
      style={{
        width: data.width || '100%',
        height: data.height || 'auto',
        objectFit: data.objectFit || 'cover',
      }}
      data-rcms-region={regionId}
      data-rcms-type="image"
      data-rcms-label={label}
    />
  );
}

function LiveButton({
  pageId,
  regionId,
  label,
  value,
}: {
  pageId: string;
  regionId: string;
  label: string;
  value: any;
}) {
  const liveValue = useLiveRegion(pageId, regionId, value);
  const data = typeof liveValue === 'string' ? { text: liveValue } : (liveValue || {});
  const padding = data.size === 'lg' ? '14px 24px' : data.size === 'sm' ? '8px 14px' : '11px 20px';
  return (
    <a
      href={data.href || data.url || '#'}
      className="rcms-editable-region"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
        borderRadius: `${data.radius ?? 10}px`,
        background: data.variant === 'outline' ? 'transparent' : (data.color || '#2563eb'),
        color: data.variant === 'outline' ? (data.color || '#2563eb') : '#fff',
        border: `1px solid ${data.color || '#2563eb'}`,
        textDecoration: 'none',
        fontWeight: 700,
        boxShadow: data.shadow === 'none' ? 'none' : '0 10px 25px rgba(15,23,42,.15)',
      }}
      data-rcms-region={regionId}
      data-rcms-type="button"
      data-rcms-label={label}
    >
      {data.text || data.label || 'Learn More'}
    </a>
  );
}

function InsertPoint({ websiteId, index }: { websiteId: string; index: number }) {
  return (
    <div
      className="rcms-builder-insert-point"
      style={{
        position: 'relative',
        height: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          MessageBus.send('rcms/v1/builder-insert-request', websiteId, { index });
        }}
        style={{
          position: 'absolute',
          top: '-14px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '28px',
          padding: '0 10px',
          borderRadius: '999px',
          border: '2px solid #fff',
          background: '#2563eb',
          color: '#fff',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '10px',
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(37,99,235,.32)',
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
        Add Section
      </button>
    </div>
  );
}

function CardGrid({
  pageId,
  block,
  items,
  fields,
}: {
  pageId: string;
  block: BuilderBlock;
  items: any[];
  fields: { title: string; body: string; image?: string }[];
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '22px', marginTop: '32px' }}>
      {items.map((item, index) => (
        <article key={item.id || index} style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '16px', background: '#fff', boxShadow: '0 10px 28px rgba(15,23,42,.06)' }}>
          {fields[0]?.image && item[fields[0].image] ? (
            <LiveImage
              pageId={pageId}
              regionId={`builder.${block.id}.items.${index}.${fields[0].image}`}
              label={`${block.type} Image ${index + 1}`}
              value={{ src: item[fields[0].image], alt: item[fields[0].title] }}
              className="rcms-builder-card-image"
            />
          ) : null}
          <LiveText
            pageId={pageId}
            regionId={`builder.${block.id}.items.${index}.${fields[0]?.title || 'title'}`}
            label={`${block.type} Title ${index + 1}`}
            value={item[fields[0]?.title || 'title'] || item.name || ''}
            as="h3"
            style={{ margin: '12px 0 8px', fontSize: '18px', color: '#0f172a' }}
          />
          <LiveText
            pageId={pageId}
            regionId={`builder.${block.id}.items.${index}.${fields[0]?.body || 'description'}`}
            label={`${block.type} Description ${index + 1}`}
            value={item[fields[0]?.body || 'description'] || item.quote || item.bio || ''}
            as="p"
            style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}
          />
        </article>
      ))}
    </div>
  );
}

function renderBlockContent(block: BuilderBlock, pageId: string, locale: string) {
  const title = localized(block, locale, 'title', '');
  const subtitle = localized(block, locale, 'subtitle', '');
  const blockRegion = (field: string) => `builder.${block.id}.${field}`;

  switch (block.type) {
    case 'hero':
      return (
        <div style={{
          minHeight: '520px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '72px 24px',
          borderRadius: '20px',
          color: '#fff',
          background: block.image
            ? `linear-gradient(rgba(15,23,42,${block.overlayOpacity || .68}), rgba(15,23,42,${block.overlayOpacity || .68})), url(${block.image}) center/cover`
            : 'linear-gradient(135deg, #0f172a, #1d4ed8)',
        }}>
          <LiveText pageId={pageId} regionId={blockRegion('title')} label="Hero Title" value={title || 'Build something remarkable'} as="h1" style={{ margin: 0, fontSize: 'clamp(42px, 7vw, 76px)', lineHeight: 1.02, maxWidth: '900px' }} />
          <LiveText pageId={pageId} regionId={blockRegion('subtitle')} label="Hero Subtitle" value={subtitle || 'Create beautiful experiences with a visual workflow.'} as="p" style={{ maxWidth: '680px', fontSize: '18px', lineHeight: 1.7, color: '#cbd5e1', margin: '24px 0 30px' }} />
          <LiveButton pageId={pageId} regionId={blockRegion('button')} label="Hero Button" value={{ text: localized(block, locale, 'buttonText', 'Get Started'), href: block.buttonUrl || '#', color: '#2563eb', size: 'lg' }} />
        </div>
      );

    case 'heading': {
      const level = /^h[1-6]$/.test(block.level) ? block.level : 'h2';
      return <LiveText pageId={pageId} regionId={blockRegion('text')} label="Heading" value={localized(block, locale, 'text', 'Section heading')} as={level} style={{ margin: 0, color: block.color || '#0f172a', textAlign: block.alignment || 'left', fontSize: level === 'h1' ? '52px' : '38px' }} />;
    }

    case 'paragraph':
      return <LiveText pageId={pageId} regionId={blockRegion('text')} label="Paragraph" value={localized(block, locale, 'text', '<p>Add your story here.</p>')} as="div" html style={{ color: '#475569', fontSize: '17px', lineHeight: 1.8, textAlign: block.alignment || 'left' }} />;

    case 'button':
      return <div style={{ textAlign: 'center' }}><LiveButton pageId={pageId} regionId={blockRegion('button')} label="Button" value={{ text: localized(block, locale, 'label', 'Learn More'), href: block.url, variant: block.variant, size: block.size, color: block.color, radius: block.radius }} /></div>;

    case 'image':
      return (
        <figure style={{ margin: 0, textAlign: 'center' }}>
          <LiveImage pageId={pageId} regionId={blockRegion('image')} label="Image" value={{ src: block.src, alt: localized(block, locale, 'alt', ''), width: block.width || '100%' }} className="rcms-builder-image" />
          {localized(block, locale, 'caption', '') ? <LiveText pageId={pageId} regionId={blockRegion('caption')} label="Image Caption" value={localized(block, locale, 'caption')} as="figcaption" style={{ marginTop: '10px', color: '#64748b', fontSize: '13px' }} /> : null}
        </figure>
      );

    case 'gallery': {
      const images = block.images || [];
      return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${block.columns || 3}, minmax(0, 1fr))`, gap: `${block.gap || 16}px` }}>{images.map((image: any, index: number) => <LiveImage key={image.id || index} pageId={pageId} regionId={blockRegion(`images.${index}`)} label={`Gallery Image ${index + 1}`} value={image} className="rcms-builder-gallery-image" />)}</div>;
    }

    case 'video':
      return (
        <figure style={{ margin: 0 }}>
          {block.url ? <video src={block.url} poster={block.poster} controls={block.controls !== false} autoPlay={!!block.autoplay} style={{ display: 'block', width: '100%', borderRadius: '16px', background: '#020617' }} /> : <div style={{ minHeight: '320px', borderRadius: '16px', background: '#0f172a', color: '#94a3b8', display: 'grid', placeItems: 'center' }}>Choose a video in the Inspector</div>}
          <LiveText pageId={pageId} regionId={blockRegion('caption')} label="Video Caption" value={localized(block, locale, 'caption', '')} as="figcaption" style={{ marginTop: '10px', color: '#64748b', fontSize: '13px' }} />
        </figure>
      );

    case 'columns': {
      const items = localized(block, locale, 'items', []);
      return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${block.columns || 2}, minmax(0, 1fr))`, gap: `${block.gap || 24}px` }}>{items.map((item: any, index: number) => <div key={item.id || index} style={{ padding: '24px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}><LiveText pageId={pageId} regionId={blockRegion(`columns.${index}.title`)} label={`Column ${index + 1} Title`} value={item.title} as="h3" style={{ marginTop: 0, color: '#0f172a' }} /><LiveText pageId={pageId} regionId={blockRegion(`columns.${index}.text`)} label={`Column ${index + 1} Content`} value={item.text} as="p" style={{ color: '#64748b', lineHeight: 1.7 }} /></div>)}</div>;
    }

    case 'container':
      return <div style={{ maxWidth: `${block.maxWidth || 1120}px`, margin: '0 auto', padding: `${block.padding || 32}px`, borderRadius: '16px', background: block.background || '#fff', border: '1px solid #e2e8f0' }}><LiveText pageId={pageId} regionId={blockRegion('title')} label="Container Title" value={title || 'Container'} as="h2" style={{ color: '#0f172a', marginTop: 0 }} /><LiveText pageId={pageId} regionId={blockRegion('text')} label="Container Content" value={localized(block, locale, 'text', 'Add content to this container.')} as="p" style={{ color: '#64748b', lineHeight: 1.7 }} /></div>;

    case 'features':
    case 'services':
    case 'cards':
    case 'testimonials':
    case 'team':
    case 'blog-posts': {
      const items = localized(block, locale, block.type === 'cards' ? 'cards' : block.type === 'team' ? 'members' : 'items', []);
      return (
        <>
          <LiveText pageId={pageId} regionId={blockRegion('title')} label={`${block.type} Title`} value={title || block.type.replace('-', ' ')} as="h2" style={{ margin: 0, color: '#0f172a', fontSize: '38px', textAlign: 'center' }} />
          {subtitle ? <LiveText pageId={pageId} regionId={blockRegion('subtitle')} label={`${block.type} Subtitle`} value={subtitle} as="p" style={{ color: '#64748b', textAlign: 'center', fontSize: '17px' }} /> : null}
          <CardGrid pageId={pageId} block={block} items={items} fields={[{ title: block.type === 'team' ? 'name' : 'title', body: block.type === 'testimonials' ? 'quote' : block.type === 'team' ? 'bio' : block.type === 'blog-posts' ? 'excerpt' : 'description', image: block.type === 'team' ? 'avatar' : block.type === 'blog-posts' ? 'image' : undefined }]} />
        </>
      );
    }

    case 'pricing': {
      const plans = localized(block, locale, 'plans', []);
      return (
        <>
          <LiveText pageId={pageId} regionId={blockRegion('title')} label="Pricing Title" value={title || 'Simple pricing'} as="h2" style={{ margin: 0, color: '#0f172a', fontSize: '38px', textAlign: 'center' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '22px', marginTop: '32px' }}>{plans.map((plan: any, index: number) => <article key={plan.id || index} style={{ padding: '28px', border: plan.highlighted ? '2px solid #2563eb' : '1px solid #e2e8f0', borderRadius: '18px', background: '#fff' }}><LiveText pageId={pageId} regionId={blockRegion(`plans.${index}.name`)} label={`Plan ${index + 1} Name`} value={plan.name} as="h3" style={{ margin: 0, color: '#0f172a' }} /><div style={{ fontSize: '36px', fontWeight: 800, color: '#0f172a', margin: '16px 0' }}>${plan.price || 0}<span style={{ fontSize: '13px', color: '#64748b' }}>/{plan.period || 'month'}</span></div><LiveText pageId={pageId} regionId={blockRegion(`plans.${index}.features`)} label={`Plan ${index + 1} Features`} value={plan.features} as="p" style={{ color: '#64748b', lineHeight: 1.8 }} /></article>)}</div>
        </>
      );
    }

    case 'faq':
    case 'accordion': {
      const items = localized(block, locale, 'items', []);
      return (
        <>
          <LiveText pageId={pageId} regionId={blockRegion('title')} label="Accordion Title" value={title || 'Frequently asked questions'} as="h2" style={{ marginTop: 0, color: '#0f172a', fontSize: '36px' }} />
          <div style={{ display: 'grid', gap: '10px' }}>
            {items.map((item: any, index: number) => (
              <details key={item.id || index} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 18px', background: '#fff' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#0f172a' }}>
                  <LiveText
                    pageId={pageId}
                    regionId={blockRegion(`items.${index}.title`)}
                    label={`Accordion Item ${index + 1}`}
                    value={item.question || item.title || `Item ${index + 1}`}
                  />
                </summary>
                <LiveText
                  pageId={pageId}
                  regionId={blockRegion(`items.${index}.content`)}
                  label={`Accordion Content ${index + 1}`}
                  value={item.answer || item.content}
                  as="p"
                  style={{ color: '#64748b', lineHeight: 1.7 }}
                />
              </details>
            ))}
          </div>
        </>
      );
    }

    case 'cta':
      return <div style={{ padding: '56px 32px', borderRadius: '22px', textAlign: 'center', color: '#fff', background: block.background || 'linear-gradient(135deg,#1d4ed8,#7c3aed)' }}><LiveText pageId={pageId} regionId={blockRegion('title')} label="CTA Title" value={title || 'Ready to get started?'} as="h2" style={{ margin: 0, fontSize: '40px' }} /><LiveText pageId={pageId} regionId={blockRegion('subtitle')} label="CTA Subtitle" value={subtitle} as="p" style={{ color: '#dbeafe', fontSize: '17px', margin: '14px auto 26px', maxWidth: '620px' }} /><LiveButton pageId={pageId} regionId={blockRegion('button')} label="CTA Button" value={{ text: localized(block, locale, 'primaryButtonText', 'Get Started'), href: block.primaryButtonUrl, color: '#0f172a', size: 'lg' }} /></div>;

    case 'contact':
      return <div style={{ maxWidth: '760px', margin: '0 auto' }}><LiveText pageId={pageId} regionId={blockRegion('title')} label="Contact Title" value={title || 'Contact us'} as="h2" style={{ color: '#0f172a', fontSize: '38px' }} /><LiveText pageId={pageId} regionId={blockRegion('subtitle')} label="Contact Subtitle" value={subtitle} as="p" style={{ color: '#64748b' }} /><form onSubmit={(event) => event.preventDefault()} style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>{(block.fields || [{ id: 'name', placeholder: 'Your name' }, { id: 'email', placeholder: 'Email address' }, { id: 'message', placeholder: 'How can we help?' }]).map((field: any, index: number) => <input key={field.id || index} placeholder={field.placeholder || field.name} style={{ height: '48px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '0 14px', fontSize: '15px' }} />)}<button type="submit" style={{ height: '48px', border: 0, borderRadius: '10px', background: '#2563eb', color: '#fff', fontWeight: 700 }}>{localized(block, locale, 'submitText', 'Send Message')}</button></form></div>;

    case 'newsletter':
      return <div style={{ padding: '48px 28px', borderRadius: '20px', background: '#0f172a', color: '#fff', textAlign: 'center' }}><LiveText pageId={pageId} regionId={blockRegion('title')} label="Newsletter Title" value={title || 'Stay in the loop'} as="h2" style={{ margin: 0, fontSize: '36px' }} /><LiveText pageId={pageId} regionId={blockRegion('subtitle')} label="Newsletter Subtitle" value={subtitle} as="p" style={{ color: '#94a3b8' }} /><form onSubmit={(event) => event.preventDefault()} style={{ display: 'flex', maxWidth: '520px', margin: '24px auto 0', gap: '10px' }}><input type="email" placeholder={localized(block, locale, 'placeholder', 'you@example.com')} style={{ flex: 1, height: '48px', borderRadius: '10px', border: '1px solid #334155', background: '#111827', color: '#fff', padding: '0 14px' }} /><button type="submit" style={{ height: '48px', border: 0, borderRadius: '10px', background: '#2563eb', color: '#fff', padding: '0 20px', fontWeight: 700 }}>{localized(block, locale, 'buttonText', 'Subscribe')}</button></form></div>;

    case 'map':
      return <div>{title ? <LiveText pageId={pageId} regionId={blockRegion('title')} label="Map Title" value={title} as="h2" style={{ color: '#0f172a' }} /> : null}{block.embedUrl ? <iframe src={block.embedUrl} title={localized(block, locale, 'address', 'Map')} style={{ width: '100%', height: `${block.height || 420}px`, border: 0, borderRadius: '16px' }} loading="lazy" /> : <div style={{ height: `${block.height || 420}px`, borderRadius: '16px', display: 'grid', placeItems: 'center', background: '#e2e8f0', color: '#64748b' }}>{localized(block, locale, 'address', 'Add a Google Maps embed URL')}</div>}</div>;

    case 'spacer':
      return <div style={{ height: `${block.height || 64}px` }} />;

    case 'divider':
      return <hr style={{ border: 0, borderTop: `1px ${block.style || 'solid'} ${block.color || '#cbd5e1'}`, margin: `${block.margin || 24}px 0` }} />;

    case 'html':
      return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.code) }} />;

    case 'custom-react':
      return <div style={{ padding: '28px', borderRadius: '14px', border: '1px dashed #94a3b8', background: '#f8fafc', color: '#475569', textAlign: 'center' }}><strong>{block.componentId || 'Custom React Component'}</strong><div style={{ fontSize: '12px', marginTop: '6px' }}>Runtime component registry slot</div></div>;

    case 'footer':
      return <footer style={{ padding: '32px', background: '#0f172a', color: '#cbd5e1', borderRadius: '16px', textAlign: 'center' }}><LiveText pageId={pageId} regionId={blockRegion('copyright')} label="Footer Copyright" value={localized(block, locale, 'copyright', '© Your Company')} /></footer>;

    default:
      return <div style={{ padding: '28px', border: '1px dashed #cbd5e1', borderRadius: '14px', color: '#64748b' }}>Configure the {block.type} section in ReactCMS.</div>;
  }
}

function BuilderBlockView({
  block,
  pageId,
  locale,
}: {
  block: BuilderBlock;
  pageId: string;
  locale: string;
}) {
  const design = block.design || (
    block.style && typeof block.style === 'object' ? block.style : {}
  );
  const sectionStyle: CSSProperties = {
    background: design.background || 'transparent',
    padding: `${design.paddingY ?? 64}px 24px`,
  };
  const maxWidth = design.maxWidth || 1120;

  return (
    <section
      className="rcms-editable-region rcms-builder-block"
      style={sectionStyle}
      data-rcms-region={`__block__:${block.id}`}
      data-rcms-type="block"
      data-rcms-label={`${block.type.replace(/-/g, ' ')} Section`}
      data-rcms-builder-block={block.id}
    >
      <div style={{ width: '100%', maxWidth: `${maxWidth}px`, margin: '0 auto' }}>
        {renderBlockContent(block, pageId, locale)}
      </div>
    </section>
  );
}

export interface BuilderSectionsProps {
  websiteId: string;
}

export function BuilderSections({ websiteId }: BuilderSectionsProps) {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);
  const pageId = useMemo(() => resolvePageId(page?.currentPage), [page?.currentPage]);
  const locale = page?.locale || 'en';
  const stored = MessageBus.getStoredRegionValue(pageId, BUILDER_BLOCKS_REGION);
  const [blocks, setBlocks] = useState<BuilderBlock[]>(Array.isArray(stored) ? stored : []);

  useEffect(() => {
    const nextStored = MessageBus.getStoredRegionValue(pageId, BUILDER_BLOCKS_REGION);
    setBlocks(Array.isArray(nextStored) ? nextStored : []);
  }, [pageId]);

  useEffect(() => MessageBus.subscribe((message) => {
    if (message.type === 'rcms/v1/field-update') {
      const payload = message.payload as { pageId?: string; regionId?: string; value?: unknown };
      if (payload.regionId === BUILDER_BLOCKS_REGION && Array.isArray(payload.value)) {
        setBlocks(payload.value as BuilderBlock[]);
      }
    }
    if (message.type === 'rcms/v1/builder-structure-update') {
      const payload = message.payload as { pageId?: string; blocks?: BuilderBlock[] };
      if (Array.isArray(payload.blocks)) setBlocks(payload.blocks);
    }
  }), []);

  if (blocks.length === 0) return null;

  return (
    <div data-rcms-builder-root={pageId}>
      {cms?.editMode ? <InsertPoint websiteId={websiteId} index={0} /> : null}
      {blocks.map((block, index) => (
        <React.Fragment key={block.id}>
          <BuilderBlockView block={block} pageId={pageId} locale={locale} />
          {cms?.editMode ? <InsertPoint websiteId={websiteId} index={index + 1} /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

export default BuilderSections;
