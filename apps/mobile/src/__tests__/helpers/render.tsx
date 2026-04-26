/**
 * Shared test utilities for screen rendering tests.
 * Provides pre-configured render with navigation context and common mocks.
 */
import { render, type RenderOptions } from '@testing-library/react-native';
import React, { type ReactElement } from 'react';

// Re-export everything from RNTL
export * from '@testing-library/react-native';

/**
 * Default mock for useNavigation — covers navigate, goBack, getParent.
 */
export const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({
    navigate: jest.fn(),
  })),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  dispatch: jest.fn(),
};

/**
 * Default mock for useRoute — override params per test.
 */
export const mockRoute = {
  key: 'test-key',
  name: 'TestScreen',
  params: {},
};

// Setup @react-navigation/native mocks
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useFocusEffect: (cb: () => void) => {
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
  useIsFocused: () => true,
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * Render helper — just re-exports RNTL render but keeps a single import point.
 */
export function renderScreen(ui: ReactElement, options?: RenderOptions) {
  return render(ui, options);
}
