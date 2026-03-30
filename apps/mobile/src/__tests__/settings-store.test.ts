/**
 * Unit tests for useSettingsStore.
 *
 * The settings store is intentionally minimal — unit system is always 'metric'
 * and the load/set actions are no-ops (the app is metric-only for Mongolian users).
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

    it('exposes loadUnitSystem and setUnitSystem functions', () => {
      const state = useSettingsStore.getState();
      expect(typeof state.loadUnitSystem).toBe('function');
      expect(typeof state.setUnitSystem).toBe('function');
    });
  });

  // ─── loadUnitSystem ───────────────────────────────────────────────────────

  describe('loadUnitSystem', () => {
    it('resolves without throwing', async () => {
      await expect(useSettingsStore.getState().loadUnitSystem()).resolves.toBeUndefined();
    });

    it('keeps unitSystem as metric after load', async () => {
      await useSettingsStore.getState().loadUnitSystem();
      expect(useSettingsStore.getState().unitSystem).toBe('metric');
    });
  });

  // ─── setUnitSystem ────────────────────────────────────────────────────────

  describe('setUnitSystem', () => {
    it('resolves without throwing', async () => {
      await expect(useSettingsStore.getState().setUnitSystem('metric')).resolves.toBeUndefined();
    });

    it('keeps unitSystem as metric (store is metric-only)', async () => {
      await useSettingsStore.getState().setUnitSystem('imperial');
      // The store is intentionally a no-op — unit system stays metric
      expect(useSettingsStore.getState().unitSystem).toBe('metric');
    });
  });
});
