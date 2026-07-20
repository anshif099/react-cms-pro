# ARCHITECTURE.md
## ReactCMS Platform — Architectural Specification

> **STATUS: FROZEN**
>
> This document is the single source of truth for the ReactCMS Platform architecture.
> It was written before the first line of code and must be treated as a contract.
>
> **Do not redesign the architecture during implementation.**
> Fix bugs and ambiguities only. Every new feature request must be evaluated
> against this specification before any code changes are made.

---

## Change Control

| Action | Rule |
|---|---|
| Bug or ambiguity fix | Fix directly. Note the fix with a comment in the relevant section. |
| New feature request | Open a written proposal. Evaluate against this spec. Only update this document after deliberate review — never mid-implementation. |
| Architecture drift | If code stops matching this document, fix the code — not this document. |
| Breaking change | Requires a new version of this document (v5). Never mutate a locked version in place. |

**Architecture drift** is when code slowly stops matching the original design through accumulated small decisions. This document exists to prevent that. When in doubt about where something belongs, consult this document first.

---

## Document History

| Version | Date | Summary |
|---|---|---|
| v1 | 2026-07-20 | Initial plan: mono-repo, SDK, Runtime, CLI |
| v2 | 2026-07-20 | Added: shared package, design system, runtime-first sync, versioned events |
| v3 | 2026-07-20 | Added: explicit registration, content models package, clean theme/DS separation, Project Registry |
| v4 | 2026-07-20 | **FROZEN**: Registry = metadata only; Plugin API placeholder; 4-milestone schedule |

---

## Overview

Transform **ReactCMS Pro** into a complete Website Builder and Visual CMS platform composed of **six independent packages** inside a mono-repo, wired to the existing Firebase Realtime Database backend and dashboard.

---

## All Locked Decisions

| Decision | Choice |
|---|---|
| Repository structure | ✅ Mono-repo (`reactcms-platform/`) with Turborepo |
| npm publishing | ✅ Public npm, scoped `@anshif.rainhopes/` packages |
| CLI distribution | ✅ `npx reactcms-cli` only — no global install |
| React Router support | ✅ v6 + v7 (`>=6 <8`) |
| Shared package | ✅ `packages/shared/` — types, events, constants, validators |
| Runtime registration | ✅ Explicit declarations only — no DOM inference |
| Sync architecture | ✅ Runtime-first; manifest = diagnostics fallback only |
| Messaging protocol | ✅ Versioned events (`rcms/v1/*`) |
| Registry scope | ✅ **Metadata and discovery only** — not a content store |
| Content store | ✅ Remains in `content/`, `pages/`, `entries/` paths |
| Content Model System | ✅ `packages/reactcms-content-models/` |
| Design System | ✅ `packages/reactcms-design-system/` — separate from SDK |
| Theme | ✅ Tokens only — evolves independently of Design System |
| Version compatibility | ✅ Dashboard warns on SDK/Runtime version mismatch |
| Plugin API | ✅ Designed for in v1; built in v2 (`packages/reactcms-plugin-api/`) |
| Development model | ✅ Four milestones — never implement all at once |

---

## What Already Exists (Preserved Unchanged)

The ReactCMS Pro dashboard already has the following. They are only modified where explicitly noted in this document:

- `websiteService` — CRUD, API/secret key management
- `websiteSyncService` — manifest fetch + route import + CSV import
- `pageService` — CRUD, publish/unpublish, revision, search index, `subscribeToPage`
- `contentSyncService` — draft/published Firebase sync paths
- `visualEditService` — `postMessage` bridge (`RCMS_ENTER_EDIT_MODE`, `RCMS_FIELD_UPDATE`, `RCMS_EXIT_EDIT_MODE`)
- `themeService` — reads/writes `content/{websiteId}/theme`
- `seoService` — sitemap, SEO analyzer, redirects, robots.txt
- `sdkService` — install snippet, connection test, plugin/theme readers
- `pageConversionService` — template-to-blocks converter
- `LivePreviewPage` — iframe-based preview with postMessage
- Firebase Realtime Database — all existing paths under `websites/`, `pages/`, `content/`

---

## Mono-repo Structure

