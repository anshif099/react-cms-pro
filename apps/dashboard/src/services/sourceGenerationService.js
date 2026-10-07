import { renderPublishedElement } from './publishedElements';
import { WEB_FONTS_URL } from '../utils/fontFamilies';
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
      return <h2 key={key} data-reactcms-id={key}>{block.linkUrl && !/^(javascript|data|vbscript):/i.test(block.linkUrl.trim()) ? <a href={block.linkUrl} target={block.newTab ? '_blank' : undefined} rel={block.newTab ? 'noopener noreferrer' : undefined} style={{ color: 'inherit', textDecoration: 'none' }}>{block.text || block.title}</a> : block.text || block.title}</h2>;
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
      return <img key={key} data-reactcms-id={key} src={block.src || block.url || ''} alt={block.alt || ''} style={{ display: 'block', width: block.width || '100%', maxWidth: '100%', height: block.height || 'auto', objectFit: block.objectFit || 'cover' }} />;
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
      <link rel="stylesheet" href=${JSON.stringify(WEB_FONTS_URL)} />
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

export const STATIC_PAGE_RUNTIME_VERSION = 23;

export function generateStaticPageSource({ title, slug, tree, locale = "en", websiteId = "", pageKey = "", theme = null }) {
  const payload = JSON.stringify({ tree, locale, websiteId, pageKey, theme, runtimeVersion: STATIC_PAGE_RUNTIME_VERSION }).replace(/</g, "\\u003c");
  const escapedTitle = String(title || "Untitled Page")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  return `<!doctype html>
<html lang="${String(locale).replace(/[^a-zA-Z-]/g, "") || "en"}">
<head><meta charset="utf-8"><base href="/"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapedTitle}</title>
<style>body{margin:0;font-family:Inter,Arial,sans-serif;color:#0f172a}.rcms-site-shell{display:block;width:100%;height:0;border:0;overflow:hidden}#rcms-content{min-height:40vh}#rcms-content img{max-width:100%}#rcms-content .rcms-node-shell{box-sizing:border-box;padding:36px 24px}#rcms-content .rcms-node-inner{width:100%;max-width:1120px;margin:0 auto}#rcms-content .rcms-container{max-width:1200px;margin:auto}#rcms-content .rcms-button-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;padding:24px;max-width:100%;box-sizing:border-box}#rcms-content .rcms-button{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:42px;padding:0 20px;border-radius:10px;background:#2563eb;color:white;text-decoration:none;font-weight:700;white-space:nowrap;max-width:100%}html,body,body *{cursor:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Cpath%20d%3D%22M3%202%20L3%2025%20L9%2019%20L14%2029%20L19%2026%20L14%2017%20L24%2017%20Z%22%20fill%3D%22%23111827%22%20stroke%3D%22white%22%20stroke-width%3D%221.5%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") 3 2, default!important} body a[href],body a[href] *,body button,body button *{cursor:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Cpath%20d%3D%22M11%2016%20V4%20C11%201%2016%201%2016%204%20V12%20C16%209%2020%209%2020%2012%20V13%20C20%2010%2024%2011%2024%2014%20V15%20C24%2012%2028%2013%2028%2016%20V23%20C28%2027%2025%2030%2021%2030%20H15%20C12%2030%2010%2028%208%2025%20L3%2018%20C1%2015%205%2012%207%2015%20L11%2019%20Z%22%20fill%3D%22%23111827%22%20stroke%3D%22white%22%20stroke-width%3D%221.5%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") 13 3, pointer!important}</style></head>
<body><iframe id="rcms-header" class="rcms-site-shell" src="/?rcms_preview=1" title="Site header"></iframe><div id="rcms-content" role="main"></div><iframe id="rcms-footer" class="rcms-site-shell" src="/?rcms_preview=1" title="Site footer"></iframe>
<script id="rcms-page-data" type="application/json">${payload}</script>
<script>(function(){
var data=JSON.parse(document.getElementById('rcms-page-data').textContent);
var fonts=document.createElement('link');fonts.rel='stylesheet';fonts.href=${JSON.stringify(WEB_FONTS_URL)};fonts.setAttribute('data-rcms-fonts','true');document.head.appendChild(fonts);
var locale=data.locale||'en';
var activeTree=data.tree;
function applyTheme(theme){theme=theme||{};var colors=theme.colors||{};var typography=theme.typography||{};var content=document.getElementById('rcms-content');content.style.setProperty('--rcms-color-text',colors.text||'#0f172a');content.style.setProperty('--rcms-color-primary',colors.primary||'#2563eb');content.style.color=colors.text||'#0f172a';content.style.fontFamily=typography.bodyFont||'Inter, system-ui, sans-serif';content.style.fontSize=typography.baseSize||'16px'}
applyTheme(data.theme);
document.getElementById('rcms-content').addEventListener('click',function(event){
var link=event.target.closest&&event.target.closest('a[href]');if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
var url;try{url=new URL(link.href)}catch(error){return}if(url.origin!==location.origin||url.pathname!==location.pathname||!url.hash)return;
var fragment=url.hash.slice(1);try{fragment=decodeURIComponent(fragment)}catch(error){}
function normalized(text){return String(text||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
var content=document.getElementById('rcms-content');var target=document.getElementById(fragment);
if(!target)target=Array.from(content.querySelectorAll('h1,h2,h3,h4,h5,h6')).find(function(heading){return normalized(heading.textContent)===normalized(fragment)});
if(target&&content.contains(target)){event.preventDefault();target.style.scrollMarginTop='110px';target.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'',location.pathname+location.search+url.hash)}
});
function responsiveMode(){var width=window.innerWidth;return width<768?'mobile':width<1024?'tablet':width<1280?'laptop':'desktop'}
function responsiveStyles(node){var styles=node.styles||{};return Object.assign({},styles.base,styles.desktop,styles[responsiveMode()])}
function value(node,key){var props=node.props||{};var localized=props.locales&&(props.locales[locale]||props.locales.en);return localized&&localized[key]!==undefined?localized[key]:props[key]}
function richText(target,html){var parsed=new DOMParser().parseFromString(String(html||''),'text/html');parsed.querySelectorAll('script,style,iframe,object,embed,form,[data-rcms-empty-additions],[data-rcms-toolbar],[data-rcms-resize-handle]').forEach(function(item){item.remove()});parsed.querySelectorAll('*').forEach(function(item){Array.from(item.attributes).forEach(function(attribute){if(/^on/i.test(attribute.name)||/^(href|src)$/i.test(attribute.name)&&/^javascript:/i.test(attribute.value))item.removeAttribute(attribute.name)})});Array.from(parsed.body.childNodes).forEach(function(item){target.appendChild(document.importNode(item,true))})}
var renderExtended=${renderPublishedElement.toString()};
function render(node){if(!node||node.hidden)return null;var type=node.type;var tags={section:'section',container:'div',columns:'div',column:'div',heading:/^h[1-6]$/.test(value(node,'level'))?value(node,'level'):'h2',paragraph:'div',text:'div',button:'a',image:'figure',spacer:'div',divider:'hr',list:'ul'};var el=renderExtended(node,value,richText,responsiveStyles(node))||document.createElement(tags[type]||'div');el.id=node.props&&node.props.anchorId||node.id;el.style.scrollMarginTop='110px';if(type==='section')el.className='rcms-section';if(type==='container')el.className='rcms-container';if(type==='heading'){el.textContent=value(node,'text')||value(node,'title')||'';var headingUrl=String(value(node,'linkUrl')||'').trim();if(headingUrl&&!/^(javascript|data|vbscript):/i.test(headingUrl)){var headingLink=document.createElement('a');headingLink.textContent=el.textContent;headingLink.href=headingUrl;headingLink.style.color='inherit';headingLink.style.textDecoration='none';if(value(node,'newTab')){headingLink.target='_blank';headingLink.rel='noopener noreferrer'}el.textContent='';el.appendChild(headingLink)}el.style.margin='0';el.style.textAlign=value(node,'alignment')||'left';if(value(node,'color'))el.style.color=value(node,'color');el.style.fontSize=el.tagName==='H1'?'52px':el.tagName==='H2'?'38px':''}if(type==='paragraph'||type==='text'){richText(el,value(node,'text'));el.style.lineHeight='1.8';el.style.color='#475569'}if(type==='button'){el.className='rcms-button';el.textContent=value(node,'label')||'Learn more';el.href=value(node,'linkType')==='section'?'#'+String(value(node,'url')||'').replace(/^#/,''):value(node,'url')||'#';if(el.getAttribute('href').charAt(0)==='#')el.href=window.location.pathname+window.location.search+el.getAttribute('href')}if(type==='image'){el.style.margin='0';el.style.textAlign='center';var image=document.createElement('img');image.src=value(node,'src')||value(node,'url')||'';image.alt=value(node,'alt')||'';image.style.display='block';image.style.margin='0 auto';image.style.width=value(node,'width')||'100%';image.style.height=value(node,'height')||'auto';image.style.objectFit=value(node,'objectFit')||'cover';image.style.objectPosition=value(node,'objectPosition')||'50% 50%';el.appendChild(image)}if(type==='faq'||type==='accordion'){var title=document.createElement('h2');title.textContent=value(node,'title')||'Frequently asked questions';title.style.margin='0 0 24px';title.style.fontSize='36px';title.style.fontWeight='700';el.appendChild(title);var list=document.createElement('div');list.style.display='grid';list.style.gap='10px';var items=value(node,'items')||[];items.forEach(function(item,index){var details=document.createElement('details');details.style.padding='16px 18px';details.style.border='1px solid #e2e8f0';details.style.borderRadius='12px';details.style.background='#fff';var summary=document.createElement('summary');summary.textContent=item.question||item.title||'Item '+(index+1);summary.style.cursor='pointer';summary.style.fontWeight='700';summary.style.color='#0f172a';var answer=document.createElement('p');answer.textContent=item.answer||item.content||'';answer.style.color='#64748b';answer.style.lineHeight='1.7';details.appendChild(summary);details.appendChild(answer);list.appendChild(details)});el.appendChild(list)}if(type==='spacer')el.style.height=(Number(value(node,'height'))||64)+'px';var styles=responsiveStyles(node);Object.keys(styles).forEach(function(key){if(typeof styles[key]==='string'||typeof styles[key]==='number')el.style[key]=typeof styles[key]==='number'&&styles[key]!==0&&!/^(opacity|zIndex|fontWeight|lineHeight|flex|flexGrow|flexShrink|order|gridRow|gridColumn)$/.test(key)?styles[key]+'px':styles[key]});(node.children||[]).forEach(function(child){var item=render(child);if(item)el.appendChild(item)});return el}
function styleButton(item,node,grouped){var props=node.props||{};if(props.color){item.style.background=props.variant==='outline'||props.variant==='ghost'?'transparent':props.color;item.style.color=props.variant==='outline'||props.variant==='ghost'?props.color:'#fff';item.style.border='1px solid '+props.color}if(props.width)item.style.width=typeof props.width==='number'?props.width+'px':props.width;if(props.height)item.style.height=typeof props.height==='number'?props.height+'px':props.height;if(props.radius!==undefined)item.style.borderRadius=props.radius+'px';if(props.size==='lg'){item.style.minHeight='50px';item.style.padding='0 26px'}if(props.size==='sm'){item.style.minHeight='36px';item.style.padding='0 14px'}if(!grouped){item.style.display='flex';item.style.width=props.width?item.style.width:'fit-content';item.style.marginTop=(Number(props.offsetY)||0)+'px';if(typeof props.horizontalPosition==='number'&&Number.isFinite(props.horizontalPosition)){var position=Math.max(0,Math.min(1,props.horizontalPosition));item.style.position='relative';item.style.left=(position*100)+'%';item.style.translate=(-position*100)+'% 0';item.style.marginLeft='0';item.style.marginRight='0'}else{var alignment=props.alignment||'center';item.style.marginLeft=alignment==='left'?(Number(props.offsetX)||0)+'px':'auto';item.style.marginRight=alignment==='right'?'0':'auto'}}}
function renderTree(tree){var content=document.getElementById('rcms-content');var pageStyles=responsiveStyles(tree||{});var pageBackground=pageStyles.background||pageStyles.backgroundColor||(data.theme&&data.theme.colors&&data.theme.colors.background)||'';content.style.background=pageBackground;content.style.backgroundImage=pageStyles.backgroundImage||'';content.style.display='flow-root';document.body.style.background=pageBackground;document.documentElement.style.background=pageBackground;content.replaceChildren();var children=tree&&tree.children||[];for(var index=0;index<children.length;){if(children[index].type!=='button'){var node=children[index];var item=render(node);if(item){var shell=document.createElement('div');shell.className='rcms-node-shell';var inner=document.createElement('div');inner.className='rcms-node-inner';var design=node.props&&node.props.design||{};if(design.paddingY!==undefined)shell.style.paddingTop=shell.style.paddingBottom=Number(design.paddingY)+'px';if(design.maxWidth)inner.style.maxWidth=Number(design.maxWidth)+'px';if(design.layout==='full')inner.style.maxWidth='none';if(design.background)shell.style.background=design.background;if(node.type==='image'&&(String(value(node,'width')||'').trim()||'100%')==='100%'){shell.style.paddingLeft=shell.style.paddingRight='0';inner.style.maxWidth='none'}inner.appendChild(item);shell.appendChild(inner);content.appendChild(shell)}index++;continue}var buttons=[];while(index<children.length&&children[index].type==='button')buttons.push(children[index++]);var row=buttons.length>1?document.createElement('div'):content;if(buttons.length>1)row.className='rcms-button-row';buttons.forEach(function(button){var item=render(button);if(item){styleButton(item,button,buttons.length>1);row.appendChild(item)}});if(row!==content)content.appendChild(row)}}
renderTree(activeTree);
var currentMode=responsiveMode();
window.addEventListener('resize',function(){var nextMode=responsiveMode();if(nextMode!==currentMode){currentMode=nextMode;renderTree(activeTree)}});
if(data.websiteId&&data.pageKey){var key=String(data.pageKey).split('/').map(encodeURIComponent).join('/');var url='https://react-cms-pro-default-rtdb.firebaseio.com/content/'+encodeURIComponent(data.websiteId)+'/sync/published/pages/'+key+'.json';fetch(url,{cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('Published content unavailable');return response.json()}).then(function(page){if(page&&page.tree){activeTree=page.tree;renderTree(activeTree);if(page.title)document.title=page.title}}).catch(function(){})}
function resolvePublishedShellLinks(target,routes){
var entries=Object.values(routes||{}).filter(function(route){return route&&route.published!==false&&route.path});
function normalized(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
target.querySelectorAll('a[href]').forEach(function(link){
var url;try{url=new URL(link.getAttribute('href'),target.ownerDocument.baseURI)}catch(error){return}
if(url.origin!==target.ownerDocument.location.origin)return;
var path=url.pathname.split('/').filter(Boolean).join('/');
if(entries.some(function(route){return String(route.path).split('/').filter(Boolean).join('/')===path}))return;
var label=normalized(link.textContent||link.getAttribute('aria-label'));
if(!label)return;
var matches=entries.filter(function(route){return normalized(route.title)===label});
if(matches.length!==1)return;
url.pathname=matches[0].path;link.href=url.href;
});
}
var shellRoutesPromise=null;
function updatePublishedShellLinks(target){
if(!data.websiteId)return;
if(!shellRoutesPromise)shellRoutesPromise=fetch('https://react-cms-pro-default-rtdb.firebaseio.com/registry/'+encodeURIComponent(data.websiteId)+'/routes.json',{cache:'no-store'}).then(function(response){return response.ok?response.json():null}).catch(function(){return null});
shellRoutesPromise.then(function(routes){if(routes)resolvePublishedShellLinks(target,routes)});
}
function activatePublishedShellLink(event,target){
var link=event.target.closest&&event.target.closest('a[href]');
if(!link||!target.contains(link)||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target==='_blank')return;
if(!shellRoutesPromise)return;
event.preventDefault();
shellRoutesPromise.then(function(routes){
if(routes)resolvePublishedShellLinks(target,routes);
target.ownerDocument.defaultView.top.location.assign(link.href);
});
}
function lockPublishedSitePart(target){
// Attribute removal cannot detach React's delegated event handlers.
function stopEditorEvent(event){if(event.type==='click')activatePublishedShellLink(event,target);var control=event.target.closest&&event.target.closest('button,input,select,textarea,summary,[role="button"],[role="menuitem"]');if(control&&target.contains(control)&&!event.defaultPrevented)return;event.stopImmediatePropagation()}
['mousedown','mouseup','mousemove','pointerdown','pointerup','pointermove','touchstart','touchmove','touchend','click','dblclick','keydown','keyup','dragstart'].forEach(function(type){target.addEventListener(type,stopEditorEvent,true)});
var legacyToolbar='span:has(> button[title="Align Left"])';
var style=target.ownerDocument.createElement('style');style.textContent=legacyToolbar+'{display:none!important} html,body,body *{cursor:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Cpath%20d%3D%22M3%202%20L3%2025%20L9%2019%20L14%2029%20L19%2026%20L14%2017%20L24%2017%20Z%22%20fill%3D%22%23111827%22%20stroke%3D%22white%22%20stroke-width%3D%221.5%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") 3 2, default!important} body a[href],body a[href] *,body button,body button *{cursor:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Cpath%20d%3D%22M11%2016%20V4%20C11%201%2016%201%2016%204%20V12%20C16%209%2020%209%2020%2012%20V13%20C20%2010%2024%2011%2024%2014%20V15%20C24%2012%2028%2013%2028%2016%20V23%20C28%2027%2025%2030%2021%2030%20H15%20C12%2030%2010%2028%208%2025%20L3%2018%20C1%2015%205%2012%207%2015%20L11%2019%20Z%22%20fill%3D%22%23111827%22%20stroke%3D%22white%22%20stroke-width%3D%221.5%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") 13 3, pointer!important}';target.ownerDocument.head.appendChild(style);
}
function showSitePart(frame,selector){var attempts=0;var timer=setInterval(function(){var doc;try{doc=frame.contentDocument}catch(error){return}if(!doc)return;var target=doc.querySelector(selector);if(!target){if(++attempts>=60)clearInterval(timer);return}clearInterval(timer);updatePublishedShellLinks(target);lockPublishedSitePart(target);var current=target;while(current&&current!==doc.body){Array.from(current.parentElement.children).forEach(function(sibling){if(sibling!==current)sibling.style.setProperty('display','none','important')});current=current.parentElement}var handleSelector='[data-rcms-empty-additions],[data-rcms-toolbar],[data-rcms-resize-handle],[title="Drag handle to resize text area width"],[title="Drag to resize button"]';function hideHandles(){target.querySelectorAll(handleSelector).forEach(function(handle){handle.style.setProperty('display','none','important')})}hideHandles();var clean=[target].concat(Array.from(target.querySelectorAll('*')));clean.forEach(function(item){item.removeAttribute('contenteditable');item.removeAttribute('draggable');Array.from(item.attributes).forEach(function(attribute){if(attribute.name.indexOf('data-rcms')===0||attribute.name.indexOf('data-reactcms')===0||attribute.name.slice(0,2)==='on')item.removeAttribute(attribute.name)});Array.from(item.classList).forEach(function(name){if(name.indexOf('rcms-')===0||name.indexOf('reactcms-')===0)item.classList.remove(name)});if(item.style){item.style.setProperty('outline','none','important');item.style.removeProperty('cursor')}});var style=doc.createElement('style');style.textContent='html,body{margin:0!important;overflow:hidden!important} [data-rcms-region], [data-rcms-node], .rcms-editable-region{outline:none!important;box-shadow:none!important} '+handleSelector+'{display:none!important}';doc.head.appendChild(style);new frame.contentWindow.MutationObserver(hideHandles).observe(target,{childList:true,subtree:true});function measure(){var bounds=target.getBoundingClientRect();var bottom=bounds.bottom;target.querySelectorAll('*').forEach(function(item){var rect=item.getBoundingClientRect();var css=frame.contentWindow.getComputedStyle(item);if(css.visibility==='hidden'||css.display==='none')return;if(css.position==='fixed'&&rect.width)bottom=Math.max(bottom,window.innerHeight);if(rect.width&&rect.height)bottom=Math.max(bottom,rect.bottom)});frame.style.height=Math.max(1,Math.ceil(bottom-Math.min(0,bounds.top)))+'px'}target.addEventListener('transitionend',measure);window.addEventListener('resize',measure);new frame.contentWindow.MutationObserver(measure).observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-expanded']});measure();if(frame.contentWindow.ResizeObserver)new frame.contentWindow.ResizeObserver(measure).observe(target);doc.querySelectorAll('a[href]').forEach(function(link){if(target.contains(link))link.setAttribute('target','_top')})},50)}
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
