/**
 * Unit tests for useProfileStore (onboarding profile data + BMR/macro calculations).
 *
 * The store persists data to MMKV via onboardingStorage.
 * MMKV is globally stubbed via moduleNameMapper → react-native-mmkv.js (in-memory).
 */

// Firebase is imported transitively through other stores — stub it to avoid side effects.
jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
}));

import { useProfileStore, calculateTargets, type OnboardingData } from '../stores/profile.store';

const FULL_PROFILE: OnboardingData = {
  goalType: 'lose_fat',
  goalWeightKg: 70,
  weeklyRateKg: 0.5,
  gender: 'male',
  birthDate: new Date('1990-01-01'),
  heightCm: 175,
  weightKg: 85,
  activityLevel: 'moderately_active',
  dietPreference: 'standard',
};

function resetStore() {
  useProfileStore.setState({
    goalType: null,
    goalWeightKg: null,
    weeklyRateKg: null,
    gender: null,
    birthDate: null,
    heightCm: null,
    weightKg: null,
    activityLevel: null,
    dietPreference: null,
  });
}

describe('useProfileStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has all null values by default', () => {
      const state = useProfileStore.getState();
      expect(state.goalType).toBeNull();
      expect(state.goalWeightKg).toBeNull();
      expect(state.weeklyRateKg).toBeNull();
      expect(state.gender).toBeNull();
      expect(state.birthDate).toBeNull();
      expect(state.heightCm).toBeNull();
      expect(state.weightKg).toBeNull();
      expect(state.activityLevel).toBeNull();
      expect(state.dietPreference).toBeNull();
    });
  });

  // ─── Setters ──────────────────────────────────────────────────────────────

  describe('setGoalType', () => {
    it('updates goalType', () => {
      useProfileStore.getState().setGoalType('gain');
      expect(useProfileStore.getState().goalType).toBe('gain');
    });
  });

  describe('setGoalWeightKg', () => {
    it('updates goalWeightKg', () => {
      useProfileStore.getState().setGoalWeightKg(72);
      expect(useProfileStore.getState().goalWeightKg).toBe(72);
    });
  });

  describe('setWeeklyRateKg', () => {
    it('updates weeklyRateKg', () => {
      useProfileStore.getState().setWeeklyRateKg(0.25);
      expect(useProfileStore.getState().weeklyRateKg).toBe(0.25);
    });
  });

  describe('setGender', () => {
    it('updates gender to male', () => {
      useProfileStore.getState().setGender('male');
      expect(useProfileStore.getState().gender).toBe('male');
    });

    it('updates gender to female', () => {
      useProfileStore.getState().setGender('female');
      expect(useProfileStore.getState().gender).toBe('female');
    });

    it('updates gender to other', () => {
      useProfileStore.getState().setGender('other');
      expect(useProfileStore.getState().gender).toBe('other');
    });
  });

  describe('setBirthDate', () => {
    it('updates birthDate', () => {
      const date = new Date('1995-06-15');
      useProfileStore.getState().setBirthDate(date);
      expect(useProfileStore.getState().birthDate).toEqual(date);
    });
  });

  describe('setHeightCm', () => {
    it('updates heightCm', () => {
      useProfileStore.getState().setHeightCm(180);
      expect(useProfileStore.getState().heightCm).toBe(180);
    });
  });

  describe('setWeightKg', () => {
    it('updates weightKg', () => {
      useProfileStore.getState().setWeightKg(80);
      expect(useProfileStore.getState().weightKg).toBe(80);
    });
  });

  describe('setActivityLevel', () => {
    it('updates activityLevel', () => {
      useProfileStore.getState().setActivityLevel('very_active');
      expect(useProfileStore.getState().activityLevel).toBe('very_active');
    });
  });

  describe('setDietPreference', () => {
    it('updates dietPreference', () => {
      useProfileStore.getState().setDietPreference('high_protein');
      expect(useProfileStore.getState().dietPreference).toBe('high_protein');
    });
  });

  // ─── getOnboardingData ────────────────────────────────────────────────────

  describe('getOnboardingData', () => {
    it('returns all onboarding fields as a plain object', () => {
      useProfileStore.setState(FULL_PROFILE);

      const data = useProfileStore.getState().getOnboardingData();

      expect(data).toEqual(FULL_PROFILE);
    });

    it('does not include action functions', () => {
      const data = useProfileStore.getState().getOnboardingData();

      expect(typeof (data as any).setGoalType).toBe('undefined');
    });
  });

  // ─── isComplete ───────────────────────────────────────────────────────────

  describe('isComplete', () => {
    it('returns false when any required field is missing', () => {
      expect(useProfileStore.getState().isComplete()).toBe(false);
    });

    it('returns true when all fields are set', () => {
      useProfileStore.setState(FULL_PROFILE);
      expect(useProfileStore.getState().isComplete()).toBe(true);
    });

    it('returns false when only one field is missing', () => {
      useProfileStore.setState({ ...FULL_PROFILE, dietPreference: null });
      expect(useProfileStore.getState().isComplete()).toBe(false);
    });

    it('returns true when weeklyRateKg is zero (maintain goal)', () => {
      // weeklyRateKg of 0 is valid for the maintain goal — isComplete uses != null check
      useProfileStore.setState({ ...FULL_PROFILE, goalType: 'maintain', weeklyRateKg: 0 });
      expect(useProfileStore.getState().isComplete()).toBe(true);
    });
  });

  // ─── getTargets ───────────────────────────────────────────────────────────

  describe('getTargets', () => {
    it('returns null when profile is incomplete', () => {
      expect(useProfileStore.getState().getTargets()).toBeNull();
    });

    it('returns calculated targets when profile is complete', () => {
      useProfileStore.setState(FULL_PROFILE);

      const targets = useProfileStore.getState().getTargets();

      expect(targets).not.toBeNull();
      expect(targets!.calories).toBeGreaterThan(0);
      expect(targets!.protein).toBeGreaterThan(0);
      expect(targets!.carbs).toBeGreaterThanOrEqual(0);
      expect(targets!.fat).toBeGreaterThan(0);
    });

    it('calories are at minimum 1200 even for aggressive deficit', () => {
      useProfileStore.setState({
        ...FULL_PROFILE,
        weightKg: 45,
        weeklyRateKg: 1.0,
        activityLevel: 'sedentary',
        goalType: 'lose_fat',
      });

      const targets = useProfileStore.getState().getTargets();

      expect(targets!.calories).toBeGreaterThanOrEqual(1200);
    });
  });

  // ─── clearDraft / reset ───────────────────────────────────────────────────

  describe('clearDraft', () => {
    it('resets all fields to null', () => {
      useProfileStore.setState(FULL_PROFILE);

      useProfileStore.getState().clearDraft();

      const state = useProfileStore.getState();
      expect(state.goalType).toBeNull();
      expect(state.weightKg).toBeNull();
      expect(state.gender).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets all fields to null', () => {
      useProfileStore.setState(FULL_PROFILE);

      useProfileStore.getState().reset();

      const state = useProfileStore.getState();
      expect(state.goalType).toBeNull();
      expect(state.heightCm).toBeNull();
      expect(state.birthDate).toBeNull();
    });
  });
});

