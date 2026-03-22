/**
 * Minimal stub for expo-sensors in Jest (Node environment).
 * Tests override individual methods with .mockResolvedValue().
 */
module.exports = {
  Pedometer: {
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'undetermined' })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getStepCountAsync: jest.fn(() => Promise.resolve({ steps: 0 })),
    watchStepCount: jest.fn(() => ({ remove: jest.fn() })),
  },
};
