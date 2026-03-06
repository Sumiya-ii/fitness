/** @type {import('jest').Config} */
module.exports = {
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^nativewind/jsx-runtime$': 'react/jsx-runtime',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|react-native-svg|@react-navigation|expo)/)',
  ],
};
