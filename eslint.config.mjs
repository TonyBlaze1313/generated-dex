import nextConfig from 'eslint-config-next';

export default [
  ...nextConfig,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/purity': 'off',
      'react/no-unescaped-entities': 'warn',
      'import/no-anonymous-default-export': 'warn'
    }
  }
];
