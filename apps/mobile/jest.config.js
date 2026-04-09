/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    // ts-jest only for TypeScript files in src/
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
    // babel-jest for all JS files (including RN internals with Flow syntax)
    '^.+\\.jsx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^nativewind/jsx-runtime$': 'react/jsx-runtime',
    // Stub native Expo modules that cannot run in Node
    '^expo-notifications$': '<rootDir>/src/__mocks__/expo-notifications.js',
    '^expo-constants$': '<rootDir>/src/__mocks__/expo-constants.js',
    '^expo-secure-store$': '<rootDir>/src/__mocks__/expo-secure-store.js',
    '^expo-sensors$': '<rootDir>/src/__mocks__/expo-sensors.js',
    '^expo-haptics$': '<rootDir>/src/__mocks__/expo-haptics.js',
    '^expo-linear-gradient$': '<rootDir>/src/__mocks__/expo-linear-gradient.js',
    '^react-native-mmkv$': '<rootDir>/src/__mocks__/react-native-mmkv.js',
    '^@react-native-community/netinfo$':
      '<rootDir>/src/__mocks__/@react-native-community/netinfo.js',
    '^react-native-purchases$': '<rootDir>/src/__mocks__/react-native-purchases.js',
    '^react-native-reanimated$': '<rootDir>/src/__mocks__/react-native-reanimated.js',
    '^react-native-safe-area-context$': '<rootDir>/src/__mocks__/react-native-safe-area-context.js',
    '^react-native-svg$': '<rootDir>/src/__mocks__/react-native-svg.js',
    '^@expo/vector-icons$': '<rootDir>/src/__mocks__/@expo/vector-icons.js',
    '^react-native-gesture-handler$': '<rootDir>/src/__mocks__/react-native-gesture-handler.js',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__mocks__/**'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 40,
      branches: 40,
      functions: 40,
      lines: 40,
    },
  },
  // Transform expo-* packages (they ship ESM) and react-native internals with Flow
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|react-native-svg|@react-navigation|expo|expo-[a-z-]+|@expo|firebase|@firebase|@sentry)/)',
  ],
};
