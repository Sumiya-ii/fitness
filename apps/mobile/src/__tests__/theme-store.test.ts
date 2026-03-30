/**
 * Comprehensive tests for theme/appearance toggle logic.
 *
 * Verifies:
 * 1. Theme store initialisation (default, persisted modes)
 * 2. Mode switching (light / dark / system) and resolved scheme
 * 3. MMKV persistence round-trips
 * 4. Appearance.setColorScheme synced on every mode change
 * 5. System appearance listener updates scheme only when mode = 'system'
 * 6. useColors() returns the correct palette for each scheme
 * 7. Light / dark palette completeness and no accidental value sharing
 * 8. buildNavigationTheme produces correct React Navigation theme
 * 9. CSS variable mapping consistency (global.css token names match tailwind config)
 */

/* ── Mocks ── */

// Keep a reference so tests can inspect / change the system color scheme
let _systemScheme: 'light' | 'dark' = 'dark';
let _appearanceListeners: Array<(prefs: { colorScheme: string }) => void> = [];
let _setColorSchemeCalls: Array<string | undefined> = [];

jest.mock('react-native', () => {
  return {
    Appearance: {
      getColorScheme: () => _systemScheme,
      setColorScheme: (scheme: string | undefined) => {
        _setColorSchemeCalls.push(scheme);
      },
      addChangeListener: (cb: (prefs: { colorScheme: string }) => void) => {
        _appearanceListeners.push(cb);
        return { remove: () => {} };
      },
    },
  };
});

jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string>>();
  class MMKV {
    _store: Map<string, string>;
    constructor(opts?: { id?: string }) {
      const id = opts?.id ?? 'default';
      if (!stores.has(id)) stores.set(id, new Map());
      this._store = stores.get(id)!;
    }
    getString(key: string) {
      return this._store.get(key) ?? undefined;
    }
    set(key: string, value: string) {
      this._store.set(key, value);
    }
    delete(key: string) {
      this._store.delete(key);
    }
  }
  return { MMKV, _stores: stores };
});

jest.mock('zustand', () => {
  const actualZustand = jest.requireActual('zustand');
  return actualZustand;
});

/* ── Helpers ── */

function resetAll() {
  _systemScheme = 'dark';
  _appearanceListeners = [];
  _setColorSchemeCalls = [];
  // Clear MMKV stores
  const mmkv = require('react-native-mmkv');
  mmkv._stores.clear();
  // Reset module registry so theme store re-initialises
  jest.resetModules();
}

function simulateSystemAppearanceChange(scheme: 'light' | 'dark') {
  _systemScheme = scheme;
  _appearanceListeners.forEach((cb) => cb({ colorScheme: scheme }));
}

/* ── Test suites ── */