```
reactcms-platform/
├── apps/
│   ├── dashboard/                        ← existing ReactCMS Pro (moved here)
│   └── docs/                             ← documentation site (Milestone 4)
├── packages/
│   ├── shared/                           ← types, events, constants, validators
│   ├── reactcms-sdk/                     ← core primitives (Milestone 1)
│   ├── reactcms-runtime/                 ← explicit registration (Milestone 1)
│   ├── reactcms-content-models/          ← content model system (Milestone 3)
│   ├── reactcms-design-system/           ← section components (Milestone 3)
│   ├── reactcms-cli/                     ← CLI tool (Milestone 4)
│   └── reactcms-plugin-api/              ← FUTURE v2 (placeholder directory only)
├── package.json                          ← npm workspaces root
├── turbo.json                            ← Turborepo pipeline
└── tsconfig.base.json                    ← base TypeScript config
```

**Tooling:** npm workspaces · Turborepo · TypeScript strict · Vitest · tsup

---

## The Most Important Rule — Registry vs. Content

> **The registry is not a content store.**
>
> This is the most critical architectural boundary in the platform.
> Violating it creates duplication, sync conflicts, and makes the system
> impossible to reason about. When adding anything new, ask:
> *"Does this answer 'what exists?' or 'what does it say?'"*

### The Boundary

| Question | Layer | Firebase Path |
|---|---|---|
| What routes exist? | Registry | `registry/{id}/routes/` |
| What does this page say? | Content | `pages/{id}/{pageId}/` |
| What content models are defined? | Registry | `registry/{id}/contentModels/` |
| What is the content of this blog post? | Entries | `content/{id}/entries/{model}/{entryId}/` |
| What navigation menus exist? | Registry | `registry/{id}/navigation/` |
| What are the nav link values? | Registry | `registry/{id}/navigation/{navId}/items[]` |
| What editable regions exist on a page? | Registry | `registry/{id}/editableRegions/{pageId}/` |
| What is the current value of a region? | Content | `content/{id}/sync/draft/pages/{pageId}/` |
| What theme tokens are configured? | Registry | `registry/{id}/theme/` |
| What are the resolved theme values? | Content | `content/{id}/theme/` |
| What plugins are active? | Registry | `registry/{id}/plugins/` |
| What is the plugin configuration? | Content | `content/{id}/plugins/{pluginId}/` |
| Is the Runtime online? | Registry | `registry/{id}/runtime/` |

### Data Flow

```
Connected Website (Runtime)
         │
         │  Explicit declarations
         │  (CMSLayout, CMSNavigation, routes config)
         ▼
   registry/{websiteId}/          ← METADATA LAYER
   ├── runtime/                      status, heartbeat, versions
   ├── routes/                       {id, path, title, layout, contentModel, source}
   ├── layouts/                      {id, label, slots, isDefault}
   ├── navigation/                   {id, label, items[]}
   ├── theme/                        ThemeTokens (design tokens only)
   ├── contentModels/                {id, label, fields[], seoDefaults, slugRule}
   ├── components/                   {id, type, pageId, registeredAt}
   ├── editableRegions/{pageId}/     {id, type, label}  ← schema ONLY, NOT values
   └── plugins/                      {id, enabled, version}  ← NO config here

   content/{websiteId}/            ← CONTENT LAYER (existing + extended)
   ├── theme/                        resolved ThemeTokens (written by themeService)
   ├── seo/                          robots.txt, redirects, sitemap
   ├── sync/draft/pages/{pageId}/    editable region VALUES
   ├── sync/published/pages/{pageId}/ published region values
   ├── entries/{modelId}/{entryId}/  content model entry data
   └── plugins/{pluginId}/           plugin configuration

   pages/{websiteId}/{pageId}/     ← PAGE CONTENT LAYER (existing, unchanged)
   ├── title, slug, status
   ├── locales/{locale}/blocks[]
   ├── seo/
   └── routeId, source, isImported

   websites/{websiteId}/           ← WEBSITE METADATA (existing, unchanged)
   ├── apiKey, secretKeyHash
   ├── verificationStatus, sdkInstalled
   └── connectionHealth
```

### Registry Schema (metadata only — full reference)

```
registry/{websiteId}/
├── runtime/
│   ├── status                    "online" | "offline" | "degraded"
│   ├── heartbeat                 ISO timestamp
│   ├── sdkVersion
│   ├── runtimeVersion
│   └── compatibility             "ok" | "warn" | "breaking"
│
├── routes/
│   └── {routeId}/
│       ├── path                  "/about"
│       ├── title                 "About"
│       ├── layout                layout id reference
│       ├── contentModel          model id reference (optional)
│       ├── source                "registered" | "cms-generated"
│       └── published             boolean flag only
│
├── layouts/
│   └── {layoutId}/
│       ├── id, label, slots[], isDefault
│       └── registeredAt
│
├── navigation/
│   └── {navId}/
│       ├── id, label
│       └── items[]               nav items are metadata (structure, not body content)
│
├── theme/
│   └── ...ThemeTokens            design tokens — these ARE metadata, not page content
│
├── contentModels/
│   └── {modelId}/
│       ├── id, label, icon
│       ├── fields[]              FieldDefinition schema only
│       ├── seoDefaults           template strings, not values
│       ├── slugRule
│       └── defaultTemplate
│
├── components/
│   └── {componentId}/
│       ├── id, type, pageId
│       └── registeredAt          presence only — no state
│
├── editableRegions/
│   └── {pageId}/
│       └── {regionId}/
│           ├── type              "text" | "image" | "richtext"
│           ├── label             display name
│           └── registeredAt     NO currentValue — values live in content/
│
└── plugins/
    └── {pluginId}/
        ├── id, enabled
        └── version               NO config — config lives in content/
```

