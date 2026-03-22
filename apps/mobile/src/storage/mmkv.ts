import { MMKV } from 'react-native-mmkv';

// Dedicated MMKV instance for the offline write queue.
// Separate from any future general-purpose storage so it can be cleared independently.
export const queueStorage = new MMKV({ id: 'coach-offline-queue' });
