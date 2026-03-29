/**
 * Firebase v12 moves getReactNativePersistence to the RN-specific entry point
 * (@firebase/auth/dist/rn/index.js). Metro resolves it correctly at runtime via
 * the "react-native" field in @firebase/auth's package.json, but TypeScript's
 * type resolution picks the generic "types" condition first (which omits it).
 *
 * This module augmentation re-adds the export so TypeScript can see it.
 */
import type AsyncStorage from '@react-native-async-storage/async-storage';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: typeof AsyncStorage): Persistence;
}
