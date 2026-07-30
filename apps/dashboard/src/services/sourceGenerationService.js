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

export default {
  generateReactPageSource,
  patchReactStateRouter,
  reactPageSourcePath,
  reactPageComponentName
};
