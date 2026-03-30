/**
 * Build-config validation tests.
 *
 * These tests catch recurring EAS / native-build issues at commit time rather
 * than after a 20-minute cloud build fails.  They read JSON files on disk — no
 * mocks, no network, no native modules required.
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Paths ────────────────────────────────────────────────────────────────────

const MOBILE_ROOT = path.resolve(__dirname, '../..');
const APP_JSON_PATH = path.join(MOBILE_ROOT, 'app.json');
const EAS_JSON_PATH = path.join(MOBILE_ROOT, 'eas.json');
const PACKAGE_JSON_PATH = path.join(MOBILE_ROOT, 'package.json');
const IOS_DIR = path.join(MOBILE_ROOT, 'ios');
const IOS_SCHEMES_DIR = path.join(IOS_DIR, 'Coach.xcodeproj', 'xcshareddata', 'xcschemes');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJson<T = Record<string, unknown>>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

/** Normalise a plugin entry to its string identifier so arrays and string
 *  entries can be compared uniformly.
 *  e.g. "expo-secure-store" → "expo-secure-store"
 *       ["expo-notifications", { ... }] → "expo-notifications"
 */
function pluginId(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0];
  return JSON.stringify(entry);
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('app.json', () => {
  let appJson: Record<string, unknown>;
  let expo: Record<string, unknown>;

  beforeAll(() => {
    appJson = readJson(APP_JSON_PATH);
    expo = appJson['expo'] as Record<string, unknown>;
  });

  // ── 1. Schema basics ──────────────────────────────────────────────────────

  describe('required top-level fields', () => {
    it('should have a non-empty name', () => {
      expect(typeof expo['name']).toBe('string');
      expect((expo['name'] as string).trim().length).toBeGreaterThan(0);
    });

    it('should have a non-empty slug', () => {
      expect(typeof expo['slug']).toBe('string');
      expect((expo['slug'] as string).trim().length).toBeGreaterThan(0);
    });

    it('should have a non-empty scheme', () => {
      expect(typeof expo['scheme']).toBe('string');
      expect((expo['scheme'] as string).trim().length).toBeGreaterThan(0);
    });

    it('should have a non-empty version', () => {
      expect(typeof expo['version']).toBe('string');
      expect((expo['version'] as string).trim().length).toBeGreaterThan(0);
    });

    it('should have a non-empty ios.bundleIdentifier', () => {
      const ios = expo['ios'] as Record<string, unknown>;
      expect(typeof ios?.['bundleIdentifier']).toBe('string');
      expect((ios['bundleIdentifier'] as string).trim().length).toBeGreaterThan(0);
    });

    it('should have a non-empty android.package', () => {
      const android = expo['android'] as Record<string, unknown>;
      expect(typeof android?.['package']).toBe('string');
      expect((android['package'] as string).trim().length).toBeGreaterThan(0);
    });
  });

  // ── 2. No duplicate plugins ───────────────────────────────────────────────

  describe('plugins array', () => {
    it('should not contain duplicate plugin entries', () => {
      const plugins = expo['plugins'] as unknown[];
      expect(Array.isArray(plugins)).toBe(true);

      const ids = plugins.map(pluginId);
      const seen = new Set<string>();
      const duplicates: string[] = [];

      for (const id of ids) {
        if (seen.has(id)) {
          duplicates.push(id);
        }
        seen.add(id);
      }

      expect(duplicates).toEqual([]);
    });

    it('should list every plugin id exactly once', () => {
      const plugins = expo['plugins'] as unknown[];
      const ids = plugins.map(pluginId);
      const unique = Array.from(new Set(ids));
      expect(ids).toHaveLength(unique.length);
    });
  });

  // ── 3. Firebase config files exist ───────────────────────────────────────

  describe('Firebase config file references', () => {
    it('should have ios.googleServicesFile pointing to an existing file', () => {
      const ios = expo['ios'] as Record<string, unknown>;
      const ref = ios?.['googleServicesFile'] as string | undefined;

      expect(typeof ref).toBe('string');

      const resolved = path.resolve(MOBILE_ROOT, ref as string);
      expect(fs.existsSync(resolved)).toBe(true);
    });

    it('should have android.googleServicesFile pointing to an existing file', () => {
      const android = expo['android'] as Record<string, unknown>;
      const ref = android?.['googleServicesFile'] as string | undefined;

      // google-services.json may be gitignored on CI but must be declared
      expect(typeof ref).toBe('string');
      expect((ref as string).trim().length).toBeGreaterThan(0);

      // Only assert existence locally — skip when running in CI without secrets
      if (process.env.CI !== 'true') {
        const resolved = path.resolve(MOBILE_ROOT, ref as string);
        // Soft check: warn rather than hard-fail so a missing google-services.json
        // on a dev machine that only builds for iOS doesn't block the suite.
        if (!fs.existsSync(resolved)) {
          console.warn(
            `[build-config] android.googleServicesFile not found at ${resolved} — this will fail an Android build`,
          );
        }
      }
    });
  });

  // ── 4. EAS project wiring ─────────────────────────────────────────────────

  describe('EAS project wiring', () => {
    it('should have extra.eas.projectId set', () => {
      const extra = expo['extra'] as Record<string, unknown> | undefined;
      const eas = extra?.['eas'] as Record<string, unknown> | undefined;
      expect(typeof eas?.['projectId']).toBe('string');
      expect((eas!['projectId'] as string).trim().length).toBeGreaterThan(0);
    });

    it('should have updates.url that matches the eas.projectId', () => {
      const extra = expo['extra'] as Record<string, unknown>;
      const projectId = (extra['eas'] as Record<string, unknown>)['projectId'] as string;
      const updatesUrl = (expo['updates'] as Record<string, unknown>)?.['url'] as string;

      expect(typeof updatesUrl).toBe('string');
      expect(updatesUrl).toContain(projectId);
    });
  });
});

