// eslint.config.js
module.exports = [
  {
    ignores: ['node_modules/**', 'logs/**', 'uploads/**', 'temp/**'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly' }
    },
    plugins: {
      'unused-imports': require('eslint-plugin-unused-imports')
    },
    rules: {
      'no-unused-vars': ['warn', { vars: 'all', args: 'after-used', ignoreRestSiblings: false }],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }
      ]
    }
  }
];