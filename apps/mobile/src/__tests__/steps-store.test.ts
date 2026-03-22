/**
 * Unit tests for useStepsStore — Apple Health step count integration.
 * expo-sensors is stubbed globally via moduleNameMapper in jest.config.js.
 */

import { Pedometer } from 'expo-sensors';
import { useStepsStore, STEPS_GOAL, KCAL_PER_STEP } from '../stores/steps.store';

const mockPedometer = Pedometer as jest.Mocked<typeof Pedometer>;

beforeEach(() => {
  jest.clearAllMocks();
  useStepsStore.setState({ steps: 0, permissionStatus: 'undetermined', isLoading: false });
});

describe('constants', () => {
  it('STEPS_GOAL is 10000', () => {
    expect(STEPS_GOAL).toBe(10_000);
  });

  it('KCAL_PER_STEP is 0.04', () => {
    expect(KCAL_PER_STEP).toBe(0.04);
  });
});

describe('checkPermission', () => {
  it('sets permissionStatus from getPermissionsAsync', async () => {
    (mockPedometer.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    await useStepsStore.getState().checkPermission();

    expect(useStepsStore.getState().permissionStatus).toBe('denied');
  });

  it('fetches steps when already granted', async () => {
    (mockPedometer.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (mockPedometer.getStepCountAsync as jest.Mock).mockResolvedValue({ steps: 4200 });

    await useStepsStore.getState().checkPermission();

    expect(useStepsStore.getState().permissionStatus).toBe('granted');
    expect(useStepsStore.getState().steps).toBe(4200);
  });

  it('does not fetch steps when undetermined', async () => {
    (mockPedometer.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });

    await useStepsStore.getState().checkPermission();

    expect(mockPedometer.getStepCountAsync).not.toHaveBeenCalled();
    expect(useStepsStore.getState().steps).toBe(0);
  });
});

describe('requestPermission', () => {
  it('sets permissionStatus after requesting', async () => {
    (mockPedometer.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    await useStepsStore.getState().requestPermission();

    expect(useStepsStore.getState().permissionStatus).toBe('denied');
  });

  it('fetches steps when permission granted', async () => {
    (mockPedometer.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (mockPedometer.getStepCountAsync as jest.Mock).mockResolvedValue({ steps: 7500 });

    await useStepsStore.getState().requestPermission();

    expect(useStepsStore.getState().permissionStatus).toBe('granted');
    expect(useStepsStore.getState().steps).toBe(7500);
  });

  it('does not fetch steps when permission denied', async () => {
    (mockPedometer.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    await useStepsStore.getState().requestPermission();

    expect(mockPedometer.getStepCountAsync).not.toHaveBeenCalled();
  });
});

describe('fetchTodaySteps', () => {
  it('updates steps on success', async () => {
    (mockPedometer.getStepCountAsync as jest.Mock).mockResolvedValue({ steps: 3000 });

    await useStepsStore.getState().fetchTodaySteps();

    expect(useStepsStore.getState().steps).toBe(3000);
    expect(useStepsStore.getState().isLoading).toBe(false);
  });

  it('clears isLoading on error without throwing', async () => {
    (mockPedometer.getStepCountAsync as jest.Mock).mockRejectedValue(new Error('unavailable'));

    await expect(useStepsStore.getState().fetchTodaySteps()).resolves.toBeUndefined();

    expect(useStepsStore.getState().isLoading).toBe(false);
    expect(useStepsStore.getState().steps).toBe(0);
  });

  it('calls getStepCountAsync with today midnight as start', async () => {
    (mockPedometer.getStepCountAsync as jest.Mock).mockResolvedValue({ steps: 100 });

    const before = new Date();
    await useStepsStore.getState().fetchTodaySteps();
    const after = new Date();

    expect(mockPedometer.getStepCountAsync).toHaveBeenCalledTimes(1);
    const [start, end] = (mockPedometer.getStepCountAsync as jest.Mock).mock.calls[0];
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(end.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(end.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
