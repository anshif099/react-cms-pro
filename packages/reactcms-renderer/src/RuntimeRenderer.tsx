import React, {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { defaultComponentRegistry } from './registry';
import type {
  ComponentNode,
  DropPosition,
  RendererComponentProps,
  ResponsiveMode,
  RuntimeRendererProps,
} from './types';

function localized(node: ComponentNode, locale: string, key: string, fallback: any = '') {
  return node.props?.locales?.[locale]?.[key]
    ?? node.props?.locales?.en?.[key]
    ?? node.props?.[key]
    ?? fallback;
}

function cleanHtml(value: unknown) {
  return String(value || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
}

function responsiveStyle(node: ComponentNode, mode: ResponsiveMode) {
  return {
    ...(node.styles?.base || {}),
    ...(node.styles?.desktop || {}),
    ...(mode === 'laptop' ? node.styles?.laptop || {} : {}),
    ...(mode === 'tablet' ? node.styles?.tablet || {} : {}),
    ...(mode === 'mobile' ? node.styles?.mobile || {} : {}),
  };
}

function inlinePath(locale: string, key: string): Array<string | number> {
  return ['props', 'locales', locale, key];
}

function InlineText({
  as = 'span',
  value,
  html = false,
  editable,
  selected,
  style,
  className,
  onCommit,
  nodeId,
  field,
}: {
  as?: keyof React.JSX.IntrinsicElements;
  value: unknown;
  html?: boolean;
  editable: boolean;
  selected: boolean;
  style?: React.CSSProperties;
  className?: string;
  onCommit: (value: string) => void;
  nodeId: string;
  field: string;
}) {
  const [editing, setEditing] = useState(false);
  const [display, setDisplay] = useState(String(value ?? ''));
  const ref = useRef<HTMLElement | null>(null);
  const Tag = as as any;

  useEffect(() => {
    if (!editing) setDisplay(String(value ?? ''));
  }, [editing, value]);

  const finish = (commit: boolean) => {
    const next = ref.current?.innerText ?? display;
    setEditing(false);
    if (commit) {
      setDisplay(next);
      onCommit(next);
    } else {
      setDisplay(String(value ?? ''));
    }
  };

  const common = {
    ref,
    className,
    style: {
      ...style,
      cursor: editable ? (editing ? 'text' : 'text') : undefined,
      outline: editing ? '2px solid #2563eb' : undefined,
      outlineOffset: editing ? '3px' : undefined,
      minWidth: editable && selected ? '12px' : undefined,
    },
    'data-rcms-inline': editable ? 'true' : undefined,
    'data-rcms-node-id': nodeId,
    'data-rcms-field': field,
    contentEditable: editing,
    suppressContentEditableWarning: true,
    onDoubleClick: (event: React.MouseEvent) => {
      if (!editable) return;
      event.preventDefault();
      event.stopPropagation();
      setEditing(true);
      window.setTimeout(() => {
        ref.current?.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        if (ref.current) {
          range.selectNodeContents(ref.current);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 0);
    },
    onBlur: () => editing && finish(true),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (!editing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        finish(true);
      }
    },
  };

  if (html && !editing) {
    return <Tag {...common} dangerouslySetInnerHTML={{ __html: cleanHtml(display) }} />;
  }
  return <Tag {...common}>{display}</Tag>;
}

function buttonStyle(node: ComponentNode): React.CSSProperties {
  const props = node.props || {};
  const color = props.color || 'var(--rcms-color-primary, #2563eb)';
  const shadows: Record<string, string> = {
    none: 'none',
    small: '0 5px 14px rgba(15,23,42,.12)',
    medium: '0 12px 28px rgba(15,23,42,.16)',
    large: '0 20px 45px rgba(15,23,42,.22)',
  };
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: props.size === 'lg' ? '50px' : props.size === 'sm' ? '36px' : '42px',
    padding: props.size === 'lg' ? '0 26px' : props.size === 'sm' ? '0 14px' : '0 20px',
    borderRadius: props.radius !== undefined
      ? `${props.radius}px`
      : 'var(--rcms-button-radius, 10px)',
    background: props.variant === 'outline' ? 'transparent' : color,
    border: `1px solid ${color}`,
    color: props.variant === 'outline' ? color : '#fff',
    boxShadow: shadows[props.shadow || 'medium'] || props.shadow,
    fontWeight: props.weight || 'var(--rcms-button-weight, 700)',
    textDecoration: 'none',
  };
}

function cards(items: any[], bodyKey = 'description') {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '22px',
      marginTop: '30px',
    }}>
      {items.map((item, index) => (
        <article key={item.id || index} style={{
          padding: '24px',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          background: '#fff',
          boxShadow: '0 12px 30px rgba(15,23,42,.06)',
        }}>
          {item.image || item.avatar ? (
            <img
              src={item.image || item.avatar}
              alt={item.title || item.name || ''}
              style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: '12px' }}
            />
          ) : null}
          <h3 style={{ margin: '12px 0 8px', color: 'var(--rcms-color-text, #0f172a)', fontSize: '19px' }}>
            {item.title || item.name || `Item ${index + 1}`}
          </h3>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>
            {item[bodyKey] || item.quote || item.bio || item.excerpt || ''}
          </p>
        </article>
      ))}
    </div>
  );
}

