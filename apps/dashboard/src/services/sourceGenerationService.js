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

export const STATIC_PAGE_RUNTIME_VERSION = 2;

export function generateStaticPageSource({ title, slug, tree, locale = "en", websiteId = "", pageKey = "" }) {
  const payload = JSON.stringify({ tree, locale, websiteId, pageKey }).replace(/</g, "\\u003c");
  const escapedTitle = String(title || "Untitled Page")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  return `<!doctype html>
<html lang="${String(locale).replace(/[^a-zA-Z-]/g, "") || "en"}">
<head><meta charset="utf-8"><base href="/"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapedTitle}</title>
<style>body{margin:0;font-family:Inter,Arial,sans-serif;color:#0f172a}.rcms-site-shell{display:block;width:100%;height:0;border:0;overflow:hidden}#rcms-content{min-height:40vh}#rcms-content img{max-width:100%}#rcms-content .rcms-node-shell{box-sizing:border-box;padding:36px 24px}#rcms-content .rcms-node-inner{width:100%;max-width:1120px;margin:0 auto}#rcms-content .rcms-container{max-width:1200px;margin:auto}#rcms-content .rcms-button-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;padding:24px;max-width:100%;box-sizing:border-box}#rcms-content .rcms-button{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:42px;padding:0 20px;border-radius:10px;background:#2563eb;color:white;text-decoration:none;font-weight:700;white-space:nowrap;max-width:100%}</style></head>
<body><iframe id="rcms-header" class="rcms-site-shell" src="/?rcms_preview=1" title="Site header"></iframe><div id="rcms-content" role="main"></div><iframe id="rcms-footer" class="rcms-site-shell" src="/?rcms_preview=1" title="Site footer"></iframe>
<script id="rcms-page-data" type="application/json">${payload}</script>
<script>(function(){
var data=JSON.parse(document.getElementById('rcms-page-data').textContent);
var locale=data.locale||'en';
function value(node,key){var props=node.props||{};var localized=props.locales&&(props.locales[locale]||props.locales.en);return localized&&localized[key]!==undefined?localized[key]:props[key]}
function richText(target,html){var parsed=new DOMParser().parseFromString(String(html||''),'text/html');parsed.querySelectorAll('script,style,iframe,object,embed,form').forEach(function(item){item.remove()});parsed.querySelectorAll('*').forEach(function(item){Array.from(item.attributes).forEach(function(attribute){if(/^on/i.test(attribute.name)||/^(href|src)$/i.test(attribute.name)&&/^javascript:/i.test(attribute.value))item.removeAttribute(attribute.name)})});Array.from(parsed.body.childNodes).forEach(function(item){target.appendChild(document.importNode(item,true))})}
function render(node){if(!node||node.hidden)return null;var type=node.type;var tags={section:'section',container:'div',columns:'div',column:'div',heading:/^h[1-6]$/.test(value(node,'level'))?value(node,'level'):'h2',paragraph:'div',text:'div',button:'a',image:'figure',spacer:'div',divider:'hr',list:'ul'};var el=document.createElement(tags[type]||'div');if(type==='section')el.className='rcms-section';if(type==='container')el.className='rcms-container';if(type==='heading'){el.textContent=value(node,'text')||value(node,'title')||'';el.style.margin='0';el.style.textAlign=value(node,'alignment')||'left';if(value(node,'color'))el.style.color=value(node,'color');el.style.fontSize=el.tagName==='H1'?'52px':el.tagName==='H2'?'38px':''}if(type==='paragraph'||type==='text'){richText(el,value(node,'text'));el.style.lineHeight='1.8';el.style.color='#475569'}if(type==='button'){el.className='rcms-button';el.textContent=value(node,'label')||'Learn more';el.href=value(node,'url')||'#'}if(type==='image'){el.style.margin='0';el.style.textAlign='center';var image=document.createElement('img');image.src=value(node,'src')||value(node,'url')||'';image.alt=value(node,'alt')||'';image.style.width=value(node,'width')||'100%';image.style.height=value(node,'height')||'auto';image.style.objectFit=value(node,'objectFit')||'cover';image.style.objectPosition=value(node,'objectPosition')||'50% 50%';el.appendChild(image)}if(type==='spacer')el.style.height=(Number(value(node,'height'))||64)+'px';var styles=Object.assign({},node.styles&&node.styles.base,node.styles&&node.styles.desktop);Object.keys(styles).forEach(function(key){if(typeof styles[key]==='string'||typeof styles[key]==='number')el.style[key]=styles[key]});(node.children||[]).forEach(function(child){var item=render(child);if(item)el.appendChild(item)});return el}
function styleButton(item,node,grouped){var props=node.props||{};if(props.color){item.style.background=props.variant==='outline'||props.variant==='ghost'?'transparent':props.color;item.style.color=props.variant==='outline'||props.variant==='ghost'?props.color:'#fff';item.style.border='1px solid '+props.color}if(props.width)item.style.width=typeof props.width==='number'?props.width+'px':props.width;if(props.height)item.style.height=typeof props.height==='number'?props.height+'px':props.height;if(props.radius!==undefined)item.style.borderRadius=props.radius+'px';if(props.size==='lg'){item.style.minHeight='50px';item.style.padding='0 26px'}if(props.size==='sm'){item.style.minHeight='36px';item.style.padding='0 14px'}if(!grouped){item.style.marginLeft=(Number(props.offsetX)||0)+'px';item.style.marginTop=(Number(props.offsetY)||0)+'px'}}
function renderTree(tree){var content=document.getElementById('rcms-content');content.replaceChildren();var children=tree&&tree.children||[];for(var index=0;index<children.length;){if(children[index].type!=='button'){var node=children[index];var item=render(node);if(item){var shell=document.createElement('div');shell.className='rcms-node-shell';var inner=document.createElement('div');inner.className='rcms-node-inner';var design=node.props&&node.props.design||{};if(design.paddingY!==undefined)shell.style.paddingTop=shell.style.paddingBottom=Number(design.paddingY)+'px';if(design.maxWidth)inner.style.maxWidth=Number(design.maxWidth)+'px';if(design.layout==='full')inner.style.maxWidth='none';if(design.background)shell.style.background=design.background;inner.appendChild(item);shell.appendChild(inner);content.appendChild(shell)}index++;continue}var buttons=[];while(index<children.length&&children[index].type==='button')buttons.push(children[index++]);var row=buttons.length>1?document.createElement('div'):content;if(buttons.length>1)row.className='rcms-button-row';buttons.forEach(function(button){var item=render(button);if(item){styleButton(item,button,buttons.length>1);row.appendChild(item)}});if(row!==content)content.appendChild(row)}}
renderTree(data.tree);
if(data.websiteId&&data.pageKey){var key=String(data.pageKey).split('/').map(encodeURIComponent).join('/');var url='https://react-cms-pro-default-rtdb.firebaseio.com/content/'+encodeURIComponent(data.websiteId)+'/sync/published/pages/'+key+'.json';fetch(url,{cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('Published content unavailable');return response.json()}).then(function(page){if(page&&page.tree){renderTree(page.tree);if(page.title)document.title=page.title}}).catch(function(){})}
function showSitePart(frame,selector){frame.addEventListener('load',function(){var doc;try{doc=frame.contentDocument}catch(error){return}var attempts=0;var timer=setInterval(function(){var target=doc.querySelector(selector);if(!target){if(++attempts>=60)clearInterval(timer);return}clearInterval(timer);var current=target;while(current&&current!==doc.body){Array.from(current.parentElement.children).forEach(function(sibling){if(sibling!==current)sibling.style.setProperty('display','none','important')});current=current.parentElement}var handleSelector='[data-rcms-resize-handle],[title="Drag handle to resize text area width"],[title="Drag to resize button"]';function hideHandles(){target.querySelectorAll(handleSelector).forEach(function(handle){handle.style.setProperty('display','none','important')})}hideHandles();var clean=[target].concat(Array.from(target.querySelectorAll('*')));clean.forEach(function(item){item.removeAttribute('contenteditable');item.removeAttribute('draggable');Array.from(item.attributes).forEach(function(attribute){if(attribute.name.indexOf('data-rcms')===0||attribute.name.indexOf('data-reactcms')===0||attribute.name.slice(0,2)==='on')item.removeAttribute(attribute.name)});Array.from(item.classList).forEach(function(name){if(name.indexOf('rcms-')===0||name.indexOf('reactcms-')===0)item.classList.remove(name)});if(item.style){item.style.setProperty('outline','none','important');item.style.setProperty('cursor','inherit','important')}});var style=doc.createElement('style');style.textContent='html,body{margin:0!important;overflow:hidden!important} [data-rcms-region], [data-rcms-node], .rcms-editable-region{outline:none!important;box-shadow:none!important} '+handleSelector+'{display:none!important}';doc.head.appendChild(style);new frame.contentWindow.MutationObserver(hideHandles).observe(target,{childList:true,subtree:true});function measure(){frame.style.height=Math.max(1,Math.ceil(target.getBoundingClientRect().height))+'px'}measure();if(frame.contentWindow.ResizeObserver)new frame.contentWindow.ResizeObserver(measure).observe(target);doc.querySelectorAll('a[href]').forEach(function(link){if(target.contains(link))link.setAttribute('target','_top')})},150)})}
showSitePart(document.getElementById('rcms-header'),'header,[role="banner"],.site-header,#site-header');
showSitePart(document.getElementById('rcms-footer'),'footer,[role="contentinfo"],.site-footer,#site-footer');
})();</script></body></html>`;
}

export default {
  generateReactPageSource,
  patchReactStateRouter,
  reactPageSourcePath,
  reactPageComponentName,
  staticPageSourcePath,
  STATIC_PAGE_RUNTIME_VERSION,
  generateStaticPageSource
};