// ─── calculateTargets (pure function) ────────────────────────────────────────

describe('calculateTargets', () => {
  it('returns null when any field is missing', () => {
    expect(calculateTargets({ ...FULL_PROFILE, gender: null })).toBeNull();
    expect(calculateTargets({ ...FULL_PROFILE, birthDate: null })).toBeNull();
    expect(calculateTargets({ ...FULL_PROFILE, heightCm: null })).toBeNull();
    expect(calculateTargets({ ...FULL_PROFILE, weightKg: null })).toBeNull();
    expect(calculateTargets({ ...FULL_PROFILE, activityLevel: null })).toBeNull();
    expect(calculateTargets({ ...FULL_PROFILE, dietPreference: null })).toBeNull();
    expect(calculateTargets({ ...FULL_PROFILE, goalType: null })).toBeNull();
  });

  it('produces higher calories for gain goal vs maintain', () => {
    const maintain = calculateTargets({ ...FULL_PROFILE, goalType: 'maintain', weeklyRateKg: 0 });
    const gain = calculateTargets({ ...FULL_PROFILE, goalType: 'gain', weeklyRateKg: 0.5 });

    expect(gain!.calories).toBeGreaterThan(maintain!.calories);
  });

  it('produces lower calories for lose_fat goal vs maintain', () => {
    const maintain = calculateTargets({ ...FULL_PROFILE, goalType: 'maintain', weeklyRateKg: 0 });
    const lose = calculateTargets({ ...FULL_PROFILE, goalType: 'lose_fat', weeklyRateKg: 0.5 });

    expect(lose!.calories).toBeLessThan(maintain!.calories);
  });

  it('high_protein diet preference results in higher protein ratio', () => {
    const standard = calculateTargets({ ...FULL_PROFILE, dietPreference: 'standard' });
    const highProtein = calculateTargets({ ...FULL_PROFILE, dietPreference: 'high_protein' });

    expect(highProtein!.protein).toBeGreaterThanOrEqual(standard!.protein);
  });

  it('uses average of male and female formulas for "other" gender', () => {
    const male = calculateTargets({ ...FULL_PROFILE, gender: 'male' });
    const female = calculateTargets({ ...FULL_PROFILE, gender: 'female' });
    const other = calculateTargets({ ...FULL_PROFILE, gender: 'other' });

    // "other" result should be between male and female
    const minCal = Math.min(male!.calories, female!.calories);
    const maxCal = Math.max(male!.calories, female!.calories);
    expect(other!.calories).toBeGreaterThanOrEqual(minCal);
    expect(other!.calories).toBeLessThanOrEqual(maxCal);
  });

  it('protein is at least 1.6g per kg body weight', () => {
    const targets = calculateTargets(FULL_PROFILE);

    // FULL_PROFILE.weightKg = 85
    expect(targets!.protein).toBeGreaterThanOrEqual(Math.round(85 * 1.6));
  });

  it('carbs are never negative', () => {
    // Use low_carb diet which results in more fat calories, may squeeze carbs
    const targets = calculateTargets({ ...FULL_PROFILE, dietPreference: 'low_carb' });

    expect(targets!.carbs).toBeGreaterThanOrEqual(0);
  });
});
