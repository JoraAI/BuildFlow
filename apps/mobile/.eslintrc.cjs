module.exports = {
  extends: ['expo', 'prettier'],
  rules: {
    'import/no-unresolved': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    'react/react-in-jsx-scope': 'off',
  },
};