---

## Versioned Messaging Protocol

All postMessage events between Dashboard and Runtime use versioned namespaced types.
**No raw `RCMS_*` strings anywhere in the codebase.**

| Event Type | Direction | Payload |
|---|---|---|
| `rcms/v1/enter-edit-mode` | Dashboard → Runtime | `{}` |
| `rcms/v1/exit-edit-mode` | Dashboard → Runtime | `{}` |
| `rcms/v1/field-update` | Dashboard → Runtime | `{ regionId, fieldKey, value }` |
| `rcms/v1/region-selected` | Runtime → Dashboard | `{ regionId, type, pageId }` |
| `rcms/v1/open-inspector` | Dashboard → Runtime | `{ regionId }` |
| `rcms/v1/theme-update` | Dashboard → Runtime | `ThemeTokens` |
| `rcms/v1/navigation-update` | Dashboard → Runtime | `NavMenu[]` |
| `rcms/v1/publish-page` | Dashboard → Runtime | `{ slug }` |
| `rcms/v1/heartbeat` | Runtime → Dashboard | `{ timestamp, status }` |

**Message envelope — every message must conform to this shape:**
```ts
interface RCMSMessage {
  rcms: true;
  version: "v1";
  type: string;
  websiteId: string;
  payload: unknown;
  timestamp: number;
}
```

---

## Package Specifications

### `packages/shared`

Internal only — not published to npm. All other packages depend on this.

```
src/
├── types/
│   ├── website.ts, page.ts, route.ts, navigation.ts
│   ├── layout.ts, theme.ts, editable.ts
│   ├── contentModel.ts, registry.ts, plugin.ts, version.ts
├── events/
│   ├── index.ts              RCMSMessage envelope type
│   ├── editEvents.ts, themeEvents.ts, navigationEvents.ts, lifecycleEvents.ts
├── constants/
│   ├── eventTypes.ts         EVENT_TYPES["field-update"] → "rcms/v1/field-update"
│   ├── firebasePaths.ts      type-safe path builder constants
│   └── versions.ts           CURRENT_SDK_VERSION, etc.
├── firebase/
│   ├── models.ts
│   └── pathBuilders.ts       canonical path builders — used by every package
└── validators/
    ├── routeValidator.ts, themeValidator.ts
    ├── contentModelValidator.ts, registryValidator.ts
```

**Canonical path builders — no package may hardcode Firebase strings:**

```ts
export const paths = {
  // Registry (metadata)
  registry:           (id: string) => `registry/${id}`,
  registryRuntime:    (id: string) => `registry/${id}/runtime`,
  registryRoutes:     (id: string) => `registry/${id}/routes`,
  registryLayouts:    (id: string) => `registry/${id}/layouts`,
  registryNav:        (id: string) => `registry/${id}/navigation`,
  registryTheme:      (id: string) => `registry/${id}/theme`,
  registryModels:     (id: string) => `registry/${id}/contentModels`,
  registryComponents: (id: string) => `registry/${id}/components`,
  registryRegions:    (id: string, pageId: string) => `registry/${id}/editableRegions/${pageId}`,
  registryPlugins:    (id: string) => `registry/${id}/plugins`,

  // Content (data — existing + extended)
  contentTheme:       (id: string) => `content/${id}/theme`,
  contentSEO:         (id: string) => `content/${id}/seo`,
  contentDraft:       (id: string, pageId: string) => `content/${id}/sync/draft/pages/${pageId}`,
  contentPublished:   (id: string, pageId: string) => `content/${id}/sync/published/pages/${pageId}`,
  contentEntry:       (id: string, model: string, entryId: string) =>
                        `content/${id}/entries/${model}/${entryId}`,
  contentPlugin:      (id: string, pluginId: string) => `content/${id}/plugins/${pluginId}`,

  // Pages (existing)
  pages: (id: string) => `pages/${id}`,
  page:  (id: string, pageId: string) => `pages/${id}/${pageId}`,
};
```