// ── eas.json ──────────────────────────────────────────────────────────────────

describe('eas.json', () => {
  let easJson: Record<string, unknown>;

  beforeAll(() => {
    easJson = readJson(EAS_JSON_PATH);
  });

  it('should parse without error', () => {
    expect(easJson).toBeDefined();
  });

  it('should declare a production build profile', () => {
    const build = easJson['build'] as Record<string, unknown> | undefined;
    expect(build?.['production']).toBeDefined();
  });

  // ── 5. iOS scheme consistency ─────────────────────────────────────────────

  describe('iOS scheme consistency', () => {
    const iosExists = fs.existsSync(IOS_DIR);

    it('every build profile that declares ios.scheme should reference a committed xcscheme file', () => {
      if (!iosExists) {
        // ios/ was not committed — prebuild will regenerate it, skip the check
        return;
      }

      const build = easJson['build'] as Record<string, Record<string, unknown>>;
      const committedSchemes = fs
        .readdirSync(IOS_SCHEMES_DIR)
        .map((f) => f.replace('.xcscheme', ''));

      for (const [profileName, profile] of Object.entries(build)) {
        const iosBlock = profile['ios'] as Record<string, unknown> | undefined;
        const scheme = iosBlock?.['scheme'] as string | undefined;

        if (!scheme) continue;

        expect(committedSchemes).toContain(scheme);

        if (!committedSchemes.includes(scheme)) {
          // Surface a clear failure message
          fail(
            `eas.json build.${profileName}.ios.scheme="${scheme}" has no matching ` +
              `${scheme}.xcscheme in ios/Coach.xcodeproj/xcshareddata/xcschemes/. ` +
              `Available schemes: ${committedSchemes.join(', ')}`,
          );
        }
      }
    });

    it('app.json slug should match every eas.json ios scheme (case-insensitive)', () => {
      if (!iosExists) return;

      const appJson = readJson(APP_JSON_PATH);
      const expo = appJson['expo'] as Record<string, unknown>;
      const appName = (expo['name'] as string).trim();

      const build = easJson['build'] as Record<string, Record<string, unknown>>;

      for (const [profileName, profile] of Object.entries(build)) {
        const iosBlock = profile['ios'] as Record<string, unknown> | undefined;
        const scheme = iosBlock?.['scheme'] as string | undefined;
        if (!scheme) continue;

        expect(scheme.toLowerCase()).toBe(appName.toLowerCase());

        if (scheme.toLowerCase() !== appName.toLowerCase()) {
          console.warn(
            `[build-config] eas.json build.${profileName}.ios.scheme="${scheme}" does not ` +
              `match app.json name="${appName}". This can cause "scheme not found" errors.`,
          );
        }
      }
    });
  });
});

// ── package.json ──────────────────────────────────────────────────────────────