function BuiltinComponent({
  node,
  locale,
  mode,
  selected,
  children,
  mutate,
}: {
  node: ComponentNode;
  locale: string;
  mode: RuntimeRendererProps['mode'];
  selected: boolean;
  children: React.ReactNode;
  mutate: (path: Array<string | number>, value: unknown) => void;
}) {
  const props = node.props || {};
  const edit = mode === 'edit';
  const text = (key: string, fallback = '') => localized(node, locale, key, fallback);
  const inline = (
    key: string,
    fallback: string,
    as: keyof React.JSX.IntrinsicElements,
    style?: React.CSSProperties,
    html = false,
  ) => (
    <InlineText
      as={as}
      value={text(key, fallback)}
      html={html}
      editable={edit && !node.locked}
      selected={selected}
      style={style}
      onCommit={(value) => mutate(inlinePath(locale, key), value)}
      nodeId={node.id}
      field={key}
    />
  );

  if (['section', 'container', 'grid', 'flex', 'columns'].includes(node.type)) {
    const layout = node.type === 'grid' || node.type === 'columns'
      ? {
        display: 'grid',
        gridTemplateColumns: `repeat(${props.columns || 2}, minmax(0, 1fr))`,
        gap: `${props.gap || 24}px`,
      }
      : node.type === 'flex'
        ? {
          display: 'flex',
          flexDirection: props.direction || 'row',
          flexWrap: 'wrap' as const,
          gap: `${props.gap || 20}px`,
        }
        : {};
    return (
      <div style={{ ...layout, minHeight: node.children?.length ? undefined : mode === 'edit' ? '90px' : undefined }}>
        {node.children?.length ? children : mode === 'edit' ? (
          <div style={{ minHeight: '90px', display: 'grid', placeItems: 'center', border: '1px dashed #cbd5e1', borderRadius: '10px', color: '#94a3b8', fontSize: '12px' }}>
            Drop components inside {node.label || node.type}
          </div>
        ) : null}
      </div>
    );
  }

  switch (node.type) {
    case 'hero':
      return (
        <div style={{
          minHeight: '500px',
          padding: '64px 28px',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: '#fff',
          background: props.image
            ? `linear-gradient(rgba(15,23,42,${props.overlayOpacity ?? .68}),rgba(15,23,42,${props.overlayOpacity ?? .68})),url(${props.image}) center/cover`
            : 'linear-gradient(135deg,#0f172a,#1d4ed8 60%,#7c3aed)',
        }}>
          {inline('title', 'Build something remarkable', 'h1', {
            margin: 0,
            maxWidth: '900px',
            fontSize: 'clamp(40px,7vw,76px)',
            lineHeight: 1.02,
          })}
          {inline('subtitle', 'Create beautiful experiences with a native visual workflow.', 'p', {
            maxWidth: '680px',
            margin: '24px 0 30px',
            color: '#cbd5e1',
            fontSize: '18px',
            lineHeight: 1.7,
          })}
          <span style={buttonStyle({ ...node, props: { ...props, color: '#2563eb', size: 'lg' } })}>
            {inline('buttonText', 'Get Started', 'span')}
          </span>
        </div>
      );
    case 'heading': {
      const level = /^h[1-6]$/.test(props.level) ? props.level : 'h2';
      return inline('text', 'Section heading', level, {
        margin: 0,
        color: props.color || 'var(--rcms-color-text, #0f172a)',
        textAlign: props.alignment || 'left',
        fontSize: level === 'h1' ? '52px' : level === 'h2' ? '38px' : undefined,
      });
    }
    case 'paragraph':
      return inline('text', '<p>Add your story here.</p>', 'div', {
        color: '#475569',
        fontSize: '17px',
        lineHeight: 1.8,
        textAlign: props.alignment || 'left',
      }, true);
    case 'button':
      return (
        <div style={{ textAlign: props.alignment || 'center' }}>
          <span style={buttonStyle(node)}>{inline('label', 'Learn More', 'span')}</span>
        </div>
      );
    case 'image':
      return props.src ? (
        <figure style={{ margin: 0, textAlign: 'center' }}>
          <img
            src={props.src}
            alt={text('alt', '')}
            style={{
              width: props.width || '100%',
              height: props.height || 'auto',
              objectFit: props.objectFit || 'cover',
              objectPosition: props.objectPosition || '50% 50%',
              borderRadius: `${props.radius || 0}px`,
            }}
          />
          {text('caption') ? inline('caption', '', 'figcaption', { marginTop: '10px', color: '#64748b' }) : null}
        </figure>
      ) : (
        <div style={{
          minHeight: '220px',
          border: '2px dashed #cbd5e1',
          borderRadius: '14px',
          display: 'grid',
          placeItems: 'center',
          color: '#64748b',
          background: '#f8fafc',
        }}>Choose an image in the Inspector</div>
      );
    case 'gallery':
      return (
        <>
          {text('title') ? inline('title', '', 'h2', {
            margin: '0 0 10px',
            color: '#0f172a',
            fontSize: '38px',
            textAlign: 'center',
          }) : null}
          {text('subtitle') ? inline('subtitle', '', 'p', {
            maxWidth: '760px',
            margin: '0 auto 28px',
            color: '#64748b',
            fontSize: '17px',
            lineHeight: 1.7,
            textAlign: 'center',
          }) : null}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${props.columns === '4' ? '210px' : '250px'}),1fr))`,
            gap: `${props.gap || 16}px`,
          }}>
            {(props.images || []).map((image: any, index: number) => (
              <figure key={image.id || index} style={{
                margin: 0,
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                background: '#ffffff',
                boxShadow: '0 12px 28px rgba(15,23,42,.08)',
              }}>
                <img
                  src={image.src}
                  alt={image.alt || ''}
                  style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }}
                />
                {(image.title || image.caption || image.description) ? (
                  <figcaption style={{ padding: '14px 16px 16px', color: '#475569', lineHeight: 1.55 }}>
                    {image.title ? <strong style={{ display: 'block', marginBottom: '5px', color: '#0f172a', fontSize: '15px' }}>{image.title}</strong> : null}
                    <span style={{ fontSize: '13px' }}>{image.description || image.caption}</span>
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </>
      );
    case 'video':
      return props.url ? (
        <video src={props.url} poster={props.poster} controls={props.controls !== false} autoPlay={!!props.autoplay} style={{ width: '100%', borderRadius: '16px', background: '#020617' }} />
      ) : (
        <div style={{ minHeight: '300px', borderRadius: '16px', background: '#0f172a', color: '#94a3b8', display: 'grid', placeItems: 'center' }}>Choose a video in the Inspector</div>
      );
    case 'features':
    case 'services':
    case 'cards':
    case 'testimonials':
    case 'team':
    case 'blog-posts': {
      const collectionKey = node.type === 'cards' ? 'cards' : node.type === 'team' ? 'members' : 'items';
      const items = localized(node, locale, collectionKey, []);
      const body = node.type === 'testimonials' ? 'quote' : node.type === 'team' ? 'bio' : node.type === 'blog-posts' ? 'excerpt' : 'description';
      return (
        <>
          {inline('title', node.type.replace(/-/g, ' '), 'h2', { margin: 0, color: '#0f172a', fontSize: '38px', textAlign: 'center' })}
          {text('subtitle') ? inline('subtitle', '', 'p', { color: '#64748b', textAlign: 'center', fontSize: '17px' }) : null}
          {cards(items, body)}
        </>
      );
    }
    case 'pricing': {
      const plans = localized(node, locale, 'plans', []);
      return (
        <>
          {inline('title', 'Simple pricing', 'h2', { margin: 0, color: '#0f172a', fontSize: '38px', textAlign: 'center' })}
          {cards(plans.map((plan: any) => ({
            ...plan,
            title: `${plan.name || 'Plan'} — $${plan.price || 0}/${plan.period || 'month'}`,
            description: plan.features,
          })))}
        </>
      );
    }
    case 'faq':
    case 'accordion': {
      const items = localized(node, locale, 'items', []);
      return (
        <>
          {inline('title', 'Frequently asked questions', 'h2', { marginTop: 0, color: '#0f172a', fontSize: '36px' })}
          <div style={{ display: 'grid', gap: '10px' }}>
            {items.map((item: any, index: number) => (
              <details key={item.id || index} style={{ padding: '16px 18px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#0f172a' }}>{item.question || item.title || `Item ${index + 1}`}</summary>
                <p style={{ color: '#64748b', lineHeight: 1.7 }}>{item.answer || item.content}</p>
              </details>
            ))}
          </div>
        </>
      );
    }
    case 'cta':
      return (
        <div style={{ padding: '56px 32px', borderRadius: '22px', textAlign: 'center', color: '#fff', background: props.background || 'linear-gradient(135deg,#1d4ed8,#7c3aed)' }}>
          {inline('title', 'Ready to get started?', 'h2', { margin: 0, fontSize: '40px' })}
          {inline('subtitle', 'Take the next step today.', 'p', { color: '#dbeafe', fontSize: '17px' })}
          <span style={buttonStyle({ ...node, props: { color: '#0f172a', size: 'lg' } })}>{inline('primaryButtonText', 'Get Started', 'span')}</span>
        </div>
      );
    case 'contact':
      return (
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          {inline('title', 'Contact us', 'h2', { color: '#0f172a', fontSize: '38px' })}
          {inline('subtitle', 'Tell us how we can help.', 'p', { color: '#64748b' })}
          <div style={{ display: 'grid', gap: '12px', marginTop: '22px' }}>
            {(props.fields || [{ placeholder: 'Your name' }, { placeholder: 'Email address' }, { placeholder: 'How can we help?' }]).map((field: any, index: number) => (
              <input key={field.id || index} readOnly placeholder={field.placeholder || field.name} style={{ height: '48px', padding: '0 14px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
            ))}
            <button type="button" style={{ height: '48px', border: 0, borderRadius: '10px', background: '#2563eb', color: '#fff', fontWeight: 700 }}>{text('submitText', 'Send Message')}</button>
          </div>
        </div>
      );
    case 'newsletter':
      return (
        <div style={{ padding: '48px 28px', borderRadius: '20px', background: '#0f172a', color: '#fff', textAlign: 'center' }}>
          {inline('title', 'Stay in the loop', 'h2', { margin: 0, fontSize: '36px' })}
          {inline('subtitle', 'Get useful updates delivered to your inbox.', 'p', { color: '#94a3b8' })}
          <div style={{ display: 'flex', maxWidth: '520px', margin: '24px auto 0', gap: '10px' }}>
            <input readOnly placeholder={text('placeholder', 'you@example.com')} style={{ flex: 1, height: '48px', borderRadius: '10px', border: '1px solid #334155', background: '#111827', color: '#fff', padding: '0 14px' }} />
            <button type="button" style={{ padding: '0 20px', border: 0, borderRadius: '10px', background: '#2563eb', color: '#fff', fontWeight: 700 }}>{text('buttonText', 'Subscribe')}</button>
          </div>
        </div>
      );
    case 'input':
      return (
        <label style={{ display: 'grid', gap: '7px', color: '#334155', fontWeight: 600 }}>
          {inline('label', 'Name', 'span')}
          <input readOnly required={!!props.required} placeholder={text('placeholder', 'Enter a value')} style={{ height: '46px', padding: '0 13px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '15px' }} />
        </label>
      );
    case 'textarea-field':
      return (
        <label style={{ display: 'grid', gap: '7px', color: '#334155', fontWeight: 600 }}>
          {inline('label', 'Message', 'span')}
          <textarea readOnly rows={props.rows || 5} placeholder={text('placeholder', 'Enter your message')} style={{ padding: '12px 13px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '15px', resize: 'vertical' }} />
        </label>
      );
    case 'checkbox':
      return (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', color: '#334155', fontWeight: 600 }}>
          <input type="checkbox" readOnly checked={!!props.checked} />
          {inline('label', 'I agree', 'span')}
        </label>
      );
    case 'select-field':
      return (
        <label style={{ display: 'grid', gap: '7px', color: '#334155', fontWeight: 600 }}>
          {inline('label', 'Choose an option', 'span')}
          <select disabled style={{ height: '46px', padding: '0 13px', border: '1px solid #cbd5e1', borderRadius: '9px', background: '#fff' }}>
            {String(text('options', 'First option, Second option')).split(',').map((option) => <option key={option.trim()}>{option.trim()}</option>)}
          </select>
        </label>
      );
    case 'slider': {
      const slides = localized(node, locale, 'slides', []);
      const slide = slides[0] || {};
      return (
        <div style={{ minHeight: '340px', padding: '42px', borderRadius: '18px', display: 'grid', alignContent: 'end', color: '#fff', background: slide.image ? `linear-gradient(transparent,rgba(15,23,42,.8)),url(${slide.image}) center/cover` : 'linear-gradient(135deg,#0f172a,#334155)' }}>
          <h2 style={{ margin: 0, fontSize: '38px' }}>{slide.title || 'Slider'}</h2>
          <p style={{ color: '#cbd5e1' }}>{slide.description || 'Add slides in the Inspector.'}</p>
        </div>
      );
    }
    case 'embed':
      return (
        <div style={{ height: `${props.height || 420}px`, border: '1px dashed #94a3b8', borderRadius: '14px', display: 'grid', placeItems: 'center', textAlign: 'center', color: '#64748b', background: '#f8fafc' }}>
          <div><strong>{text('title', 'Embedded content')}</strong><div style={{ marginTop: '6px', fontSize: '12px' }}>{props.url || 'Add an embed URL'}</div></div>
        </div>
      );
    case 'code':
      return <pre style={{ margin: 0, padding: '22px', overflow: 'auto', borderRadius: '12px', background: '#020617', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.7 }}><code>{props.code || '// Add code'}</code></pre>;
    case 'dynamic':
      return <div style={{ padding: '18px', borderRadius: '10px', background: '#eef2ff', color: '#3730a3' }}>{text('fallback', 'Dynamic content')}<div style={{ marginTop: '5px', fontSize: '10px', opacity: .65 }}>{props.source || 'Data source'} → {props.path || 'value.path'}</div></div>;
    case 'map':
      return <div style={{ height: `${props.height || 420}px`, borderRadius: '16px', display: 'grid', placeItems: 'center', background: '#e2e8f0', color: '#64748b' }}>{text('address', 'Add a map address')}</div>;
    case 'spacer':
      return <div style={{ height: `${props.height || 64}px` }} />;
    case 'divider':
      return <hr style={{ border: 0, borderTop: `1px ${props.style || 'solid'} ${props.color || '#cbd5e1'}`, margin: `${props.margin || 24}px 0` }} />;
    case 'html':
      return <div dangerouslySetInnerHTML={{ __html: cleanHtml(props.code) }} />;
    case 'footer':
      return <footer style={{ padding: '32px', borderRadius: '16px', textAlign: 'center', background: '#0f172a', color: '#cbd5e1' }}>{inline('copyright', '© Your Company', 'span')}</footer>;
    case 'custom-react':
      return <div style={{ padding: '28px', border: '1px dashed #94a3b8', borderRadius: '14px', textAlign: 'center', background: '#f8fafc', color: '#475569' }}><strong>{props.componentId || 'Custom React Component'}</strong><div style={{ fontSize: '12px', marginTop: '6px' }}>Registered runtime component slot</div></div>;
    default:
      return children || <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b' }}>Configure {node.label || node.type}</div>;
  }
}

function NodeFrame({
  node,
  mode,
  selected,
  hovered,
  onSelect,
  onHover,
  onMove,
  onInsert,
  onCommand,
  responsiveMode,
  children,
}: {
  node: ComponentNode;
  mode: RuntimeRendererProps['mode'];
  selected: boolean;
  hovered: boolean;
  onSelect?: RuntimeRendererProps['onSelect'];
  onHover?: RuntimeRendererProps['onHover'];
  onMove?: RuntimeRendererProps['onMove'];
  onInsert?: RuntimeRendererProps['onInsert'];
  onCommand?: RuntimeRendererProps['onCommand'];
  responsiveMode: ResponsiveMode;
  children: React.ReactNode;
}) {
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);
  if (node.hidden && mode !== 'edit') return null;

  const editable = mode === 'edit';
  const responsiveVisible = node.props?.visibility?.[responsiveMode] !== false;
  const design = node.props?.design || {};
  const animation = node.metadata?.animation || {};
  const animationNames: Record<string, string> = {
    'fade-in': 'rcms-fade-in',
    'slide-up': 'rcms-slide-up',
    'scale-in': 'rcms-scale-in',
    parallax: 'rcms-slide-up',
  };
  const shellStyle: React.CSSProperties = {
    position: 'relative',
    display: node.hidden ? 'none' : 'block',
    background: design.background,
    padding: `${design.paddingY ?? (['spacer', 'divider'].includes(node.type) ? 0 : 36)}px 24px`,
    opacity: responsiveVisible ? node.props?.opacity ?? 1 : .32,
    borderRadius: design.radius ? `${design.radius}px` : undefined,
    boxShadow: design.shadow && design.shadow !== 'none' ? design.shadow : undefined,
    transform: design.transform || undefined,
    animationName: animationNames[animation.name],
    animationDuration: animation.name && animation.name !== 'none'
      ? `${animation.duration || 400}ms`
      : undefined,
    animationDelay: animation.name && animation.name !== 'none'
      ? `${animation.delay || 0}ms`
      : undefined,
    animationFillMode: animation.name && animation.name !== 'none' ? 'both' : undefined,
    outline: selected
      ? '2px solid #2563eb'
      : hovered
        ? '2px solid rgba(37,99,235,.65)'
        : editable
          ? '1px solid transparent'
          : undefined,
    outlineOffset: selected || hovered ? '-2px' : undefined,
    transition: 'outline-color 100ms ease, box-shadow 100ms ease',
  };

  const determineDrop = (event: React.DragEvent): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1);
    if (ratio < .25) return 'before';
    if (ratio > .75) return 'after';
    return ['section', 'container', 'grid', 'flex', 'columns'].includes(node.type) ? 'inside' : 'after';
  };

  return (
    <div
      style={shellStyle}
      data-rcms-node={node.id}
      data-rcms-type={node.type}
      data-rcms-selected={selected ? 'true' : undefined}
      data-rcms-responsive-hidden={!responsiveVisible ? 'true' : undefined}
      aria-label={node.metadata?.accessibility?.ariaLabel}
      role={node.metadata?.accessibility?.role}
      tabIndex={node.metadata?.accessibility?.tabIndex}
      draggable={editable && !node.locked}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/reactcms-node', node.id);
      }}
      onDragOver={(event) => {
        if (!editable) return;
        event.preventDefault();
        event.stopPropagation();
        setDropPosition(determineDrop(event));
      }}
      onDragLeave={() => setDropPosition(null)}
      onDrop={(event) => {
        if (!editable) return;
        event.preventDefault();
        event.stopPropagation();
        const position = determineDrop(event);
        const sourceId = event.dataTransfer.getData('application/reactcms-node');
        const componentType = event.dataTransfer.getData('application/reactcms-component');
        setDropPosition(null);
        if (sourceId && sourceId !== node.id) onMove?.(sourceId, node.id, position);
        if (componentType) onInsert?.(componentType, node.id, position);
      }}
      onMouseEnter={(event) => {
        event.stopPropagation();
        if (editable) onHover?.(node.id);
      }}
      onMouseLeave={(event) => {
        event.stopPropagation();
        if (editable) onHover?.(null);
      }}
      onClick={(event) => {
        if (!editable) return;
        event.preventDefault();
        event.stopPropagation();
        onSelect?.(node.id, event.metaKey || event.ctrlKey || event.shiftKey);
      }}
    >
      {dropPosition && (
        <div style={{
          position: 'absolute',
          zIndex: 1000,
          pointerEvents: 'none',
          left: dropPosition === 'inside' ? '8px' : 0,
          right: dropPosition === 'inside' ? '8px' : 0,
          top: dropPosition === 'before' ? '-2px' : dropPosition === 'inside' ? '8px' : undefined,
          bottom: dropPosition === 'after' ? '-2px' : dropPosition === 'inside' ? '8px' : undefined,
          height: dropPosition === 'inside' ? 'auto' : '4px',
          border: dropPosition === 'inside' ? '2px solid #2563eb' : 0,
          background: dropPosition === 'inside' ? 'rgba(37,99,235,.08)' : '#2563eb',
          borderRadius: '4px',
        }} />
      )}

      {(hovered || selected) && editable && onInsert && (
        <>
          {([
            ['before', { top: '-13px' }],
            ['after', { bottom: '-13px' }],
          ] as Array<[DropPosition, React.CSSProperties]>).map(([position, placement]) => (
            <button
              key={position}
              type="button"
              data-rcms-add-section={position}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onInsert('section', node.id, position);
              }}
              style={{
                position: 'absolute',
                zIndex: 1050,
                left: '50%',
                transform: 'translateX(-50%)',
                height: '26px',
                padding: '0 10px',
                border: '1px solid #60a5fa',
                borderRadius: '999px',
                background: '#2563eb',
                color: '#fff',
                boxShadow: '0 6px 20px rgba(37,99,235,.3)',
                cursor: 'pointer',
                font: '700 9px Inter,system-ui,sans-serif',
                ...placement,
              }}
            >
              + Add section
            </button>
          ))}
        </>
      )}

      {selected && editable && (
        <div
          data-rcms-toolbar="true"
          style={{
            position: 'absolute',
            zIndex: 1100,
            top: '-34px',
            right: '6px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            padding: '3px',
            borderRadius: '8px',
            background: '#0f172a',
            color: '#cbd5e1',
            boxShadow: '0 8px 24px rgba(15,23,42,.35)',
            font: '700 10px Inter,system-ui,sans-serif',
          }}
          onClick={(event) => event.stopPropagation()}
          draggable={false}
        >
          {[
            ['move-up', '↑'],
            ['move-down', '↓'],
            ['duplicate', 'Duplicate'],
            ['copy', 'Copy'],
            ['paste', 'Paste'],
            ['delete', 'Delete'],
          ].map(([command, label]) => (
            <button
              key={command}
              type="button"
              onClick={() => onCommand?.(command, node.id)}
              style={{
                height: '24px',
                border: 0,
                borderRadius: '5px',
                padding: '0 7px',
                background: 'transparent',
                color: command === 'delete' ? '#fda4af' : '#cbd5e1',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: `${design.maxWidth || 1120}px`, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );
}

function RenderNode({
  node,
  renderer,
}: {
  node: ComponentNode;
  renderer: Required<Pick<RuntimeRendererProps, 'locale' | 'responsiveMode' | 'mode'>>
    & Omit<RuntimeRendererProps, 'tree' | 'locale' | 'responsiveMode' | 'mode'>;
}) {
  const {
    locale,
    responsiveMode,
    mode,
    selectedIds = [],
    hoveredId,
    registry = defaultComponentRegistry,
    onMutation,
  } = renderer;
  const selected = selectedIds.includes(node.id);
  if (node.props?.visibility?.[responsiveMode] === false && mode !== 'edit') return null;
  const mutate = (path: Array<string | number>, value: unknown) => {
    onMutation?.({ nodeId: node.id, path, value });
  };

  const childNodes = (node.children || []).map((child) => (
    <RenderNode key={child.id} node={child} renderer={renderer} />
  ));
  const Registered = registry.get(node.type);
  const componentProps: RendererComponentProps = {
    node,
    locale,
    responsiveMode,
    mode,
    children: childNodes,
    mutate,
  };
  const content = Registered
    ? createElement(Registered as any, componentProps)
    : (
      <BuiltinComponent
        node={node}
        locale={locale}
        mode={mode}
        selected={selected}
        mutate={mutate}
      >
        {childNodes}
      </BuiltinComponent>
    );

  return (
    <NodeFrame
      node={node}
      mode={mode}
      selected={selected}
      hovered={hoveredId === node.id}
      onSelect={renderer.onSelect}
      onHover={renderer.onHover}
      onMove={renderer.onMove}
      onInsert={renderer.onInsert}
      onCommand={renderer.onCommand}
      responsiveMode={responsiveMode}
    >
      <div style={responsiveStyle(node, responsiveMode)}>
        {content}
      </div>
    </NodeFrame>
  );
}

export function RuntimeRenderer({
  tree,
  locale = tree.locale || 'en',
  responsiveMode = 'desktop',
  mode = 'runtime',
  theme = null,
  ...callbacks
}: RuntimeRendererProps) {
  const renderer = useMemo(() => ({
    locale,
    responsiveMode,
    mode,
    ...callbacks,
  }), [callbacks, locale, mode, responsiveMode]);

  const themeStyle = {
    '--rcms-color-primary': theme?.colors?.primary || '#2563eb',
    '--rcms-color-secondary': theme?.colors?.secondary || '#1e293b',
    '--rcms-color-accent': theme?.colors?.accent || '#f59e0b',
    '--rcms-color-background': theme?.colors?.background || '#ffffff',
    '--rcms-color-text': theme?.colors?.text || '#0f172a',
    '--rcms-button-radius': theme?.buttons?.borderRadius || '10px',
    '--rcms-button-weight': theme?.buttons?.fontWeight || '700',
    width: '100%',
    minHeight: '100%',
    color: 'var(--rcms-color-text)',
    background: 'var(--rcms-color-background)',
    fontFamily: theme?.typography?.bodyFont || 'Inter, system-ui, sans-serif',
    fontSize: theme?.typography?.baseSize || '16px',
    ...responsiveStyle({ id: tree.id, type: 'page', styles: tree.styles }, responsiveMode),
  } as React.CSSProperties;

  return (
    <div
      data-rcms-page-tree={tree.id}
      data-rcms-renderer-version="2"
      style={themeStyle}
    >
      <style>{`
        @keyframes rcms-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rcms-slide-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rcms-scale-in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      {(tree.children || []).map((node) => (
        <RenderNode key={node.id} node={node} renderer={renderer} />
      ))}
    </div>
  );
}

