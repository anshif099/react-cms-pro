import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  platform: 'browser',
  external: [
    'react',
    'react/jsx-runtime',
    '@anshif.rainhopes/reactcms-history',
    '@anshif.rainhopes/reactcms-layout-engine',
    '@anshif.rainhopes/reactcms-renderer',
    '@anshif.rainhopes/reactcms-selection',
  ],
});
