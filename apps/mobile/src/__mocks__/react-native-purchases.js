const Purchases = {
  configure: jest.fn(),
  logIn: jest
    .fn()
    .mockResolvedValue({ customerInfo: { entitlements: { active: {} } }, created: false }),
  logOut: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
  getOfferings: jest.fn().mockResolvedValue({ current: null, all: {} }),
  getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
  purchasePackage: jest
    .fn()
    .mockResolvedValue({ customerInfo: { entitlements: { active: {} } }, transaction: null }),
  restorePurchases: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
  setLogLevel: jest.fn(),
};

const LOG_LEVEL = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  VERBOSE: 'VERBOSE',
};
const PACKAGE_TYPE = {
  MONTHLY: 'MONTHLY',
  ANNUAL: 'ANNUAL',
  LIFETIME: 'LIFETIME',
  UNKNOWN: 'UNKNOWN',
};
const PURCHASES_ERROR_CODE = { PURCHASE_CANCELLED_ERROR: 1 };

module.exports = {
  default: Purchases,
  Purchases,
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
};