**`ThemeTokens` — canonical type definition:**
```ts
export interface ThemeTokens {
  branding:       { siteName: string; logo: string; tagline: string; };
  colors:         { primary: string; secondary: string; accent: string;
                    background: string; text: string; darkBackground: string; darkText: string; };
  typography:     { headingFont: string; bodyFont: string; baseSize: string;
                    lineHeight: string; letterSpacing: string; };
  spacing:        { xs: string; sm: string; md: string; lg: string; xl: string; xxl: string; };
  borderRadius:   { sm: string; md: string; lg: string; full: string; };
  containerWidth: { sm: string; md: string; lg: string; xl: string; full: string; };
  breakpoints:    { sm: string; md: string; lg: string; xl: string; };
  buttons:        { borderRadius: string; fontWeight: string; paddingX: string; paddingY: string; };
  darkMode:       { enabled: boolean; strategy: "class" | "media"; };
}
```

**`ContentModel` — canonical type definition:**
```ts
export type FieldType =
  | "text" | "textarea" | "richtext" | "number" | "boolean"
  | "date" | "datetime" | "image" | "video" | "file"
  | "url" | "email" | "select" | "multiselect" | "relation"
  | "repeater" | "slug" | "color" | "json";

export interface FieldDefinition {
  id: string; label: string; type: FieldType;
  required?: boolean; defaultValue?: unknown;
  validation?: { min?: number; max?: number; pattern?: string; options?: string[]; };
  hint?: string;
}

export interface ContentModel {
  id: string; label: string; icon?: string;
  fields: FieldDefinition[];
  seoDefaults?: { metaTitleTemplate: string; metaDescriptionField: string; ogImageField?: string; };
  slugRule: "title" | "date-title" | "id" | "custom";
  defaultTemplate?: string;
}
```

---

### `@anshif.rainhopes/reactcms-sdk`

Core primitive components and hooks. Lightweight — no opinions about page structure.

**Peer dependencies:** `react >=18`, `react-router-dom >=6 <8`

```
src/
├── providers/
│   ├── CMSProvider.tsx          root: websiteId, apiKey, environment
│   ├── CMSThemeProvider.tsx     ThemeTokens → CSS custom properties on :root
│   └── CMSSEOProvider.tsx       <head> meta per route (v6/v7 compat)
├── context/
│   ├── CMSContext.tsx           editMode, isConnected, websiteId
│   ├── PageContext.tsx          currentPage, locale, contentModel
│   ├── ThemeContext.tsx         ThemeTokens (reactive from registry/{id}/theme)
│   ├── NavigationContext.tsx    NavMenu[] (reactive from registry/{id}/navigation)
│   └── SEOContext.tsx
├── hooks/
│   ├── useCMS.ts, usePage.ts, useTheme.ts, useSEO.ts
│   ├── useNavigation.ts, useEditable.ts, useLivePreview.ts, usePlugins.ts
├── components/
│   ├── EditableText.tsx         primitive: text region
│   ├── EditableImage.tsx        primitive: image region
│   ├── EditableButton.tsx       primitive: button region
│   ├── EditableSection.tsx      primitive: selectable section wrapper
│   ├── EditableRichText.tsx     primitive: rich text region
│   ├── EditableRepeater.tsx     primitive: array of items
│   └── EditableVideo.tsx        primitive: video region
├── messaging/
│   ├── MessageBus.ts            validates RCMSMessage envelope
│   ├── postMessageBridge.ts
│   └── firebaseBridge.ts
├── firebase/
│   ├── firebaseClient.ts        init from CMSProvider props
│   ├── themeSync.ts             registry/{id}/theme → ThemeContext
│   ├── navigationSync.ts        registry/{id}/navigation → NavigationContext
│   └── editableSync.ts          registry/{id}/editableRegions (schema only)
└── utils/
    ├── cssVars.ts               ThemeTokens → CSS custom property map
    ├── seoInjector.ts
    └── version.ts
```

**Invariants:**
- `EditableXxx` components render plain semantic HTML in production
- In edit mode they render a blue highlight overlay + click handler
- `useEditable(regionId, defaultValue)` → `[value, setValue]`
  - `setValue` fires `rcms/v1/field-update` AND writes to `content/{id}/sync/draft/...` — **never to the registry**