function setAtPath(source: any, path: Array<string | number>, value: unknown): any {
  if (!path.length) return value;
  const [head, ...tail] = path;
  const container = Array.isArray(source) ? [...source] : { ...(source || {}) };
  container[head as any] = setAtPath(container[head as any], tail, value);
  return container;
}

function mutateTreeNode(nodes: ComponentNode[], nodeId: string, path: Array<string | number>, value: unknown): ComponentNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return setAtPath(node, path, value);
    if (!node.children?.length) return node;
    return { ...node, children: mutateTreeNode(node.children, nodeId, path, value) };
  });
}

export class RuntimeRendererEngine {
  renderPage(tree: RuntimeRendererProps['tree'], options: Omit<RuntimeRendererProps, 'tree'> = {}) {
    return <RuntimeRenderer tree={tree} {...options} />;
  }

  renderTree(tree: RuntimeRendererProps['tree'], options: Omit<RuntimeRendererProps, 'tree'> = {}) {
    return this.renderPage(tree, options);
  }

  renderComponent(node: ComponentNode, options: Omit<RuntimeRendererProps, 'tree'> = {}) {
    const tree = { id: `component_${node.id}`, type: 'page' as const, version: 2 as const, children: [node] };
    return this.renderPage(tree, options);
  }

  renderRegion(node: ComponentNode, options: Omit<RuntimeRendererProps, 'tree'> = {}) {
    return this.renderComponent(node, options);
  }

  updateRegion(tree: RuntimeRendererProps['tree'], nodeId: string, path: Array<string | number>, value: unknown) {
    return { ...tree, children: mutateTreeNode(tree.children, nodeId, path, value) };
  }

  rerender(tree: RuntimeRendererProps['tree']) {
    return { ...tree, children: [...tree.children] };
  }
}

export default RuntimeRenderer;
