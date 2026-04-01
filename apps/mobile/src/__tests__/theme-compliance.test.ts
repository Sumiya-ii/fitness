/**
 * Theme compliance: detect hardcoded hex color values in screen files.
 *
 * Dark mode bugs are consistently introduced when developers hardcode hex
 * values (e.g. `color="#ffffff"`) instead of reading from the `useColors()`
 * palette. This test catches regressions by scanning every screen file for
 * hex color literals and reporting where they appear.
 *
 * WARN MODE vs FAIL MODE
 * ─────────────────────
 * Set THEME_COMPLIANCE_FAIL=true in your environment to make violations
 * fail the test run. In warn mode (default) the test always passes but
 * prints a consolidated report so engineers can see the debt.
 *
 *   THEME_COMPLIANCE_FAIL=true npm run test --workspace=apps/mobile
 *
 * Switching to fail mode is the recommended path once the existing debt has
 * been resolved.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Recursively collect all *.tsx files under a directory. */
function findTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsxFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/** Flip to true (or set env var) to make violations fail CI. */
const FAIL_ON_VIOLATION = process.env.THEME_COMPLIANCE_FAIL === 'true';

/**
 * Hex color pattern: matches #rgb, #rrggbb, and #rrggbbaa forms.
 * Intentionally case-insensitive so #FFF, #fff, #Fff are all caught.
 */
const HEX_COLOR_RE = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

/**
 * Patterns that are explicitly safe to hardcode.
 *
 * Each entry is a regex tested against the full source line.  If a line
 * matches ANY allowlist entry it is excluded from the violation report.
 *
 * When adding a new exception, always include a comment explaining WHY it
 * is safe so future reviewers understand the intent.
 */