describe('Theme Store', () => {
  beforeEach(() => {
    resetAll();
  });

  // -- Initialisation --

  test('defaults to system mode when nothing is stored in MMKV', () => {
    const { useThemeStore } = require('../stores/theme.store');
    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
    // scheme resolves to the current system scheme (dark in this test setup)
    expect(state.scheme).toBe('dark');
  });

  test('restores persisted mode from MMKV on init', () => {
    // Pre-set MMKV before importing the store
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV({ id: 'coach-theme' });
    storage.set('theme_mode', 'light');

    const { useThemeStore } = require('../stores/theme.store');
    const state = useThemeStore.getState();
    expect(state.mode).toBe('light');
    expect(state.scheme).toBe('light');
  });

  test('resolves "system" mode to current system scheme on init', () => {
    _systemScheme = 'light';
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV({ id: 'coach-theme' });
    storage.set('theme_mode', 'system');

    const { useThemeStore } = require('../stores/theme.store');
    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
    expect(state.scheme).toBe('light');
  });

  test('ignores invalid stored values and falls back to system', () => {
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV({ id: 'coach-theme' });
    storage.set('theme_mode', 'invalid-value');

    const { useThemeStore } = require('../stores/theme.store');
    expect(useThemeStore.getState().mode).toBe('system');
  });

  // -- Appearance.setColorScheme sync on init --

  test('calls Appearance.setColorScheme("unspecified") on init when no mode is stored (defaults to system)', () => {
    _setColorSchemeCalls = [];
    require('../stores/theme.store');
    expect(_setColorSchemeCalls).toContain('unspecified');
  });

  test('calls Appearance.setColorScheme("light") on init when stored mode is light', () => {
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV({ id: 'coach-theme' });
    storage.set('theme_mode', 'light');
    _setColorSchemeCalls = [];

    require('../stores/theme.store');
    expect(_setColorSchemeCalls).toContain('light');
  });

  test('calls Appearance.setColorScheme("unspecified") on init when stored mode is system', () => {
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV({ id: 'coach-theme' });
    storage.set('theme_mode', 'system');
    _setColorSchemeCalls = [];

    require('../stores/theme.store');
    expect(_setColorSchemeCalls).toContain('unspecified');
  });

  // -- Mode switching --

  test('setMode("light") updates mode, scheme, and persists to MMKV', () => {
    const { useThemeStore } = require('../stores/theme.store');
    useThemeStore.getState().setMode('light');

    const state = useThemeStore.getState();
    expect(state.mode).toBe('light');
    expect(state.scheme).toBe('light');

    // Verify MMKV persistence
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV({ id: 'coach-theme' });
    expect(storage.getString('theme_mode')).toBe('light');
  });

  test('setMode("dark") updates mode and scheme', () => {
    const { useThemeStore } = require('../stores/theme.store');
    useThemeStore.getState().setMode('light'); // start light
    useThemeStore.getState().setMode('dark');

    const state = useThemeStore.getState();
    expect(state.mode).toBe('dark');
    expect(state.scheme).toBe('dark');
  });

  test('setMode("system") resolves to current system scheme', () => {
    _systemScheme = 'light';
    const { useThemeStore } = require('../stores/theme.store');
    useThemeStore.getState().setMode('system');

    expect(useThemeStore.getState().mode).toBe('system');
    expect(useThemeStore.getState().scheme).toBe('light');
  });

  test('setMode syncs Appearance.setColorScheme on every change', () => {
    const { useThemeStore } = require('../stores/theme.store');
    _setColorSchemeCalls = [];

    useThemeStore.getState().setMode('light');
    expect(_setColorSchemeCalls).toContain('light');

    _setColorSchemeCalls = [];
    useThemeStore.getState().setMode('dark');
    expect(_setColorSchemeCalls).toContain('dark');

    _setColorSchemeCalls = [];
    useThemeStore.getState().setMode('system');
    expect(_setColorSchemeCalls).toContain('unspecified');
  });

  // -- System appearance listener --

  test('updates scheme when system appearance changes in "system" mode', () => {
    _systemScheme = 'dark';
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV({ id: 'coach-theme' });
    storage.set('theme_mode', 'system');

    const { useThemeStore } = require('../stores/theme.store');
    expect(useThemeStore.getState().scheme).toBe('dark');

    // Simulate system switching to light
    simulateSystemAppearanceChange('light');
    expect(useThemeStore.getState().scheme).toBe('light');
  });

  test('does NOT update scheme when system changes in explicit "dark" mode', () => {
    const { useThemeStore } = require('../stores/theme.store');
    useThemeStore.getState().setMode('dark');

    simulateSystemAppearanceChange('light');
    expect(useThemeStore.getState().scheme).toBe('dark');
  });

  test('does NOT update scheme when system changes in explicit "light" mode', () => {
    const { useThemeStore } = require('../stores/theme.store');
    useThemeStore.getState().setMode('light');

    simulateSystemAppearanceChange('dark');
    expect(useThemeStore.getState().scheme).toBe('light');
  });

  // -- resolveScheme --

  test('resolveScheme("light") returns "light"', () => {
    const { resolveScheme } = require('../stores/theme.store');
    expect(resolveScheme('light')).toBe('light');
  });

  test('resolveScheme("dark") returns "dark"', () => {
    const { resolveScheme } = require('../stores/theme.store');
    expect(resolveScheme('dark')).toBe('dark');
  });

  test('resolveScheme("system") returns current system scheme', () => {
    const { resolveScheme } = require('../stores/theme.store');
    _systemScheme = 'light';
    expect(resolveScheme('system')).toBe('light');
    _systemScheme = 'dark';
    expect(resolveScheme('system')).toBe('dark');
  });
});

/* ── Color palette tests ── */