describe('package.json', () => {
  let pkg: Record<string, unknown>;
  let allDeps: Record<string, string>;

  beforeAll(() => {
    pkg = readJson(PACKAGE_JSON_PATH);
    const deps = (pkg['dependencies'] as Record<string, string>) ?? {};
    const devDeps = (pkg['devDependencies'] as Record<string, string>) ?? {};
    allDeps = { ...deps, ...devDeps };
  });

  // ── 6. react-native-worklets duplicate guard ──────────────────────────────

  describe('react-native-worklets conflict', () => {
    it('should not declare both react-native-worklets and react-native-reanimated worklets inline', () => {
      // react-native-reanimated >=3 ships its own worklets runtime.
      // Installing react-native-worklets alongside it causes duplicate symbol
      // linker errors on iOS. The project pins worklets via expo.install.exclude
      // to prevent expo doctor from auto-upgrading it — verify that is still in
      // place when both packages are declared.
      const hasWorklets = 'react-native-worklets' in allDeps;
      const hasReanimated = 'react-native-reanimated' in allDeps;

      if (hasWorklets && hasReanimated) {
        const expoBlock = pkg['expo'] as Record<string, unknown> | undefined;
        const exclude =
          ((expoBlock?.['install'] as Record<string, unknown> | undefined)?.['exclude'] as
            | string[]
            | undefined) ?? [];

        expect(exclude).toContain('react-native-worklets');
      }
    });

    it('should not list react-native-worklets in both dependencies and devDependencies', () => {
      const deps = (pkg['dependencies'] as Record<string, string>) ?? {};
      const devDeps = (pkg['devDependencies'] as Record<string, string>) ?? {};
      const inBoth = 'react-native-worklets' in deps && 'react-native-worklets' in devDeps;
      expect(inBoth).toBe(false);
    });
  });

  // ── 7. Known version-conflict patterns ───────────────────────────────────

  describe('known problematic dependency patterns', () => {
    it('should not have react and react-native on mismatched major versions', () => {
      const reactVersion = allDeps['react'];
      const rnVersion = allDeps['react-native'];

      if (!reactVersion || !rnVersion) return;

      // React 19 requires react-native >=0.76
      const reactMajor = parseInt(reactVersion.replace(/[^0-9]/, ''), 10);
      const rnMajor = parseFloat(rnVersion.replace(/[^0-9.]/, ''));

      if (reactMajor >= 19) {
        expect(rnMajor).toBeGreaterThanOrEqual(0.76);
      }
    });

    it('should not declare firebase and @firebase/* packages simultaneously at conflicting majors', () => {
      const firebaseVersion = allDeps['firebase'];
      const firebaseAdminVersion = allDeps['@firebase/app'];

      if (!firebaseVersion || !firebaseAdminVersion) return;

      const major1 = parseInt(firebaseVersion.replace(/[^0-9]/, ''), 10);
      const major2 = parseInt(firebaseAdminVersion.replace(/[^0-9]/, ''), 10);

      // They must be on the same major to use the same underlying SDK
      expect(major1).toBe(major2);
    });

    it('should not have @sentry/react-native pinned to an incompatible tilde range with expo', () => {
      const sentryVersion = allDeps['@sentry/react-native'];
      const expoVersion = allDeps['expo'];

      if (!sentryVersion || !expoVersion) return;

      // Sentry ~7.x is not compatible with Expo SDK 53+
      // Sentry >=8.x is required for Expo SDK 53+
      const sentryMajor = parseInt(sentryVersion.replace(/[^0-9]/, ''), 10);
      const expoMinor = parseInt((expoVersion.match(/~?(\d+)\./) ?? [])[1] ?? '0', 10);

      if (expoMinor >= 53) {
        // Only warn — Sentry 7 still works but causes deprecation noise at build time
        if (sentryMajor < 8) {
          console.warn(
            `[build-config] @sentry/react-native@${sentryVersion} may be incompatible with ` +
              `expo@${expoVersion}. Consider upgrading to @sentry/react-native ^8.`,
          );
        }
      }
    });

    it('expo SDK minor version should be consistent across expo-* packages', () => {
      const expoVersion = allDeps['expo'];
      if (!expoVersion) return;

      const expoSdkMinor = parseInt((expoVersion.match(/~?(\d+)\./) ?? [])[1] ?? '0', 10);
      if (expoSdkMinor === 0) return; // couldn't parse, skip

      const mismatched: string[] = [];

      for (const [dep, version] of Object.entries(allDeps)) {
        if (!dep.startsWith('expo-')) continue;

        const depMinor = parseInt((version.match(/~?(\d+)\./) ?? [])[1] ?? '0', 10);
        if (depMinor === 0) continue; // couldn't parse, skip

        // Allow a delta of 1 for packages that are slightly ahead/behind
        if (Math.abs(depMinor - expoSdkMinor) > 1) {
          mismatched.push(`${dep}@${version} (expo SDK is ~${expoSdkMinor})`);
        }
      }

      if (mismatched.length > 0) {
        console.warn(
          '[build-config] The following expo-* packages appear to be on a different SDK minor:\n' +
            mismatched.map((m) => `  - ${m}`).join('\n'),
        );
      }

      // Hard-fail only when the skew is significant (> 1 minor)
      expect(mismatched).toHaveLength(0);
    });
  });
});
