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
    // Stub native Expo modules that cannot run in Node
    '^expo-notifications$': '<rootDir>/src/__mocks__/expo-notifications.js',
    '^expo-constants$': '<rootDir>/src/__mocks__/expo-constants.js',
    '^expo-secure-store$': '<rootDir>/src/__mocks__/expo-secure-store.js',
    '^expo-sensors$': '<rootDir>/src/__mocks__/expo-sensors.js',
    '^react-native-mmkv$': '<rootDir>/src/__mocks__/react-native-mmkv.js',
    '^@react-native-community/netinfo$':
      '<rootDir>/src/__mocks__/@react-native-community/netinfo.js',
  },
  // Transform expo-* packages (they ship ESM) in addition to react-native/*
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|react-native-svg|@react-navigation|expo|expo-[a-z-]+|@expo)/)',
  ],
};