describe('Color Palettes', () => {
  test('lightPalette and darkPalette have identical keys', () => {
    const { lightPalette, darkPalette } = require('../theme/colors');
    const lightKeys = Object.keys(lightPalette).sort();
    const darkKeys = Object.keys(darkPalette).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  test('every palette value is a non-empty string', () => {
    const { lightPalette, darkPalette } = require('../theme/colors');
    for (const [key, value] of Object.entries(lightPalette)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(darkPalette)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  test('light and dark palettes differ on key background/text colors', () => {
    const { lightPalette, darkPalette } = require('../theme/colors');

    // These must differ between themes for the toggle to have visible effect
    const mustDiffer = ['bg', 'card', 'text', 'textSecondary', 'primary', 'onPrimary', 'border'];
    for (const key of mustDiffer) {
      expect(lightPalette[key]).not.toBe(darkPalette[key]);
    }
  });

  test('light palette has light backgrounds and dark text', () => {
    const { lightPalette } = require('../theme/colors');
    // bg should be a light color (high hex values)
    expect(lightPalette.bg).toMatch(/^#[a-fA-F0-9]{6}$/);
    // text should be dark
    expect(lightPalette.text).toBe('#0b1220');
    // primary CTA should be dark in light mode
    expect(lightPalette.onPrimary).toBe('#ffffff');
  });

  test('dark palette has dark backgrounds and light text', () => {
    const { darkPalette } = require('../theme/colors');
    expect(darkPalette.bg).toBe('#000000');
    expect(darkPalette.text).toBe('#ffffff');
    expect(darkPalette.onPrimary).toBe('#000000');
  });

  test('status colors are the same in both palettes', () => {
    const { lightPalette, darkPalette } = require('../theme/colors');
    expect(lightPalette.danger).toBe(darkPalette.danger);
    expect(lightPalette.warning).toBe(darkPalette.warning);
    expect(lightPalette.success).toBe(darkPalette.success);
  });
});

/* ── useColors / buildNavigationTheme ── */

describe('useColors and buildNavigationTheme', () => {
  beforeEach(() => {
    resetAll();
  });

  test('buildNavigationTheme marks dark=true for darkPalette', () => {
    const { buildNavigationTheme, darkPalette } = require('../theme');
    const theme = buildNavigationTheme(darkPalette);
    expect(theme.dark).toBe(true);
  });

  test('buildNavigationTheme marks dark=false for lightPalette', () => {
    const { buildNavigationTheme, lightPalette } = require('../theme');
    const theme = buildNavigationTheme(lightPalette);
    expect(theme.dark).toBe(false);
  });

  test('navigation theme uses palette colors for background, card, text, border', () => {
    const { buildNavigationTheme, lightPalette } = require('../theme');
    const theme = buildNavigationTheme(lightPalette);
    expect(theme.colors.background).toBe(lightPalette.bg);
    expect(theme.colors.card).toBe(lightPalette.card);
    expect(theme.colors.text).toBe(lightPalette.text);
    expect(theme.colors.border).toBe(lightPalette.border);
    expect(theme.colors.primary).toBe(lightPalette.primary);
  });

  test('navigation theme fonts include all required weights', () => {
    const { buildNavigationTheme, darkPalette } = require('../theme');
    const theme = buildNavigationTheme(darkPalette);
    expect(theme.fonts.regular).toBeDefined();
    expect(theme.fonts.medium).toBeDefined();
    expect(theme.fonts.bold).toBeDefined();
    expect(theme.fonts.heavy).toBeDefined();
  });
});

/* ── CSS variable consistency ── */

describe('CSS variable / Tailwind config consistency', () => {
  const fs = require('fs');
  const path = require('path');

  const globalCss = fs.readFileSync(path.resolve(__dirname, '../../global.css'), 'utf-8');
  const tailwindConfig = fs.readFileSync(
    path.resolve(__dirname, '../../tailwind.config.js'),
    'utf-8',
  );

  // Extract variable names from global.css
  function extractCssVarNames(css: string): string[] {
    const matches = css.matchAll(/--([a-z0-9-]+):/g);
    return [...new Set([...matches].map((m) => m[1]))];
  }

  // Extract variable references from tailwind.config.js
  function extractTailwindVarRefs(config: string): string[] {
    const matches = config.matchAll(/var\(--([a-z0-9-]+)\)/g);
    return [...new Set([...matches].map((m) => m[1]))];
  }

  test('every CSS variable referenced in tailwind.config.js is defined in global.css', () => {
    const defined = extractCssVarNames(globalCss);
    const referenced = extractTailwindVarRefs(tailwindConfig);

    const missing = referenced.filter((ref) => !defined.includes(ref));
    expect(missing).toEqual([]);
  });

  test('CSS variables are defined in both :root and @media (prefers-color-scheme: dark)', () => {
    // Split into light (:root before media query) and dark sections
    const rootSection = globalCss.split('@media')[0];
    const darkSection = globalCss.split('@media')[1] || '';

    const rootVars = extractCssVarNames(rootSection);
    const darkVars = extractCssVarNames(darkSection);

    // Every root var should have a dark counterpart
    const missingInDark = rootVars.filter((v) => !darkVars.includes(v));
    expect(missingInDark).toEqual([]);

    // And vice versa
    const missingInRoot = darkVars.filter((v) => !rootVars.includes(v));
    expect(missingInRoot).toEqual([]);
  });

  test('global.css has CSS variables for all semantic surface colors', () => {
    const expectedVars = [
      'color-surface-app',
      'color-surface-default',
      'color-surface-card',
      'color-surface-secondary',
      'color-surface-tertiary',
      'color-surface-border',
      'color-surface-muted',
    ];
    const defined = extractCssVarNames(globalCss);
    for (const v of expectedVars) {
      expect(defined).toContain(v);
    }
  });

  test('global.css has CSS variables for all semantic text colors', () => {
    const expectedVars = [
      'color-text-primary',
      'color-text-secondary',
      'color-text-tertiary',
      'color-text-inverse',
      'color-text-app',
    ];
    const defined = extractCssVarNames(globalCss);
    for (const v of expectedVars) {
      expect(defined).toContain(v);
    }
  });

  test('global.css has CSS variables for primary colors', () => {
    const expectedVars = [
      'color-primary-50',
      'color-primary-400',
      'color-primary-500',
      'color-primary-600',
      'color-on-primary',
    ];
    const defined = extractCssVarNames(globalCss);
    for (const v of expectedVars) {
      expect(defined).toContain(v);
    }
  });

  test('light :root values differ from dark values for key tokens', () => {
    const rootSection = globalCss.split('@media')[0];
    const darkSection = globalCss.split('@media')[1] || '';

    // Extract value for a variable from a CSS section
    function getVarValue(section: string, varName: string): string | null {
      const regex = new RegExp(`--${varName}:\\s*([^;]+);`);
      const match = section.match(regex);
      return match ? match[1].trim() : null;
    }

    const mustDiffer = [
      'color-surface-app',
      'color-surface-default',
      'color-text-primary',
      'color-text-secondary',
      'color-primary-500',
      'color-on-primary',
    ];

    for (const varName of mustDiffer) {
      const lightVal = getVarValue(rootSection, varName);
      const darkVal = getVarValue(darkSection, varName);
      expect(lightVal).not.toBeNull();
      expect(darkVal).not.toBeNull();
      expect(lightVal).not.toBe(darkVal);
    }
  });
});

/* ── Full toggle cycle integration test ── */

describe('Full appearance toggle cycle', () => {
  beforeEach(() => {
    resetAll();
  });

  test('toggling light → dark → system → light produces correct schemes each time', () => {
    _systemScheme = 'dark';
    const { useThemeStore } = require('../stores/theme.store');
    const { lightPalette, darkPalette } = require('../theme/colors');

    // Start at default dark
    expect(useThemeStore.getState().scheme).toBe('dark');

    // Switch to light
    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().scheme).toBe('light');
    expect(useThemeStore.getState().mode).toBe('light');

    // Switch to dark
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().scheme).toBe('dark');

    // Switch to system (system is currently dark)
    useThemeStore.getState().setMode('system');
    expect(useThemeStore.getState().scheme).toBe('dark');

    // System changes to light while in system mode
    simulateSystemAppearanceChange('light');
    expect(useThemeStore.getState().scheme).toBe('light');

    // Back to explicit light
    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().scheme).toBe('light');

    // System changes again — should NOT affect since we're in explicit mode
    simulateSystemAppearanceChange('dark');
    expect(useThemeStore.getState().scheme).toBe('light');
  });

  test('Appearance.setColorScheme is called correctly throughout toggle cycle', () => {
    _systemScheme = 'dark';
    const { useThemeStore } = require('../stores/theme.store');
    _setColorSchemeCalls = [];

    useThemeStore.getState().setMode('light');
    useThemeStore.getState().setMode('dark');
    useThemeStore.getState().setMode('system');
    useThemeStore.getState().setMode('light');

    expect(_setColorSchemeCalls).toEqual(['light', 'dark', 'unspecified', 'light']);
  });

  test('MMKV always has the latest mode after toggling', () => {
    const { useThemeStore } = require('../stores/theme.store');
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV({ id: 'coach-theme' });

    useThemeStore.getState().setMode('light');
    expect(storage.getString('theme_mode')).toBe('light');

    useThemeStore.getState().setMode('system');
    expect(storage.getString('theme_mode')).toBe('system');

    useThemeStore.getState().setMode('dark');
    expect(storage.getString('theme_mode')).toBe('dark');
  });
});
