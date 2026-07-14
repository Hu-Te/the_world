import withNuxt from './.nuxt/eslint.config.mjs'
import eslintConfigPrettier from 'eslint-config-prettier'

export default withNuxt(
  {
    name: 'three-city/app',
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/block-order': [
        'error',
        {
          order: ['template', 'script', 'style'],
        },
      ],
      'vue/block-lang': [
        'error',
        {
          script: { lang: 'ts' },
          style: { lang: 'scss' },
        },
      ],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/padding-line-between-blocks': ['error', 'always'],
      'vue/html-self-closing': [
        'warn',
        {
          html: { void: 'always', normal: 'never', component: 'always' },
          svg: 'always',
          math: 'always',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    name: 'three-city/web3d',
    files: ['utils/web3d/**/*.{ts,js}'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
).append(
  {
    name: 'three-city/scripts',
    files: ['scripts/**/*.{cjs,js,mjs}'],
    rules: {
      'no-console': 'off',
    },
  },
  eslintConfigPrettier,
)