- `CMSThemeProvider` converts `ThemeTokens` → CSS vars (`--rcms-color-primary`, `--rcms-font-heading`, etc.)
- `usePlugins()` → `{ plugins, invoke(id, method, args) }` — the **only** plugin interaction surface

---

### `@anshif.rainhopes/reactcms-runtime`

Explicit registration bridge. **Nothing is inferred from the DOM.**

**Peer dependencies:** `react >=18`, `react-router-dom >=6 <8`, `@anshif.rainhopes/reactcms-sdk ^1.0.0`

**Canonical usage pattern:**
```tsx
// Connected website — App.tsx
<RuntimeProvider routes={routesConfig} websiteId="..." apiKey="...">

  {/* Explicit layout declarations — render nothing, register on mount */}
  <CMSLayout id="default" label="Default Layout" component={DefaultLayout} isDefault />
  <CMSLayout id="landing" label="Landing Layout" component={LandingLayout} />
  <CMSLayout id="blog"    label="Blog Layout"    component={BlogLayout} />

  {/* Explicit navigation declarations — render nothing, register on mount */}
  <CMSNavigation id="main"   label="Main Navigation"   items={mainNavItems} />
  <CMSNavigation id="footer" label="Footer Navigation" items={footerNavItems} />
  <CMSNavigation id="mobile" label="Mobile Navigation" items={mobileNavItems} />

  <RouteRegistry />          {/* renders CMS-generated dynamic pages */}
  <RouterProvider router={router} />

</RuntimeProvider>
```

**Registration sequence (runs on `RuntimeProvider` mount):**
```
registerWebsite()         → registry/{id}/runtime
registerRoutes()          → registry/{id}/routes        (from routesConfig, v6/v7 compat)
registerLayouts()         → registry/{id}/layouts       (from CMSLayout declarations)
registerNavigation()      → registry/{id}/navigation    (from CMSNavigation declarations)
registerTheme()           → registry/{id}/theme         (hash-checked, only if changed)
registerEditableRegions() → registry/{id}/editableRegions/{pageId}  (schema only)
startHeartbeat()          → registry/{id}/runtime/heartbeat  (every 30s)
listenForMessages()       → window.addEventListener("message", runtimeMessageHandler)
```

```
src/
├── RuntimeProvider.tsx, RuntimeContext.tsx
├── CMSLayout.tsx                render-nothing, registers into RuntimeContext
├── CMSNavigation.tsx            render-nothing, registers into RuntimeContext
├── RouteRegistry.tsx            renders CMS-generated pages from registry/{id}/routes
├── registration/
│   ├── registerWebsite.ts
│   ├── registerRoutes.ts        v6/v7 compat shim
│   ├── registerLayouts.ts       reads RuntimeContext.layouts[]
│   ├── registerNavigation.ts    reads RuntimeContext.navigations[]
│   ├── registerTheme.ts
│   └── registerEditableRegions.ts
├── routing/
│   ├── routeDiscovery.ts, routerCompat.ts, dynamicPageRenderer.tsx
├── heartbeat/heartbeatService.ts
├── messaging/runtimeMessageHandler.ts
├── manifest/manifestGenerator.ts    reads registry, outputs JSON (diagnostics fallback only)
└── version/versionReporter.ts
```

---

### `@anshif.rainhopes/reactcms-content-models`

Structured content type system.

**Built-in models:**

| ID | Label | Key Fields |
|---|---|---|
| `page` | Page | title, slug, content, seo |
| `blog-post` | Blog Post | title, slug, excerpt, content, author, publishedAt, tags, coverImage |
| `service` | Service | title, slug, summary, content, icon, features (repeater), cta |
| `portfolio` | Portfolio | title, slug, client, year, coverImage, gallery, tags, content |
| `team-member` | Team Member | name, role, bio, photo, linkedin, twitter, order |
| `faq` | FAQ | question, answer, category, order |
| `product` | Product | title, slug, price, description, images (repeater), specs (repeater) |

**Data separation rule:**
- Schema → `registry/{id}/contentModels/{modelId}/`
- Entry content → `content/{id}/entries/{modelId}/{entryId}/fields/`
- Entry SEO → `content/{id}/entries/{modelId}/{entryId}/seo/`
- Entry status → `content/{id}/entries/{modelId}/{entryId}/status`

```
src/
├── models/         page.ts, blogPost.ts, service.ts, portfolio.ts, teamMember.ts, faq.ts, product.ts
├── registry/       ModelRegistry.ts, defaultModels.ts
├── hooks/          useContentModel.ts, useContentEntry.ts, useContentList.ts
├── components/     ContentModelForm.tsx, FieldRenderer.tsx, ModelPicker.tsx
├── validation/     validateEntry.ts
└── firebase/       contentModelService.ts  (CRUD for content/{id}/entries/)
```

