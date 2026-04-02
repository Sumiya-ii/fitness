/**
 * Unit tests for useSettingsStore.
 *
 * The settings store is minimal — unit system is always 'metric'
 * (the app is metric-only for Mongolian users).
 */

// Firebase is imported transitively — stub it to avoid side effects.
jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
}));

import { useSettingsStore } from '../stores/settings.store';

describe('useSettingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ unitSystem: 'metric' });
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has unitSystem set to metric', () => {
      expect(useSettingsStore.getState().unitSystem).toBe('metric');
    });
  });
});