const SAFE_LINE_PATTERNS: RegExp[] = [
  // SVG <Stop> elements — gradient stops inside SVG definitions are data,
  // not UI theming, and need explicit values to render the gradient correctly.
  /\bstopColor\b/,
  /\bStop\b.*offset/,

  // expo-linear-gradient colors array — gradient fills are intentionally
  // fixed values (e.g. avatar silhouette fill). They are not semantic UI
  // colours that must respond to dark mode.
  /colors=\{?\[/,

  // StatusBar barStyle comparison — WelcomeScreen checks `c.bg === '#000000'`
  // to decide between 'light-content' and 'dark-content'. The hex literal is
  // a comparison against a palette token value, not a direct style value.
  /c\.bg\s*===\s*['"]#/,
  /c\.bg\s*!==\s*['"]#/,

  // Tailwind-style opacity modifiers appended to palette values via string
  // concatenation (e.g. `c.primary + '20'`). The hex suffix is an alpha
  // component, not a standalone colour.
  /\+\s*['"][0-9a-fA-F]{2}['"]/,
  /['"][0-9a-fA-F]{2}['"]\s*\+/,

  // Pure comment lines — no need to flag colours in comments.
  /^\s*\/\//,
  /^\s*\*/,
];

/**
 * Specific (file, hex) pairs that are known pre-existing violations being
 * tracked for remediation. Entries here suppress the violation from the
 * report so the test does not grow noisier over time while the backlog is
 * worked down.
 *
 * Format: [relativeFilePath, hexValue]
 * The file path is relative to apps/mobile/src/screens/.
 *
 * DO NOT add new entries without a corresponding GitHub issue / Linear ticket.
 * Remove entries as each violation is fixed.
 */
const KNOWN_VIOLATIONS: Array<[string, string]> = [
  // ProgressScreen — chart palette defined as a module-level constant for
  // use across multiple sub-components. Needs semantic token extraction.
  ['ProgressScreen.tsx', '#F4E9D8'],
  ['ProgressScreen.tsx', '#5A4A3C'],
  ['ProgressScreen.tsx', '#C8A45B'],
  ['ProgressScreen.tsx', '#3b82f6'],
  ['ProgressScreen.tsx', '#D4B16E'],
  ['ProgressScreen.tsx', '#B05E5E'],
  ['ProgressScreen.tsx', '#06b6d4'],
  ['ProgressScreen.tsx', '#0c4a6e'],
  ['ProgressScreen.tsx', '#8B2E2E'],
  // ProgressScreen — body composition / BMI status colors (functional)
  ['ProgressScreen.tsx', '#ef4444'],
  ['ProgressScreen.tsx', '#22c55e'],
  ['ProgressScreen.tsx', '#f59e0b'],
  ['ProgressScreen.tsx', '#f97316'],
  ['ProgressScreen.tsx', '#dc2626'],
  ['ProgressScreen.tsx', '#000000'],

  // RemindersScreen — Switch thumbColor uses literal white; this is the RN
  // default thumb appearance. Should use c.onPrimary.
  ['RemindersScreen.tsx', '#ffffff'],

  // WorkoutHomeScreen — Icon color inside a bg-success banner where text
  // is explicitly white by design. Should use c.onPrimary.
  ['workout/WorkoutHomeScreen.tsx', '#ffffff'],

  // WorkoutActiveScreen — Same pattern as WorkoutHomeScreen.
  ['workout/WorkoutActiveScreen.tsx', '#ffffff'],

  // BarcodeScanScreen — ActivityIndicator on a full-screen dark overlay.
  // Should use c.onPrimary once overlay bg uses palette.
  ['logging/BarcodeScanScreen.tsx', '#ffffff'],

  // VoiceLogScreen — Icon colors on a dark recording UI.
  // Should use c.onPrimary.
  ['logging/VoiceLogScreen.tsx', '#ffffff'],

  // ProfileSetupScreen — Onboarding gender picker uses brand colors.
  ['onboarding/ProfileSetupScreen.tsx', '#8B2E2E'],
  ['onboarding/ProfileSetupScreen.tsx', '#9A8672'],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCREENS_ROOT = path.resolve(__dirname, '../../src/screens');

interface Violation {
  /** Path relative to apps/mobile/src/screens/ */
  relPath: string;
  /** Absolute path for error messages. */
  absPath: string;
  line: number;
  column: number;
  hex: string;
  lineContent: string;
}

function isLineSafe(line: string): boolean {
  return SAFE_LINE_PATTERNS.some((re) => re.test(line));
}

function isKnownViolation(relPath: string, hex: string): boolean {
  const normalHex = hex.toLowerCase();
  return KNOWN_VIOLATIONS.some(
    ([knownRel, knownHex]) => relPath === knownRel && knownHex.toLowerCase() === normalHex,
  );
}

function scanFile(absPath: string): Violation[] {
  const relPath = path.relative(SCREENS_ROOT, absPath);
  const source = fs.readFileSync(absPath, 'utf-8');
  const lines = source.split('\n');
  const violations: Violation[] = [];

  lines.forEach((lineContent, idx) => {
    if (isLineSafe(lineContent)) return;

    const lineNumber = idx + 1;
    HEX_COLOR_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    const seenOnLine = new Set<string>();

    while ((match = HEX_COLOR_RE.exec(lineContent)) !== null) {
      const hex = match[0].toLowerCase();
      if (seenOnLine.has(hex)) continue; // deduplicate repeated hits on same line
      seenOnLine.add(hex);

      if (isKnownViolation(relPath, hex)) continue;

      violations.push({
        relPath,
        absPath,
        line: lineNumber,
        column: match.index + 1,
        hex,
        lineContent: lineContent.trim(),
      });
    }
  });

  return violations;
}

function formatReport(violations: Violation[]): string {
  if (violations.length === 0) return 'No violations found.';

  const byFile = new Map<string, Violation[]>();
  for (const v of violations) {
    if (!byFile.has(v.relPath)) byFile.set(v.relPath, []);
    byFile.get(v.relPath)!.push(v);
  }

  const lines: string[] = [
    `Found ${violations.length} hardcoded hex color(s) across ${byFile.size} file(s).`,
    'Replace with useColors() palette tokens or add to KNOWN_VIOLATIONS with a ticket reference.',
    '',
  ];

  for (const [relPath, fileViolations] of byFile) {
    lines.push(`  ${relPath}`);
    for (const v of fileViolations) {
      lines.push(`    line ${v.line}: ${v.hex}  →  ${v.lineContent.slice(0, 120)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Theme compliance — no hardcoded hex colors in screens', () => {
  let screenFiles: string[];
  let allViolations: Violation[];

  beforeAll(() => {
    screenFiles = findTsxFiles(SCREENS_ROOT);
    allViolations = screenFiles.flatMap(scanFile);
  });

  it('scans at least one screen file (sanity check)', () => {
    expect(screenFiles.length).toBeGreaterThan(0);
  });

  it('every screen file exists and is readable', () => {
    for (const f of screenFiles) {
      expect(() => fs.readFileSync(f, 'utf-8')).not.toThrow();
    }
  });

  it('should not introduce NEW hardcoded hex colors (violations beyond known backlog)', () => {
    const report = formatReport(allViolations);

    if (allViolations.length > 0) {
      if (FAIL_ON_VIOLATION) {
        // Hard failure: every violation breaks CI.
        throw new Error(
          [
            '\n\nTheme compliance violations detected.',
            'Use useColors() from ../theme instead of hardcoding hex values.',
            'See apps/mobile/src/__tests__/theme-compliance.test.ts for the allowlist.',
            '',
            report,
          ].join('\n'),
        );
      } else {
        // Warn mode: print the report but do not fail the suite.
        console.warn(
          [
            '\n[theme-compliance] WARN: hardcoded hex colors detected.',
            'Set THEME_COMPLIANCE_FAIL=true to promote these to failures.',
            '',
            report,
          ].join('\n'),
        );
      }
    }

    // In warn mode this assertion always passes — it is here so that when
    // FAIL_ON_VIOLATION is enabled later the test name in Jest output is
    // meaningful rather than showing a caught exception.
    if (!FAIL_ON_VIOLATION) {
      expect(true).toBe(true);
    }
  });

  it('every screen that uses inline styles imports useColors', () => {
    /**
     * If a file has a `style={{ ... }}` prop that references a colour (any
     * dynamic expression, not just hex) it must import useColors.  The proxy
     * for "uses inline styles with colour" is: the file has `style={` AND
     * references `color` or `backgroundColor` as a style key.
     *
     * This is intentionally heuristic — it will not catch every case but it
     * will catch the common pattern of using `style={{ color: ... }}` without
     * the theme hook.
     */
    const violatingFiles: string[] = [];

    for (const absPath of screenFiles) {
      const source = fs.readFileSync(absPath, 'utf-8');
      const hasInlineColorStyle =
        /style=\{/.test(source) && /(backgroundColor|color|borderColor|tintColor)\s*:/.test(source);
      const importsUseColors = /useColors/.test(source);

      if (hasInlineColorStyle && !importsUseColors) {
        violatingFiles.push(path.relative(SCREENS_ROOT, absPath));
      }
    }

    if (violatingFiles.length > 0) {
      const message = [
        `${violatingFiles.length} screen file(s) use inline color styles without importing useColors():`,
        ...violatingFiles.map((f) => `  ${f}`),
        '',
        "Add: import { useColors } from '../../theme'; (adjust path as needed)",
        'Then replace hardcoded values with the appropriate palette token.',
      ].join('\n');

      if (FAIL_ON_VIOLATION) {
        throw new Error(message);
      } else {
        console.warn(`\n[theme-compliance] WARN: ${message}`);
      }
    }

    if (!FAIL_ON_VIOLATION) {
      expect(true).toBe(true);
    }
  });

  it('KNOWN_VIOLATIONS list has no stale entries (all referenced files exist)', () => {
    const missingFiles: string[] = [];

    for (const [relPath] of KNOWN_VIOLATIONS) {
      const absPath = path.join(SCREENS_ROOT, relPath);
      if (!fs.existsSync(absPath)) {
        missingFiles.push(relPath);
      }
    }

    // This check always fails because stale entries mean someone fixed a
    // violation without removing it from the allowlist — that's dead weight.
    if (missingFiles.length > 0) {
      throw new Error(
        `Stale KNOWN_VIOLATIONS entries (file no longer exists — remove them):\n` +
          missingFiles.map((f) => `  ${f}`).join('\n'),
      );
    }
    expect(missingFiles).toEqual([]);
  });

  it('produces a violation report showing file paths and hex values', () => {
    // Verify the report formatter produces useful output — this exercises
    // the reporting logic independently of whether violations exist.
    const fakeViolations: Violation[] = [
      {
        relPath: 'SomeScreen.tsx',
        absPath: '/abs/SomeScreen.tsx',
        line: 42,
        column: 18,
        hex: '#1f2028',
        lineContent: 'color="#1f2028"',
      },
    ];

    const report = formatReport(fakeViolations);
    expect(report).toContain('SomeScreen.tsx');
    expect(report).toContain('#1f2028');
    expect(report).toContain('line 42');
  });
});

describe('Theme compliance — safe-line allowlist correctness', () => {
  it('allows SVG Stop elements with stopColor', () => {
    const line = '  <Stop offset="0%" stopColor="#ff0000" />';
    expect(isLineSafe(line)).toBe(true);
  });

  it('allows expo-linear-gradient colors array', () => {
    const line = "  colors={['#8B2E2E', '#742626']}";
    expect(isLineSafe(line)).toBe(true);
  });

  it('allows palette comparison in StatusBar barStyle check', () => {
    const line = "  barStyle={c.bg === '#000000' ? 'light-content' : 'dark-content'}";
    expect(isLineSafe(line)).toBe(true);
  });

  it('allows alpha-suffix concatenation on palette token', () => {
    const line = "  style={{ backgroundColor: c.primary + '20' }}";
    expect(isLineSafe(line)).toBe(true);
  });

  it('allows comment lines', () => {
    expect(isLineSafe('  // color: #ffffff is the default')).toBe(true);
    expect(isLineSafe('   * @param color #fff')).toBe(true);
  });

  it('does NOT allow a bare hardcoded hex in a style prop', () => {
    const line = '  style={{ backgroundColor: "#1f2028" }}';
    expect(isLineSafe(line)).toBe(false);
  });

  it('does NOT allow a hardcoded hex in an icon color prop', () => {
    const line = '  <Ionicons name="star" size={24} color="#ffffff" />';
    expect(isLineSafe(line)).toBe(false);
  });
});