**Plugin boundaries (stable for v2):**
- `ModelRegistry.register(model)` — plugins add custom models via this only
- `FieldRenderer` accepts `customRenderer` prop — plugins add custom field types via this only

---

### `@anshif.rainhopes/reactcms-design-system`

Pre-built page section components. Consumes theme via CSS variables only.

**The Theme/Design System boundary:**

| Concern | Owned by | Location |
|---|---|---|
| Token values (colors, spacing, etc.) | Theme | `registry/{id}/theme/` |
| Visual section components | Design System | `packages/reactcms-design-system/` |
| Token → CSS var conversion | SDK `CMSThemeProvider` | `:root { --rcms-* }` |

**Invariant:** Every DS component uses **only** `var(--rcms-*)` CSS custom properties. Never imports `ThemeTokens` directly. Theme changes at runtime require zero JS re-renders — the CSS cascade handles it.

**Component catalogue:**
```
sections/    EditableHero, EditableFeatures, EditablePricing, EditableFAQ,
             EditableGallery, EditableCTA, EditableTestimonials, EditableTeam,
             EditableBlog, EditableStats
navigation/  EditableNavbar, EditableFooter
cards/       EditableCard, EditableAccordion
registry/    componentRegistry.ts      ← page wizard reads this
schemas/     hero.schema.ts, features.schema.ts, pricing.schema.ts, ...
```

**Plugin boundary (stable for v2):**
- `componentRegistry.register(schema, Component)` — stable API for plugins to add DS sections

---

### `reactcms-cli`

Distribution: `npx reactcms-cli` only.

**Full command reference:**

| Command | Milestone | Description |
|---|---|---|
| `npx reactcms migrate` | 4 | Scan project, install SDK+Runtime, wrap App, write config |
| `npx reactcms connect` | 4 | Interactive websiteId + apiKey → writes config, verifies Firebase |
| `npx reactcms sync` | 4 | Force full Registry sync from current Runtime state |
| `npx reactcms publish` | 4 | Publish all draft pages |
| `npx reactcms doctor` | 4 | Health check: config, SDK, Runtime, Firebase, heartbeat, versions |
| `npx reactcms upgrade` | 4 | Upgrade all packages to latest compatible |
| `npx reactcms create app` | 4 | Scaffold full React + CMS app |
| `npx reactcms create page` | 4 | Scaffold page file with CMSPage + DS sections |
| `npx reactcms create layout` | 4 | Scaffold layout + CMSLayout declaration |
| `npx reactcms create component` | 4 | Scaffold custom EditableXxx component |
| `npx reactcms create plugin` | 4 | Scaffold plugin package (ready for v2 Plugin API) |

**`npx reactcms migrate` — step-by-step:**
```
1.  Detect project, framework, React Router version
2.  Install @anshif.rainhopes/reactcms-sdk
3.  Install @anshif.rainhopes/reactcms-runtime
4.  AST-scan React Router config → extract route paths + component names
5.  Write reactcms.config.json
6.  Inject RuntimeProvider into entry file
7.  Inject CMSProvider inside RuntimeProvider
8.  Detect layout components → scaffold CMSLayout declarations
9.  Detect navigation arrays → scaffold CMSNavigation declarations
10. Scaffold RouteRegistry inside router
11. Print what was changed, what needs manual review
12. "Run `npx reactcms connect` to link your dashboard account"
```

**`reactcms.config.json` shape:**
```json
{
  "websiteId": "",
  "apiKey": "",
  "environment": "production",
  "framework": "react",
  "routerVersion": 6,
  "entryFile": "src/App.tsx",
  "routesFile": "src/routes/index.tsx",
  "manifestPath": "/.well-known/rcms-manifest.json",
  "sdkVersion": "1.0.0",
  "runtimeVersion": "1.0.0",
  "contentModelsVersion": "1.0.0"
}
```

---

### `packages/reactcms-plugin-api/` — v2 Placeholder

> **This package is NOT built in v1.**
> The directory is created as a placeholder. All v1 packages are designed to support it.

**Purpose (v2):** Let third-party developers build plugins (Forms, Analytics, Comments, AI, Commerce, Custom fields) without depending on internal SDK APIs.

**Design constraints applied in v1 now — do not remove:**

