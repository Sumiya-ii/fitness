/**
 * Stub for @react-native-community/netinfo in Jest (Node environment).
 */
module.exports = {
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
};
