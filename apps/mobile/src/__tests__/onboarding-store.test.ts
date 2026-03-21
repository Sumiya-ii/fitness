/**
 * Integration tests for onboarding store.
 *
 * Tests the store's AsyncStorage persistence and API sync logic,
 * which are the two key failure surfaces for onboarding state.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    setToken: jest.fn(),
    clearToken: jest.fn(),
    getToken: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { useOnboardingStore } from '../stores/onboarding.store';

const mockApi = api as jest.Mocked<typeof api>;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useOnboardingStore.setState({
    onboardingComplete: null,
    profileSetupComplete: null,
  });
});

describe('loadOnboardingStatus', () => {
  it('sets both flags to false when AsyncStorage is empty', async () => {
    await useOnboardingStore.getState().loadOnboardingStatus();
    expect(useOnboardingStore.getState().onboardingComplete).toBe(false);
    expect(useOnboardingStore.getState().profileSetupComplete).toBe(false);
  });

  it('reads true values from AsyncStorage', async () => {
    await AsyncStorage.setItem('onboarding_complete', 'true');
    await AsyncStorage.setItem('profile_setup_complete', 'true');

    await useOnboardingStore.getState().loadOnboardingStatus();

    expect(useOnboardingStore.getState().onboardingComplete).toBe(true);
    expect(useOnboardingStore.getState().profileSetupComplete).toBe(true);
  });

  it('reads mixed values correctly', async () => {
    await AsyncStorage.setItem('onboarding_complete', 'true');
    // profile_setup_complete not set

    await useOnboardingStore.getState().loadOnboardingStatus();

    expect(useOnboardingStore.getState().onboardingComplete).toBe(true);
    expect(useOnboardingStore.getState().profileSetupComplete).toBe(false);
  });
});

describe('setOnboardingComplete', () => {
  it('persists to AsyncStorage and updates state', async () => {
    await useOnboardingStore.getState().setOnboardingComplete();

    expect(useOnboardingStore.getState().onboardingComplete).toBe(true);
    expect(await AsyncStorage.getItem('onboarding_complete')).toBe('true');
  });
});

describe('setProfileSetupComplete', () => {
  it('persists to AsyncStorage and updates state', async () => {
    await useOnboardingStore.getState().setProfileSetupComplete();

    expect(useOnboardingStore.getState().profileSetupComplete).toBe(true);
    expect(await AsyncStorage.getItem('profile_setup_complete')).toBe('true');
  });
});

describe('syncProfileSetupStatus', () => {
  it('sets profileSetupComplete to true when API returns completed: true', async () => {
    mockApi.get.mockResolvedValue({ data: { completed: true } });

    await useOnboardingStore.getState().syncProfileSetupStatus();

    expect(useOnboardingStore.getState().profileSetupComplete).toBe(true);
    expect(await AsyncStorage.getItem('profile_setup_complete')).toBe('true');
  });

  it('sets profileSetupComplete to false when API returns completed: false', async () => {
    mockApi.get.mockResolvedValue({ data: { completed: false } });

    await useOnboardingStore.getState().syncProfileSetupStatus();

    expect(useOnboardingStore.getState().profileSetupComplete).toBe(false);
    expect(await AsyncStorage.getItem('profile_setup_complete')).toBe('false');
  });

  it('falls back to AsyncStorage when API throws', async () => {
    await AsyncStorage.setItem('profile_setup_complete', 'true');
    mockApi.get.mockRejectedValue(new Error('network error'));

    await useOnboardingStore.getState().syncProfileSetupStatus();

    expect(useOnboardingStore.getState().profileSetupComplete).toBe(true);
  });

  it('falls back to false when API throws and AsyncStorage is empty', async () => {
    mockApi.get.mockRejectedValue(new Error('network error'));

    await useOnboardingStore.getState().syncProfileSetupStatus();

    expect(useOnboardingStore.getState().profileSetupComplete).toBe(false);
  });

  it('sets profileSetupComplete to null while fetching (optimistic loading state)', async () => {
    let resolveApi!: (v: unknown) => void;
    mockApi.get.mockReturnValue(new Promise((r) => (resolveApi = r)));

    const syncPromise = useOnboardingStore.getState().syncProfileSetupStatus();
    expect(useOnboardingStore.getState().profileSetupComplete).toBeNull();

    resolveApi({ data: { completed: true } });
    await syncPromise;
    expect(useOnboardingStore.getState().profileSetupComplete).toBe(true);
  });
});
