import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'supabase/functions/**'],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // A leading underscore marks a parameter or value that is unused on purpose
      // (a server action's FormData, a destructured field being dropped).
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
];

export default config;