| v1 Package | Constraint |
|---|---|
| `reactcms-sdk` | `usePlugins()` is the only plugin interaction surface |
| `reactcms-content-models` | `ModelRegistry.register()` and `FieldRenderer customRenderer` are stable |
| `reactcms-design-system` | `componentRegistry.register()` is stable |
| Dashboard `pluginService.js` | Plugin config in `content/{id}/plugins/` — not the registry |
| Dashboard `PluginsPage.jsx` | Plugins declare UI via `PluginManifest` interface |

---

## Dashboard Extensions

### New Services

| File | Responsibility |
|---|---|
| `src/services/registryService.js` | All `registry/{id}/*` reads, writes, and subscriptions |
| `src/services/contentEntryService.js` | `content/{id}/entries/{modelId}/{entryId}` CRUD |
| `src/services/versionService.js` | Reads `registry/{id}/runtime`, returns compatibility level |

### Modified Services

| File | Change |
|---|---|
| `visualEditService.js` | Replace `RCMS_*` strings with `EVENT_TYPES[*]`; wrap in `RCMSMessage`; add `persistFieldUpdate` → `content/` path |
| `websiteSyncService.js` | Rename `runSync()` → `runManifestSync()`; add `runRegistrySync()` |
| `themeService.js` | Import `ThemeTokens` from `shared`; `saveTheme()` writes to both `content/` and `registry/` |
| `seoService.js` | `generateSitemap()` includes `registry/{id}/routes`; add `generateJSONLD()`; add `getPageSEO()` |
| `pageService.js` | On `create()`: write route metadata to `registry/{id}/routes/`; on `publish()`: set `published: true` |

### New Pages

| Page | Route |
|---|---|
| `NavigationPage.jsx` | `/content/:websiteId/navigation` |
| `LayoutsPage.jsx` | `/content/:websiteId/layouts` |
| `EditableRegionsPage.jsx` | `/content/:websiteId/editable` |
| `ContentModelsPage.jsx` | `/content/:websiteId/content-models` |
| `ContentModelEditorPage.jsx` | `/content/:websiteId/content-models/:modelId` |
| `ContentEntriesPage.jsx` | `/content/:websiteId/entries/:modelId` |

### Modified Pages

| Page | Change |
|---|---|
| `LivePreviewPage.jsx` | Versioned events; Visual Edit Inspector panel; `persistFieldUpdate` → `content/` path |
| `PageEditorPage.jsx` | 5-step new page wizard (Layout → Model → Template → Details → SEO) |
| `WebsiteDetailsPage.jsx` | Runtime status card; version compatibility badge; registry snapshot counts |
| `ThemeManagerPage.jsx` | Full `ThemeTokens` editor; live broadcast `rcms/v1/theme-update` |
| `SEODashboardPage.jsx` | JSON-LD editor; Twitter Card preview; OG preview |
| `DashboardPage.jsx` | Platform Health card with per-site version status |
| `SDKInstallPage.jsx` | Runtime install step; CLI migrate step |

### Route + Sidebar Additions

**`src/routes/index.jsx`** — new lazy-loaded routes:
```jsx
{ path: "navigation",              element: lazyLoad(NavigationPage) }
{ path: "layouts",                 element: lazyLoad(LayoutsPage) }
{ path: "editable",                element: lazyLoad(EditableRegionsPage) }
{ path: "content-models",          element: lazyLoad(ContentModelsPage) }
{ path: "content-models/:modelId", element: lazyLoad(ContentModelEditorPage) }
{ path: "entries/:modelId",        element: lazyLoad(ContentEntriesPage) }
```

**`src/components/layouts/Sidebar.jsx`** — new items under Content section:
- Navigation
- Layouts
- Content Models

---

## Version Compatibility

```
✅ Compatible   — all major + minor versions match     → no action
⚠️ Warn         — same major, different minor          → warning card in WebsiteDetailsPage
❌ Breaking     — different major versions             → error banner, visual edit disabled
```

---

## Milestone Schedule

> **Implementation proceeds in four milestones. Each milestone delivers a usable, shippable product.
> Never implement all milestones in a single pass.**

### Milestone 1 — Foundation

**Goal:** Connect a React app. Routes, layouts, navigation appear in the dashboard automatically. Heartbeat is live.

| Work Area | Deliverables |
|---|---|
| Mono-repo | Turborepo, npm workspaces, `tsconfig.base.json`, `turbo.json` |
| `shared` | All types, path builders, event constants, validators |
| `reactcms-sdk` | `CMSProvider`, `CMSThemeProvider`, `CMSSEOProvider`, `useEditable`, `MessageBus` |
| `reactcms-runtime` | `RuntimeProvider`, `CMSLayout`, `CMSNavigation`, all `register*`, heartbeat |
| Firebase | `registry/` paths established |
| Dashboard | `registryService`, `WebsiteDetailsPage` runtime status, `LayoutsPage`, `NavigationPage`, updated `SDKInstallPage` |
| Plugin boundary | `usePlugins()` stub, `PluginManifest` interface in `shared` |

