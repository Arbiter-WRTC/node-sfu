module.exports = {
  extends: ['airbnb', 'eslint:recommended'],
  plugins: ['import'],
  env: {
    // browser: true,
    es6: true,
    node: true,
  },
  rules: {
    'no-console': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      { devDependencies: true, dependencies: true },
    ],
    'max-classes-per-file': 'off', // this needs to be removed later
  },
};
