/**
 * Minimal stub for expo-secure-store in Jest (Node environment).
 * Tests that need specific return values override with .mockResolvedValue().
 */
module.exports = {
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
};