**Exit criteria:** React app connects → routes/layouts/navigation appear in dashboard → heartbeat timestamp updates live.

---

### Milestone 2 — Editing

**Goal:** Edit any `EditableXxx` region from the dashboard. Theme changes propagate instantly.

| Work Area | Deliverables |
|---|---|
| `reactcms-sdk` | All `EditableXxx` primitives, edit mode overlays, `useLivePreview`, Firebase bridges |
| `reactcms-runtime` | `runtimeMessageHandler`, `registerEditableRegions`, `RouteRegistry` |
| Dashboard | Visual Edit Inspector panel in `LivePreviewPage`, versioned events in `visualEditService` |
| Dashboard | Full `ThemeTokens` editor in `ThemeManagerPage`, live broadcast |
| Dashboard | `EditableRegionsPage` (schema viewer) |
| `reactcms-plugin-api/` | Placeholder directory + README created |

**Exit criteria:** Visual edit enabled → click region → Inspector opens → type → website updates live → no page refresh. Change theme → CSS var updates instantly across all components.

---

### Milestone 3 — CMS

**Goal:** Create new pages with content models, templates, SEO. Blog posts, services, portfolio work end-to-end.

| Work Area | Deliverables |
|---|---|
| `reactcms-content-models` | All built-in models, `ContentModelForm`, `FieldRenderer`, `contentEntryService` |
| `reactcms-design-system` | All section components, schemas, `componentRegistry`, CSS var contract |
| Dashboard | `ContentModelsPage`, `ContentModelEditorPage`, `ContentEntriesPage` |
| Dashboard | 5-step new page wizard in `PageEditorPage` |
| Dashboard | `seoService` JSON-LD; `SEODashboardPage` OG/Twitter preview |

**Exit criteria:** Create Blog Post model → define fields → create entry → attach to page → publish → SEO tags and sitemap are correct.

---

### Milestone 4 — Developer Experience

**Goal:** Zero-friction onboarding. Any React project connects with one command.

| Work Area | Deliverables |
|---|---|
| `reactcms-cli` | All commands: `migrate`, `connect`, `sync`, `publish`, `doctor`, `upgrade`, `create *` |
| `apps/docs/` | SDK docs, CLI docs, Runtime guide, plugin guide, migration guide |
| Version compat | `versionService`, compatibility badges, Dashboard Health card |
| Tests | Full test suites for all packages |
| npm | All packages published to public npm |

**Exit criteria:** `npx reactcms migrate` on a fresh React project → `npx reactcms connect` → all Milestone 1–3 features work → `npx reactcms doctor` passes all checks.

---

## Build & Test

```bash
# Build all packages in dependency order (Turborepo resolves automatically)
npx turbo build

# Dependency order:
# shared → sdk → runtime → content-models → design-system → cli → dashboard

# Run all tests in parallel
npx turbo test

# Lint all packages
npx turbo lint

# Single package
npx turbo build --filter=reactcms-sdk
npx turbo test  --filter=reactcms-runtime
```

### Test Scope Per Package

| Package | Key Tests |
|---|---|
| `shared` | Path builders output correct strings; validators pass/fail correctly; `ThemeTokens` type checks; all `EVENT_TYPES` are `rcms/v1/*` |
| `reactcms-sdk` | `CMSProvider` mounts without Firebase (mocked); `EditableText` shows overlay in edit mode; `useEditable` registers region and returns value; `MessageBus` validates envelope; CSS var generation correct |
| `reactcms-runtime` | `CMSLayout`/`CMSNavigation` write to `RuntimeContext`; route walker handles both v6 and v7 config shapes; `registerEditableRegions` writes schema only (no values); heartbeat fires and cleans up on unmount |
| `reactcms-content-models` | `validateEntry` passes/fails correctly; `ContentModelForm` renders all `FieldType`s; built-in model schemas export valid `FieldDefinition[]` |
| `reactcms-design-system` | All components use only `var(--rcms-*)` CSS properties; all schemas export valid `FieldDefinition[]`; `componentRegistry` is complete |
| `reactcms-cli` | `migrate` detects React Router v6 vs v7; `wrapperInjector` produces valid JSX; `doctor` passes all checks when deps present; fails with correct error when missing |
| `dashboard` | `npm run dev` loads all existing routes without errors or regressions |
