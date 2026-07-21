import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  platform: 'browser',
  external: [
    'react',
    'react-dom',
    'react-router-dom',
    'firebase',
    'firebase/app',
    'firebase/database',
    '@anshif.rainhopes/shared',
  ],
});
