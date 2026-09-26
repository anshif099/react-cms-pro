function cleanSlug(value) {
  const slug = String(value || "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
  return slug || "page";
}

function componentName(value) {
  const words = cleanSlug(value)
    .split(/[/_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return `${words.join("") || "Page"}Page`;
}

function blockContent(block, locale) {
  return {
    ...block,
    ...(block?.locales?.[locale] || block?.locales?.en || {})
  };
}

export function generateReactPageSource({ title, slug, blocks = [], locale = "en" }) {
  const name = componentName(slug || title);
  const serializedBlocks = JSON.stringify(
    blocks.map((block) => blockContent(block, locale)),
    null,
    2
  );
  return `import React from 'react';

const blocks = ${serializedBlocks};

function Block({ block }) {
  const key = block.id || block.type;
  switch (block.type) {
    case 'hero':
      return (
        <section key={key} data-reactcms-id={key} style={{ padding: '96px 24px', textAlign: 'center' }}>
          <h1>{block.title || 'Untitled page'}</h1>
          {block.subtitle && <p>{block.subtitle}</p>}
          {block.buttonText && <a href={block.buttonUrl || '#'}>{block.buttonText}</a>}
        </section>
      );
    case 'heading':
      return <h2 key={key} data-reactcms-id={key}>{block.text || block.title}</h2>;
    case 'paragraph':
      return (
        <div
          key={key}
          data-reactcms-id={key}
          dangerouslySetInnerHTML={{ __html: block.text || '' }}
        />
      );
    case 'button':
      return <a key={key} data-reactcms-id={key} href={block.url || '#'}>{block.label || 'Learn more'}</a>;
    case 'image':
      return <img key={key} data-reactcms-id={key} src={block.src || block.url || ''} alt={block.alt || ''} />;
    case 'spacer':
      return <div key={key} data-reactcms-id={key} style={{ height: Number(block.height) || 64 }} />;
    case 'divider':
      return <hr key={key} data-reactcms-id={key} />;
    default:
      return (
        <section key={key} data-reactcms-id={key} style={{ padding: '48px 24px' }}>
          {block.title && <h2>{block.title}</h2>}
          {block.subtitle && <p>{block.subtitle}</p>}
          {block.text && <p>{block.text}</p>}
        </section>
      );
  }
}

export default function ${name}() {
  return (
    <main data-reactcms-page="${cleanSlug(slug)}">
      {blocks.length
        ? blocks.map((block) => <Block key={block.id || block.type} block={block} />)
        : <section style={{ padding: '96px 24px' }}><h1>{${JSON.stringify(String(title || "Untitled Page"))}}</h1></section>}
    </main>
  );
}
`;
}

function appendObjectEntry(source, objectName, key, value) {
  const pattern = new RegExp(`(const\\s+${objectName}\\s*=\\s*\\{)([\\s\\S]*?)(\\n?\\};)`);
  return source.replace(pattern, (match, open, body, close) => {
    if (new RegExp(`['"]${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]\\s*:`).test(body)) {
      return match;
    }
    const trimmed = body.trimEnd();
    const separator = trimmed && !trimmed.endsWith(",") ? "," : "";
    return `${open}${trimmed}${separator}\n  '${key}': '${value}'${close}`;
  });
}

export function patchReactStateRouter(source, {
  title,
  slug,
  component,
  importPath
}) {
  const route = `/${cleanSlug(slug)}`;
  const stateKey = cleanSlug(slug).replaceAll("/", "-");
  let next = String(source || "");
  if (!next.includes(`import ${component} from`)) {
    const imports = Array.from(next.matchAll(/^import .*;$/gm));
    const lastImport = imports.at(-1);
    if (!lastImport) throw new Error("The React router file has no import section.");
    const offset = lastImport.index + lastImport[0].length;
    next = `${next.slice(0, offset)}\nimport ${component} from '${importPath}';${next.slice(offset)}`;
  }

  next = appendObjectEntry(next, "pathToPage", route, stateKey);
  next = appendObjectEntry(next, "pageToPath", stateKey, route);

  if (!next.includes(`currentPage === '${stateKey}'`)) {
    const closing = next.lastIndexOf("</div>");
    if (closing === -1) throw new Error("The React router render container was not found.");
    next = `${next.slice(0, closing)}  {currentPage === '${stateKey}' && <${component} />}\n    ${next.slice(closing)}`;
  }

  const navigationPattern = /(const\s+mainNavigationItems\s*=\s*\[)([\s\S]*?)(\n?\];)/;
  next = next.replace(navigationPattern, (match, open, body, close) => {
    if (body.includes(`path: '${route}'`) || body.includes(`path: "${route}"`)) return match;
    const separator = body.trimEnd().endsWith(",") ? "" : ",";
    return `${open}${body.trimEnd()}${separator}\n  { id: 'nav-${stateKey}', label: ${JSON.stringify(title)}, path: '${route}', order: 999 },${close}`;
  });
  return next;
}

export function reactPageSourcePath(slug) {
  return `src/pages/${componentName(slug)}.jsx`;
}

export function reactPageComponentName(slug) {
  return componentName(slug);
}

export function staticPageSourcePath(slug) {
  return `${cleanSlug(slug)}/index.html`;
}

export function generateStaticPageSource({ title, slug, tree, locale = "en" }) {
  const payload = JSON.stringify({ tree, locale }).replace(/</g, "\\u003c");
  const escapedTitle = String(title || "Untitled Page")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  return `<!doctype html>
<html lang="${String(locale).replace(/[^a-zA-Z-]/g, "") || "en"}">
<head><meta charset="utf-8"><base href="/"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapedTitle}</title>
<style>body{margin:0;font-family:Inter,Arial,sans-serif;color:#0f172a}#rcms-shell{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}#rcms-content{min-height:40vh}#rcms-content img{max-width:100%}#rcms-content .rcms-section{padding:48px 24px}#rcms-content .rcms-container{max-width:1200px;margin:auto}#rcms-content .rcms-button{display:inline-block;padding:12px 22px;border-radius:8px;background:#2563eb;color:white;text-decoration:none}</style></head>
<body><div id="rcms-header"></div><div id="rcms-content" role="main"></div><div id="rcms-footer"></div><iframe id="rcms-shell" src="/" title="Site layout" aria-hidden="true"></iframe>
<script id="rcms-page-data" type="application/json">${payload}</script>
<script>(function(){
var data=JSON.parse(document.getElementById('rcms-page-data').textContent);
var locale=data.locale||'en';
function value(node,key){var props=node.props||{};var localized=props.locales&&(props.locales[locale]||props.locales.en);return localized&&localized[key]!==undefined?localized[key]:props[key]}
function richText(target,html){var parsed=new DOMParser().parseFromString(String(html||''),'text/html');parsed.querySelectorAll('script,style,iframe,object,embed,form').forEach(function(item){item.remove()});parsed.querySelectorAll('*').forEach(function(item){Array.from(item.attributes).forEach(function(attribute){if(/^on/i.test(attribute.name)||/^(href|src)$/i.test(attribute.name)&&/^javascript:/i.test(attribute.value))item.removeAttribute(attribute.name)})});Array.from(parsed.body.childNodes).forEach(function(item){target.appendChild(document.importNode(item,true))})}
function render(node){if(!node||node.hidden)return null;var type=node.type;var tags={section:'section',container:'div',columns:'div',column:'div',heading:/^h[1-6]$/.test(value(node,'level'))?value(node,'level'):'h2',paragraph:'div',text:'div',button:'a',image:'figure',spacer:'div',divider:'hr',list:'ul'};var el=document.createElement(tags[type]||'div');if(type==='section')el.className='rcms-section';if(type==='container')el.className='rcms-container';if(type==='heading'){el.textContent=value(node,'text')||value(node,'title')||'';el.style.margin='0';el.style.textAlign=value(node,'alignment')||'left';if(value(node,'color'))el.style.color=value(node,'color');el.style.fontSize=el.tagName==='H1'?'52px':el.tagName==='H2'?'38px':''}if(type==='paragraph'||type==='text'){richText(el,value(node,'text'));el.style.lineHeight='1.8';el.style.color='#475569'}if(type==='button'){el.className='rcms-button';el.textContent=value(node,'label')||'Learn more';el.href=value(node,'url')||'#'}if(type==='image'){el.style.margin='0';el.style.textAlign='center';var image=document.createElement('img');image.src=value(node,'src')||value(node,'url')||'';image.alt=value(node,'alt')||'';image.style.width=value(node,'width')||'100%';image.style.height=value(node,'height')||'auto';image.style.objectFit=value(node,'objectFit')||'cover';image.style.objectPosition=value(node,'objectPosition')||'50% 50%';el.appendChild(image)}if(type==='spacer')el.style.height=(Number(value(node,'height'))||64)+'px';var styles=Object.assign({},node.styles&&node.styles.base,node.styles&&node.styles.desktop);Object.keys(styles).forEach(function(key){if(typeof styles[key]==='string'||typeof styles[key]==='number')el.style[key]=styles[key]});(node.children||[]).forEach(function(child){var item=render(child);if(item)el.appendChild(item)});return el}
(data.tree&&data.tree.children||[]).forEach(function(node){var item=render(node);if(item)document.getElementById('rcms-content').appendChild(item)});
function cleanShell(element){var copy=element.cloneNode(true);[copy].concat(Array.from(copy.querySelectorAll('*'))).forEach(function(item){item.removeAttribute('contenteditable');item.removeAttribute('draggable');Array.from(item.attributes).forEach(function(attribute){if(/^data-(rcms|reactcms)/i.test(attribute.name)||/^on/i.test(attribute.name))item.removeAttribute(attribute.name)});item.setAttribute('class',String(item.getAttribute('class')||'').split(/\s+/).filter(function(name){return name&&!/^(rcms-|reactcms-)/i.test(name)}).join(' '));if(item.style){item.style.outline='none';item.style.outlineOffset='0'}});return copy}
var frame=document.getElementById('rcms-shell');frame.addEventListener('load',function(){var doc;try{doc=frame.contentDocument}catch(e){return}var attempts=0;var timer=setInterval(function(){var header=doc.querySelector('header,[role="banner"],.site-header,#site-header');var footer=doc.querySelector('footer,[role="contentinfo"],.site-footer,#site-footer');if(header&&footer||++attempts>=40){doc.querySelectorAll('link[rel="stylesheet"],style').forEach(function(style){document.head.appendChild(style.cloneNode(true))});if(header)document.getElementById('rcms-header').appendChild(cleanShell(header));if(footer)document.getElementById('rcms-footer').appendChild(cleanShell(footer));clearInterval(timer)}},150)})
})();</script></body></html>`;
}

export default {
  generateReactPageSource,
  patchReactStateRouter,
  reactPageSourcePath,
  reactPageComponentName,
  staticPageSourcePath,
  generateStaticPageSource
};
