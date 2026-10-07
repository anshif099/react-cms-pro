// This function is serialized into hosted pages. Keep it self-contained.
export function renderPublishedElement(node, value, richText, styles = {}) {
  const type = node.type;
  const typography = {};
  for (const key of ['color', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight', 'textAlign', 'textDecoration', 'textTransform']) {
    if (styles[key] !== undefined) typography[key] = typeof styles[key] === 'number' && !['fontWeight', 'lineHeight'].includes(key) ? `${styles[key]}px` : styles[key];
  }
  const el = document.createElement('div');
  const get = (key, fallback = '') => value(node, key) ?? fallback;
  const add = (tag, text, parent = el) => {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = String(text);
    parent.appendChild(item);
    return item;
  };
  const link = (label, url, parent = el) => {
    const a = add('a', label, parent);
    if (/^(https?:|mailto:|tel:|\/|#)/i.test(String(url || ''))) a.href = url;
    a.className = 'rcms-button';
    return a;
  };
  const image = (src, alt, parent = el) => {
    if (!src) return;
    const img = add('img', undefined, parent);
    img.src = src; img.alt = alt || ''; img.loading = 'lazy';
    img.style.width = '100%'; img.style.height = 'auto';
    return img;
  };
  const heading = () => {
    if (get('title')) add('h2', get('title'));
    if (get('subtitle')) add('p', get('subtitle'));
  };
  const grid = () => {
    const container = add('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fit,minmax(min(100%,250px),1fr))';
    container.style.gap = `${get('gap', 20) || 20}px`;
    return container;
  };
  const card = (parent) => {
    const item = add('article', undefined, parent);
    Object.assign(item.style, { padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' });
    return item;
  };
  if (['section', 'container', 'column', 'grid', 'columns', 'flex'].includes(type)) {
    if (type === 'grid' || type === 'columns') {
      el.style.display = 'grid';
      el.style.gridTemplateColumns = `repeat(auto-fit,minmax(min(100%,${Math.max(150, Math.floor(1000 / (Number(get('columns', 2)) || 2)))}px),1fr))`;
    }
    if (type === 'flex') { el.style.display = 'flex'; el.style.flexDirection = get('direction', 'row'); el.style.flexWrap = 'wrap'; }
    el.style.gap = `${get('gap', 24)}px`;
    return el;
  }
  if (['features', 'services', 'cards', 'testimonials', 'team', 'blog-posts', 'pricing', 'statistics', 'logos'].includes(type)) {
    heading();
    const parent = grid();
    const infoCards = ['features', 'services', 'cards', 'testimonials', 'team', 'blog-posts'].includes(type);
    if (infoCards) Object.assign(parent.style, { gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,220px), 1fr))', gap: '22px', marginTop: '30px' });
    const key = type === 'cards' ? 'cards' : type === 'team' ? 'members' : type === 'pricing' ? 'plans' : 'items';
    (get(key, []) || []).forEach(item => {
      const box = card(parent);
      if (infoCards) Object.assign(box.style, { borderRadius: '16px', background: '#fff', boxShadow: '0 12px 30px rgba(15,23,42,.06)' });
      image(item.image || item.avatar || item.src, item.alt || item.name || item.title, box);
      const title = add('h3', item.title || item.name || item.label || '', box);
      if (infoCards) Object.assign(title.style, { margin: '12px 0 8px', color: '#0f172a', fontSize: '19px', fontWeight: 'inherit', ...typography });
      if (type === 'pricing') add('strong', `$${item.price || 0}/${item.period || 'month'}`, box);
      if (type === 'statistics') add('strong', item.value || '', box);
      if (item.role) add('p', item.role, box);
      const description = add('p', item.description || item.quote || item.bio || item.excerpt || item.features || '', box);
      if (infoCards) Object.assign(description.style, { margin: '0', color: '#64748b', lineHeight: '1.7', ...typography });
      if (item.buttonText) link(item.buttonText, item.buttonUrl || item.url, box);
    });
    return el;
  }
  if (type === 'gallery') {
    heading(); const parent = grid();
    (get('images', []) || []).forEach(item => {
      const figure = add('figure', undefined, parent); figure.style.margin = '0';
      image(item.src, item.alt, figure);
      if (item.caption) add('figcaption', item.caption, figure);
    }); return el;
  }
  if (type === 'cta') {
    // The editor paints page styles on the wrapper, with a separate CTA banner inside.
    const banner = add('div');
    Object.assign(banner.style, { padding: '56px 32px', borderRadius: '22px', textAlign: 'center', color: '#fff', background: get('background') || 'linear-gradient(135deg,#1d4ed8,#7c3aed)' });
    const typography = {};
    for (const key of ['color', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight', 'textAlign', 'textDecoration', 'textTransform']) {
      if (styles[key] !== undefined) typography[key] = typeof styles[key] === 'number' && !['fontWeight', 'lineHeight'].includes(key) ? `${styles[key]}px` : styles[key];
    }
    const title = add('h2', get('title', 'Ready to get started?'), banner);
    Object.assign(title.style, { margin: '0', fontSize: '40px', ...typography });
    const subtitle = add('p', get('subtitle', 'Take the next step today.'), banner);
    Object.assign(subtitle.style, { color: '#dbeafe', fontSize: '17px', ...typography });
    const button = link(get('primaryButtonText', 'Get Started'), get('primaryButtonUrl'), banner);
    Object.assign(button.style, { minHeight: '50px', padding: '0 26px', background: '#0f172a', border: '1px solid #0f172a', boxShadow: '0 12px 28px rgba(15,23,42,.16)' });
    const label = document.createElement('span');
    label.textContent = button.textContent;
    button.textContent = '';
    Object.assign(label.style, typography);
    button.appendChild(label);
    return el;
  }
  if (type === 'hero') {
    Object.assign(el.style, { padding: '64px 28px', textAlign: 'center', color: '#fff', borderRadius: '16px', background: get('background') || '#0f172a' });
    if (get('image')) image(get('image'), '', el);
    heading();
    link(get(type === 'hero' ? 'buttonText' : 'primaryButtonText', 'Get Started'), get(type === 'hero' ? 'buttonUrl' : 'primaryButtonUrl'));
    if (get('secondaryButtonText')) link(get('secondaryButtonText'), get('secondaryButtonUrl'));
    return el;
  }
  if (type === 'video' || type === 'audio') {
    const media = add(type); media.controls = get('controls', true) !== false;
    media.src = get('url'); media.style.width = '100%';
    if (type === 'video' && get('poster')) media.poster = get('poster');
    return el;
  }
  if (type === 'map' || type === 'embed') {
    const url = type === 'map' ? `https://maps.google.com/maps?q=${encodeURIComponent(get('address'))}&output=embed` : get('url');
    if (/^https?:\/\//i.test(url)) {
      const frame = add('iframe'); frame.src = url; frame.title = get('title', type === 'map' ? 'Map' : 'Embedded content');
      frame.loading = 'lazy'; frame.style.width = '100%'; frame.style.height = `${get('height', 420) || 420}px`; frame.style.border = '0';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    } return el;
  }
  if (type === 'html') { richText(el, get('code')); return el; }
  if (type === 'code') { add('code', get('code'), add('pre')); return el; }
  if (type === 'footer') { image(get('logo'), 'Logo'); add('p', get('copyright')); return el; }
  if (type === 'dynamic') { add('span', get('fallback', '')); return el; }
  if (type === 'custom-react') { add('p', `Custom component: ${get('componentId', 'Unregistered component')}`); return el; }
  if (type === 'quote') { add('blockquote', get('text')); add('cite', get('author')); return el; }
  if (type === 'list' || type === 'timeline') {
    heading(); const list = add(type === 'timeline' || get('ordered') ? 'ol' : 'ul');
    (get('items', []) || []).forEach(item => { const row = add('li', item.text || item.title || '', list); if (item.description) add('p', item.description, row); }); return el;
  }
  if (type === 'table') {
    heading(); el.style.overflowX = 'auto'; const table = add('table'); table.style.width = '100%';
    const headers = String(get('headers')).split(','); const tr = add('tr', undefined, add('thead', undefined, table));
    headers.forEach(header => add('th', header.trim(), tr));
    const body = add('tbody', undefined, table);
    (get('rows', []) || []).forEach(row => { const tr = add('tr', undefined, body); String(row.cells || '').split(',').forEach(cell => add('td', cell.trim(), tr)); }); return el;
  }
  if (type === 'slider') {
    el.style.display = 'flex'; el.style.overflowX = 'auto'; el.style.scrollSnapType = 'x mandatory';
    (get('slides', []) || []).forEach(slide => { const box = card(el); box.style.flex = '0 0 100%'; box.style.boxSizing = 'border-box'; box.style.scrollSnapAlign = 'start'; image(slide.image, slide.title, box); add('h2', slide.title, box); add('p', slide.description, box); }); return el;
  }
  if (['input', 'textarea-field', 'checkbox', 'select-field'].includes(type)) {
    const label = add('label'); add('span', get('label'), label);
    const control = add(type === 'textarea-field' ? 'textarea' : type === 'select-field' ? 'select' : 'input', undefined, label);
    if (type === 'select-field') String(get('options')).split(',').forEach(option => add('option', option.trim(), control));
    else if (type === 'checkbox') { control.type = 'checkbox'; control.checked = !!get('checked'); }
    else { control.placeholder = get('placeholder'); if (type === 'textarea-field') control.rows = Number(get('rows', 5)) || 5; else control.type = get('inputType', 'text'); control.required = !!get('required'); }
    return el;
  }
  if (type === 'contact' || type === 'newsletter') {
    heading();
    // Display fields without pretending that an unconfigured form sends data.
    (type === 'newsletter' ? [{ placeholder: get('placeholder', 'you@example.com'), type: 'email' }] : get('fields', []) || []).forEach(field => {
      const input = add('input'); input.placeholder = field.placeholder || field.name || ''; input.type = field.type || 'text';
    });
    const button = add('button', get(type === 'contact' ? 'submitText' : 'buttonText', 'Submit')); button.type = 'button';
    return el;
  }
  return null;
}
