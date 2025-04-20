// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'out/',
      'webpack.config.js',
      'eslint.config.mjs',
      'src/types/git.d.ts',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      curly: ['error', 'all'], // Enforces braces for all control statements
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/prefer-regexp-exec': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: ['variable'],
          modifiers: ['global'],
          types: ['string', 'array'],
          format: ['UPPER_CASE'],
        },
        {
          selector: ['variable'],
          modifiers: ['global'],
          format: ['camelCase'],
        },
        {
          selector: ['function'],
          format: ['camelCase'],
        },
        {
          selector: ['method'],
          format: ['camelCase'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: ['typeAlias'],
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE'],
        },
      ],
    },
  },
);
