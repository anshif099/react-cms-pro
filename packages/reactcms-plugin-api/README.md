# `@anshif.rainhopes/reactcms-plugin-api`

> **v2 Feature Placeholder**
>
> This package directory serves as the placeholder for the upcoming **ReactCMS v2 Plugin API**.
> All v1 packages (`reactcms-sdk`, `reactcms-runtime`, `reactcms-content-models`, `reactcms-design-system`, `dashboard`) adhere to the architectural boundaries designed to accommodate third-party plugins in v2 without breaking changes.

## v1 Plugin Boundaries Enforced

- `reactcms-sdk`: `usePlugins()` hook provides the single interaction surface `{ plugins, invoke(id, method, args) }`.
- `reactcms-content-models`: `ModelRegistry.register(model)` and `FieldRenderer` `customRenderer` support custom plugin field types.
- `reactcms-design-system`: `componentRegistry.register(schema, Component)` allows plugins to extend section components.
- Dashboard `pluginService.js`: Plugin configuration resides in `content/{websiteId}/plugins/` (not the metadata registry).
- Dashboard `PluginsPage.jsx`: Renders active plugins adhering to the `PluginManifest` contract defined in `@anshif.rainhopes/shared`.
