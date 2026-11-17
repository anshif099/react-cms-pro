# ReactCMS Pro

ReactCMS includes an embedded first-party Rocket planning engine and the experimental [Rocket AI model and training stack](rocket_ai/README.md). Page planning and procedural image generation run directly inside the dashboard against the complete editable page model. Rocket does not call OpenAI, GPT, `/api/rocket`, or another inference provider. Plans pass through ReactCMS validation and require explicit approval before changing a draft.

## Dashboard

Connected website previews automatically discover ordinary text, images, links,
buttons, and sections without requiring SDK wrappers. Existing SDK regions keep
their own editing behavior. Automatic edits are stored as page content drafts;
publishing to connected cPanel/SFTP hosting installs the live content bridge.
The hosting session must be connected for that installation. Original JSX and
compiled bundles are not rewritten for these content edits. Routes still need
to be discovered/imported separately.

Automatic fields use DOM paths, so a later source deployment that changes page
structure can require reselecting affected content. Forms, application logic,
canvas content, shadow DOM, and custom interactive widgets are not converted
into CMS fields. Git-backed automatic content publishing requires a separate
deployment integration; the automatic cPanel/SFTP publisher does not cover it.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
