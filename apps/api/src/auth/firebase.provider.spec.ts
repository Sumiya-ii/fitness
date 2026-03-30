/**
 * FirebaseProvider unit tests.
 *
 * All firebase-admin calls are mocked — no real Firebase SDK or network usage.
 * Covers: initialization paths, private-key newline normalisation, verifyToken
 * happy / error paths, and Apple Sign-In token verification.
 */

// ── firebase-admin mock ──────────────────────────────────────────────────────
// Must be hoisted above all imports so the module is intercepted before any
// import resolves.

const mockVerifyIdToken = jest.fn();
const mockAuth = jest.fn().mockReturnValue({ verifyIdToken: mockVerifyIdToken });
const mockCert = jest.fn().mockReturnValue({ type: 'cert' });
const mockApplicationDefault = jest.fn().mockReturnValue({ type: 'applicationDefault' });
const mockInitializeApp = jest.fn().mockReturnValue({ auth: mockAuth });
const mockGetApp = jest.fn();
const mockDeleteApp = jest.fn();

jest.mock('firebase-admin', () => ({
  __esModule: true,
  default: {
    initializeApp: mockInitializeApp,
    credential: {
      cert: mockCert,
      applicationDefault: mockApplicationDefault,
    },
    app: mockGetApp,
    deleteApp: mockDeleteApp,
  },
  initializeApp: mockInitializeApp,
  credential: {
    cert: mockCert,
    applicationDefault: mockApplicationDefault,
  },
}));

// ── module imports (after mock hoisting) ────────────────────────────────────
import { FirebaseProvider } from './firebase.provider';
import type { ConfigService } from '../config';

// ── helpers ─────────────────────────────────────────────────────────────────

function buildConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  const defaults: Record<string, string | undefined> = {
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY:
      '-----BEGIN RSA PRIVATE KEY-----\\nfakekey\\n-----END RSA PRIVATE KEY-----',
  };
  const merged = { ...defaults, ...overrides };
  return {
    get: jest.fn().mockImplementation((key: string) => merged[key]),
  } as unknown as ConfigService;
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('FirebaseProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: verifyIdToken resolves successfully
    mockVerifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-123',
      email: 'user@example.com',
    });
    // auth() on the initialised app returns our mock auth object
    mockInitializeApp.mockReturnValue({ auth: mockAuth });
  });

  // ── onModuleInit / initialisation ─────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should initialise with cert credential when all env vars are present', () => {
      const config = buildConfig();
      const provider = new FirebaseProvider(config);

      provider.onModuleInit();

      expect(mockCert).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project',
          clientEmail: 'test@test-project.iam.gserviceaccount.com',
          privateKey: expect.stringContaining('-----BEGIN RSA PRIVATE KEY-----'),
        }),
      );
      expect(mockApplicationDefault).not.toHaveBeenCalled();
      expect(mockInitializeApp).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'test-project' }),
      );
    });

    it('should fall back to applicationDefault when client email is absent', () => {
      const config = buildConfig({ FIREBASE_CLIENT_EMAIL: undefined });
      const provider = new FirebaseProvider(config);

      provider.onModuleInit();

      expect(mockApplicationDefault).toHaveBeenCalled();
      expect(mockCert).not.toHaveBeenCalled();
    });

    it('should fall back to applicationDefault when private key is absent', () => {
      const config = buildConfig({ FIREBASE_PRIVATE_KEY: undefined });
      const provider = new FirebaseProvider(config);

      provider.onModuleInit();

      expect(mockApplicationDefault).toHaveBeenCalled();
      expect(mockCert).not.toHaveBeenCalled();
    });

    it('should replace escaped newline sequences in private key with real newlines', () => {
      // The value stored in env / Vault uses literal \n; the provider must
      // convert those to actual newline characters before passing to cert().
      const config = buildConfig({
        FIREBASE_PRIVATE_KEY: 'line1\\nline2\\nline3',
      });
      const provider = new FirebaseProvider(config);

      provider.onModuleInit();

      const certArg = mockCert.mock.calls[0][0] as { privateKey: string };
      expect(certArg.privateKey).toBe('line1\nline2\nline3');
      expect(certArg.privateKey).not.toContain('\\n');
    });

    it('should not replace already-expanded newlines in private key', () => {
      const config = buildConfig({
        FIREBASE_PRIVATE_KEY: 'line1\nline2',
      });
      const provider = new FirebaseProvider(config);

      provider.onModuleInit();

      const certArg = mockCert.mock.calls[0][0] as { privateKey: string };
      // replace(/\\n/g, '\n') on a string with real newlines leaves it unchanged
      expect(certArg.privateKey).toBe('line1\nline2');
    });
  });

  // ── verifyToken ───────────────────────────────────────────────────────────

  describe('verifyToken', () => {
    function initialised(): FirebaseProvider {
      const provider = new FirebaseProvider(buildConfig());
      provider.onModuleInit();
      return provider;
    }

    it('should return decoded token for a valid id token', async () => {
      const expected = { uid: 'firebase-uid-123', email: 'user@example.com' };
      mockVerifyIdToken.mockResolvedValueOnce(expected);

      const provider = initialised();
      const result = await provider.verifyToken('valid-id-token');

      expect(result).toEqual(expected);
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-id-token');
    });

    it('should propagate error thrown by Firebase when token is expired', async () => {
      const expiredError = Object.assign(new Error('Firebase ID token has expired'), {
        code: 'auth/id-token-expired',
      });
      mockVerifyIdToken.mockRejectedValueOnce(expiredError);

      const provider = initialised();

      await expect(provider.verifyToken('expired-token')).rejects.toThrow(
        'Firebase ID token has expired',
      );
    });

    it('should propagate error thrown by Firebase when token is malformed', async () => {
      const malformedError = Object.assign(new Error('Decoding Firebase ID token failed'), {
        code: 'auth/argument-error',
      });
      mockVerifyIdToken.mockRejectedValueOnce(malformedError);

      const provider = initialised();

      await expect(provider.verifyToken('not.a.valid.jwt')).rejects.toThrow(
        'Decoding Firebase ID token failed',
      );
    });

    it('should verify token issued by Apple Sign-In (sign_in_provider apple.com)', async () => {
      const appleDecoded = {
        uid: 'apple-uid-456',
        email: null, // Apple can hide the email
        firebase: {
          sign_in_provider: 'apple.com',
          identities: { 'apple.com': ['0001234.abc.1234'] },
        },
        iss: 'https://securetoken.google.com/test-project',
        aud: 'test-project',
        auth_time: Math.floor(Date.now() / 1000) - 60,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000) - 60,
        sub: 'apple-uid-456',
      };
      mockVerifyIdToken.mockResolvedValueOnce(appleDecoded);

      const provider = initialised();
      const result = await provider.verifyToken('apple-id-token');

      expect(result.uid).toBe('apple-uid-456');
      expect(result.firebase.sign_in_provider).toBe('apple.com');
      expect(result.email).toBeNull();
    });

    it('should verify token issued by Google Sign-In (sign_in_provider google.com)', async () => {
      const googleDecoded = {
        uid: 'google-uid-789',
        email: 'user@gmail.com',
        firebase: {
          sign_in_provider: 'google.com',
        },
        sub: 'google-uid-789',
      };
      mockVerifyIdToken.mockResolvedValueOnce(googleDecoded);

      const provider = initialised();
      const result = await provider.verifyToken('google-id-token');

      expect(result.uid).toBe('google-uid-789');
      expect(result.firebase.sign_in_provider).toBe('google.com');
      expect(result.email).toBe('user@gmail.com');
    });

    it('should propagate network / SDK connection error', async () => {
      const networkError = new Error('Failed to fetch public keys');
      mockVerifyIdToken.mockRejectedValueOnce(networkError);

      const provider = initialised();

      await expect(provider.verifyToken('any-token')).rejects.toThrow(
        'Failed to fetch public keys',
      );
    });
  });
});
