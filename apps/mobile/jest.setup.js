// Required globals for react-native test environment
global.IS_REACT_ACT_ENVIRONMENT = true;
global.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

if (typeof global.__DEV__ === 'undefined') {
  global.__DEV__ = true;
}

if (typeof global.performance === 'undefined') {
  global.performance = { now: Date.now };
}

if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = clearTimeout;
}

if (typeof global.nativeFabricUIManager === 'undefined') {
  global.nativeFabricUIManager = {};
}

if (typeof global.regeneratorRuntime === 'undefined') {
  try {
    global.regeneratorRuntime = require('regenerator-runtime/runtime');
  } catch {
    // Not available
  }
}
