/**
 * In-memory stub for react-native-mmkv (native module — cannot run in Node Jest environment).
 */
class MMKV {
  constructor() {
    this._store = new Map();
  }
  getString(key) {
    return this._store.get(key) ?? undefined;
  }
  set(key, value) {
    this._store.set(key, value);
  }
  delete(key) {
    this._store.delete(key);
  }
}

module.exports = { MMKV };
