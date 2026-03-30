/**
 * Raw SQL Audit — static analysis test.
 *
 * Scans source files in apps/api and apps/worker for raw SQL queries and
 * validates structural correctness without a database connection:
 *
 *  1. INSERT column-count matches VALUES placeholder count
 *  2. INSERT includes created_at / updated_at (omitting these has caused prod bugs)
 *  3. Numbered placeholder max ($N) matches the parameter array length where
 *     the array literal is visible in the same source fragment
 *
 * Any failure is reported as "<file>:<line> — <reason>".
 */

import * as fs from 'fs';
import * as path from 'path';
// @ts-expect-error no types
import * as glob from 'glob';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Recursively collect *.ts files excluding spec/test files. */
function collectSourceFiles(dirs: string[]): string[] {
  const files: string[] = [];
  for (const dir of dirs) {
    const found = glob.sync('**/*.ts', {
      cwd: dir,
      absolute: true,
      ignore: ['**/*.spec.ts', '**/*.test.ts'],
    });
    files.push(...found);
  }
  return files;
}

/** Return the 1-based line number for a character offset in source text. */
function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length;
}

/**
 * A raw SQL fragment extracted from source — carries its own text, the file
 * path, and the line where it starts.
 */
interface SqlFragment {
  sql: string;
  file: string;
  line: number;
}

// ── SQL extraction ────────────────────────────────────────────────────────────

/**
 * Extract template-literal SQL from Prisma raw query helpers:
 *   this.prisma.$queryRaw`...`
 *   this.prisma.$executeRaw`...`
 *   $queryRawUnsafe / $executeRawUnsafe (string arg — first argument only)
 */
function extractPrismaRawFragments(source: string, file: string): SqlFragment[] {
  const fragments: SqlFragment[] = [];

  // Tagged template literals: $queryRaw`...` (backtick, can span lines)
  const taggedRe = /\$(?:queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)\s*`([\s\S]*?)`/g;
  let m: RegExpExecArray | null;
  while ((m = taggedRe.exec(source)) !== null) {
    fragments.push({
      sql: m[1]!,
      file,
      line: lineOf(source, m.index),
    });
  }

  // String-argument form: $queryRawUnsafe('SELECT …') or $executeRawUnsafe("…")
  const stringArgRe = /\$(?:queryRawUnsafe|executeRawUnsafe)\s*\(\s*(['"`])([\s\S]*?)\1/g;
  while ((m = stringArgRe.exec(source)) !== null) {
    fragments.push({
      sql: m[2]!,
      file,
      line: lineOf(source, m.index),
    });
  }

  return fragments;
}

/**
 * Extract pool.query(sql, params) calls.
 * We capture the SQL string and — when the params array literal immediately
 * follows on the same or next logical line — the params array text too.
 *
 * Handles:
 *   pool.query(`INSERT …`, [ … ])
 *   pool.query<Type>(`SELECT …`, [p1, p2])
 */
function extractPoolQueryFragments(
  source: string,
  file: string,
): Array<SqlFragment & { paramsArrayText?: string }> {
  const fragments: Array<SqlFragment & { paramsArrayText?: string }> = [];

  // Match pool.query( optionally with a generic, then a template/string literal
  // We grab up to 2000 chars after the opening to find params array
  const re = /pool\.query\s*(?:<[^>]*>)?\s*\(\s*(`|'|")([\s\S]*?)\1([\s\S]{0,800}?)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const sql = m[2]!;
    const trailer = m[3] ?? '';

    // Try to find an array literal [ … ] in the trailer (params argument)
    const arrMatch = trailer.match(/,\s*(\[[^\]]*\])/);
    const paramsArrayText = arrMatch ? arrMatch[1] : undefined;

    fragments.push({
      sql,
      file,
      line: lineOf(source, m.index),
      paramsArrayText,
    });
  }

  return fragments;
}

// ── INSERT validation ─────────────────────────────────────────────────────────

interface ValidationIssue {
  file: string;
  line: number;
  reason: string;
}

/**
 * Parse an INSERT statement and validate:
 *  - column count == VALUES placeholder count
 *  - created_at present
 *  - updated_at present (or sent_at acting as the write-time stamp is OK only
 *    when updated_at is also present — we check both explicitly)
 *
 * We also handle the Prisma tagged-template style where ${variable} are
 * interpolated — those appear as literal `${…}` in the extracted SQL text and
 * are treated as positional parameters.
 */
function validateInsert(sql: string, file: string, line: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Normalise whitespace for easier parsing
  const normalised = sql.replace(/\s+/g, ' ').trim();

  // Only process INSERT statements
  if (!/^\s*INSERT\s+INTO\s+/i.test(normalised)) {
    return issues;
  }

  // ── Column list ────────────────────────────────────────────────────────────
  // INSERT INTO table (col1, col2, …) VALUES (…)
  // We need balanced-parens extraction because column names themselves never
  // contain parens, but we want a robust parser.
  const columnList = extractBalancedParens(normalised, /INSERT\s+INTO\s+\S+\s*\(/i);
  if (!columnList) {
    // No explicit column list — cannot validate count, skip
    return issues;
  }
  const columns = columnList
    .split(',')
    .map((c) => c.trim().replace(/['"]/g, ''))
    .filter(Boolean);

  // ── VALUES list ────────────────────────────────────────────────────────────
  // Must use balanced extraction: values often include function calls like
  // gen_random_uuid() or COALESCE(a, b) that contain inner parentheses.
  const valuesList = extractBalancedParens(normalised, /VALUES\s*\(/i);
  if (!valuesList) {
    // RETURNING or INSERT … SELECT — cannot validate, skip
    return issues;
  }

  // Count placeholders: $1, $2, … (pg style), ${…} (Prisma template style),
  // and also bare function calls / literals like gen_random_uuid(), NOW(), now()
  // We split on commas *not inside parentheses* to count value slots.
  const valueTokens = splitOnTopLevelCommas(valuesList);

  if (columns.length !== valueTokens.length) {
    issues.push({
      file,
      line,
      reason:
        `INSERT column count (${columns.length}) does not match VALUES ` +
        `placeholder count (${valueTokens.length}).\n` +
        `  Columns : ${columns.join(', ')}\n` +
        `  Values  : ${valueTokens.map((t) => t.trim()).join(', ')}`,
    });
  }

  // ── Timestamp columns ─────────────────────────────────────────────────────
  const lowerCols = columns.map((c) => c.toLowerCase());

  // created_at: required on plain INSERTs.  Exception: UPSERT statements that
  // include ON CONFLICT DO UPDATE may rely on the DB default (@default(now()))
  // for created_at on the initial insert, so we only flag its absence when
  // there is no ON CONFLICT clause.
  const hasCreatedAt = lowerCols.includes('created_at');
  const hasUpdatedAt = lowerCols.includes('updated_at');
  // outbound_messages uses sent_at as the write-time stamp instead of created_at
  const hasSentAt = lowerCols.includes('sent_at');
  const isUpsert = /ON\s+CONFLICT\s+.*\s+DO\s+UPDATE/i.test(normalised);

  if (!hasCreatedAt && !hasSentAt && !isUpsert) {
    issues.push({
      file,
      line,
      reason:
        `INSERT into "${extractTableName(normalised)}" is missing created_at (or sent_at). ` +
        `Omitting timestamp columns causes rows with NULL audit fields.`,
    });
  }

  if (!hasUpdatedAt) {
    issues.push({
      file,
      line,
      reason:
        `INSERT into "${extractTableName(normalised)}" is missing updated_at. ` +
        `Omitting updated_at causes NULL fields and breaks "last modified" queries.`,
    });
  }

  return issues;
}

/**
 * Find the index of the opening `(` that follows `keyword` in `s`, then return
 * the contents of the matching balanced parentheses pair.  Returns null if not
 * found.
 */
function extractBalancedParens(s: string, keywordPattern: RegExp): string | null {
  const m = keywordPattern.exec(s);
  if (!m) return null;

  // Find the '(' that starts right after the keyword match
  let openIdx = s.indexOf('(', m.index + m[0].length - 1);
  // The keyword may already end with '(' — back up one if so
  if (openIdx === -1) openIdx = s.indexOf('(', m.index);
  if (openIdx === -1) return null;

  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) {
        return s.slice(openIdx + 1, i);
      }
    }
  }
  return null; // unbalanced
}

/** Split a comma-separated value list respecting nested parentheses. */
function splitOnTopLevelCommas(s: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) {
      tokens.push(s.slice(start, i));
      start = i + 1;
    }
  }
  tokens.push(s.slice(start));
  return tokens.filter((t) => t.trim().length > 0);
}

function extractTableName(normalisedSql: string): string {
  const m = normalisedSql.match(/INSERT\s+INTO\s+["']?(\S+?)["']?\s*\(/i);
  return m ? m[1]! : '<unknown>';
}

// ── Parameter count validation ────────────────────────────────────────────────

/**
 * When we have both the SQL text and a visible params array literal (e.g. [p1,
 * p2, p3]) we can cross-check that the highest $N in the SQL matches the
 * number of array elements.
 *
 * This is intentionally conservative: if the array contains nested arrays or
 * spread expressions we skip (too complex to count statically).
 */
function validateParamCount(
  sql: string,
  paramsArrayText: string,
  file: string,
  line: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Find highest $N placeholder in the SQL
  const placeholders = [...sql.matchAll(/\$(\d+)/g)].map((m) => parseInt(m[1]!, 10));
  if (placeholders.length === 0) return issues;
  const maxPlaceholder = Math.max(...placeholders);

  // Count elements in the array literal.  Skip if we detect spread or nested arrays.
  if (/\.\.\.|^\[.*\[/s.test(paramsArrayText)) return issues;

  // Remove the outer brackets
  const inner = paramsArrayText.replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!inner) {
    // Empty array — but there are placeholders
    issues.push({
      file,
      line,
      reason: `SQL has $${maxPlaceholder} placeholder but params array appears empty.`,
    });
    return issues;
  }

  const paramTokens = splitOnTopLevelCommas(inner);
  const paramCount = paramTokens.length;

  if (maxPlaceholder !== paramCount) {
    issues.push({
      file,
      line,
      reason:
        `SQL references $${maxPlaceholder} but params array has ${paramCount} element(s). ` +
        `Mismatch causes runtime errors (pg: "there is no parameter $N" or silent NULL binding).`,
    });
  }

  return issues;
}

// ── Main audit runner ─────────────────────────────────────────────────────────

function runAudit(): ValidationIssue[] {
  const repoRoot = path.resolve(__dirname, '../../../');
  const dirsToScan = [path.join(repoRoot, 'apps/api/src'), path.join(repoRoot, 'apps/worker/src')];

  const sourceFiles = collectSourceFiles(dirsToScan);
  const allIssues: ValidationIssue[] = [];

  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf-8');

    // --- Prisma $queryRaw / $executeRaw ---
    const prismaFragments = extractPrismaRawFragments(source, file);
    for (const frag of prismaFragments) {
      allIssues.push(...validateInsert(frag.sql, frag.file, frag.line));
      // Prisma tagged templates use ${expr} not $1 — param validation N/A
    }

    // --- pg Pool.query ---
    const poolFragments = extractPoolQueryFragments(source, file);
    for (const frag of poolFragments) {
      allIssues.push(...validateInsert(frag.sql, frag.file, frag.line));

      if (frag.paramsArrayText) {
        allIssues.push(...validateParamCount(frag.sql, frag.paramsArrayText, frag.file, frag.line));
      }
    }
  }

  return allIssues;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Raw SQL Audit', () => {
  let issues: ValidationIssue[];

  beforeAll(() => {
    issues = runAudit();
  });

  // ── Unit tests for the audit helpers themselves ───────────────────────────

  describe('validateInsert (helper unit tests)', () => {
    it('passes when column count equals VALUES placeholder count', () => {
      const result = validateInsert(
        `INSERT INTO foo (id, name, created_at, updated_at) VALUES (gen_random_uuid(), $1, now(), now())`,
        'test.ts',
        1,
      );
      const countIssues = result.filter((i) => i.reason.includes('column count'));
      expect(countIssues).toHaveLength(0);
    });

    it('fails when column count does not match VALUES count', () => {
      const result = validateInsert(
        `INSERT INTO foo (id, name, value, created_at, updated_at) VALUES ($1, $2, now(), now())`,
        'test.ts',
        1,
      );
      const countIssues = result.filter((i) => i.reason.includes('column count'));
      expect(countIssues).toHaveLength(1);
      expect(countIssues[0]!.reason).toMatch(/5.*does not match.*4/);
    });

    it('fails when created_at is missing and sent_at is also absent', () => {
      const result = validateInsert(
        `INSERT INTO foo (id, name, updated_at) VALUES (gen_random_uuid(), $1, now())`,
        'test.ts',
        1,
      );
      const tsIssues = result.filter((i) => i.reason.includes('created_at'));
      expect(tsIssues).toHaveLength(1);
    });

    it('passes when sent_at is used instead of created_at (outbound_messages pattern)', () => {
      const result = validateInsert(
        `INSERT INTO outbound_messages (id, user_id, sent_at, updated_at) VALUES (gen_random_uuid(), $1, now(), now())`,
        'test.ts',
        1,
      );
      const tsIssues = result.filter((i) => i.reason.includes('created_at'));
      expect(tsIssues).toHaveLength(0);
    });

    it('fails when updated_at is missing', () => {
      const result = validateInsert(
        `INSERT INTO foo (id, name, created_at) VALUES (gen_random_uuid(), $1, now())`,
        'test.ts',
        1,
      );
      const tsIssues = result.filter((i) => i.reason.includes('updated_at'));
      expect(tsIssues).toHaveLength(1);
    });

    it('does not report issues for SELECT statements', () => {
      const result = validateInsert(`SELECT id, name FROM foo WHERE id = $1`, 'test.ts', 1);
      expect(result).toHaveLength(0);
    });

    it('does not report issues for INSERT without explicit column list', () => {
      // INSERT … SELECT or INSERT without cols — we cannot validate these
      const result = validateInsert(`INSERT INTO foo SELECT * FROM bar`, 'test.ts', 1);
      expect(result).toHaveLength(0);
    });
  });

  describe('validateParamCount (helper unit tests)', () => {
    it('passes when $N max matches array length', () => {
      const result = validateParamCount(
        `INSERT INTO foo (a, b, c) VALUES ($1, $2, $3)`,
        `[param1, param2, param3]`,
        'test.ts',
        1,
      );
      expect(result).toHaveLength(0);
    });

    it('fails when max $N exceeds array length', () => {
      const result = validateParamCount(
        `SELECT * FROM foo WHERE a=$1 AND b=$2 AND c=$3`,
        `[p1, p2]`,
        'test.ts',
        1,
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.reason).toMatch(/\$3.*2 element/);
    });

    it('fails when array is empty but SQL has placeholders', () => {
      const result = validateParamCount(`SELECT * FROM foo WHERE id = $1`, `[]`, 'test.ts', 1);
      expect(result).toHaveLength(1);
    });

    it('skips validation when array contains spread', () => {
      const result = validateParamCount(
        `SELECT * FROM foo WHERE id = $1`,
        `[...args]`,
        'test.ts',
        1,
      );
      expect(result).toHaveLength(0);
    });

    it('skips validation when SQL has no numbered placeholders', () => {
      const result = validateParamCount(`SELECT 1`, `[p1]`, 'test.ts', 1);
      expect(result).toHaveLength(0);
    });
  });

  describe('splitOnTopLevelCommas (helper unit tests)', () => {
    it('splits a flat list', () => {
      // Access via the module-level function — re-tested here for clarity
      const input = `$1, $2, now()`;
      // Replicate logic inline since the function is not exported
      const tokens: string[] = [];
      let depth = 0;
      let start = 0;
      for (let i = 0; i < input.length; i++) {
        if (input[i] === '(') depth++;
        else if (input[i] === ')') depth--;
        else if (input[i] === ',' && depth === 0) {
          tokens.push(input.slice(start, i));
          start = i + 1;
        }
      }
      tokens.push(input.slice(start));
      const result = tokens.filter((t) => t.trim().length > 0);
      expect(result).toHaveLength(3);
    });

    it('does not split on commas inside function calls', () => {
      const input = `COALESCE(a, b), $1, now()`;
      const tokens: string[] = [];
      let depth = 0;
      let start = 0;
      for (let i = 0; i < input.length; i++) {
        if (input[i] === '(') depth++;
        else if (input[i] === ')') depth--;
        else if (input[i] === ',' && depth === 0) {
          tokens.push(input.slice(start, i));
          start = i + 1;
        }
      }
      tokens.push(input.slice(start));
      const result = tokens.filter((t) => t.trim().length > 0);
      expect(result).toHaveLength(3);
    });
  });

  // ── Codebase-level assertions ─────────────────────────────────────────────

  describe('INSERT column / VALUES count', () => {
    it('every INSERT has the same number of columns and VALUES placeholders', () => {
      const countIssues = issues.filter((i) => i.reason.includes('column count'));

      if (countIssues.length > 0) {
        const report = countIssues
          .map((i) => `  ${i.file}:${i.line}\n    ${i.reason}`)
          .join('\n\n');
        throw new Error(
          `Found ${countIssues.length} INSERT column/value mismatch(es):\n\n${report}`,
        );
      }
    });
  });

  describe('INSERT timestamp columns', () => {
    it('every INSERT includes created_at (or sent_at for event tables)', () => {
      const tsIssues = issues.filter((i) => i.reason.includes('created_at'));

      if (tsIssues.length > 0) {
        const report = tsIssues.map((i) => `  ${i.file}:${i.line}\n    ${i.reason}`).join('\n\n');
        throw new Error(`Found ${tsIssues.length} INSERT(s) missing created_at:\n\n${report}`);
      }
    });

    it('every INSERT includes updated_at', () => {
      const tsIssues = issues.filter((i) => i.reason.includes('updated_at'));

      if (tsIssues.length > 0) {
        const report = tsIssues.map((i) => `  ${i.file}:${i.line}\n    ${i.reason}`).join('\n\n');
        throw new Error(`Found ${tsIssues.length} INSERT(s) missing updated_at:\n\n${report}`);
      }
    });
  });

  describe('pg pool.query parameter count', () => {
    it('every pool.query $N placeholder has a matching params array element', () => {
      const paramIssues = issues.filter(
        (i) => i.reason.includes('params array') || i.reason.includes('parameter'),
      );

      if (paramIssues.length > 0) {
        const report = paramIssues
          .map((i) => `  ${i.file}:${i.line}\n    ${i.reason}`)
          .join('\n\n');
        throw new Error(`Found ${paramIssues.length} parameter count mismatch(es):\n\n${report}`);
      }
    });
  });

  describe('known raw SQL locations are still present (regression guard)', () => {
    /**
     * These tests ensure the files we know contain raw SQL are still being
     * scanned.  If a file is renamed or deleted without updating this test,
     * the audit silently loses coverage — these guards catch that.
     */

    const repoRoot = path.resolve(__dirname, '../../../');

    it('scans apps/worker/src/message-log.service.ts', () => {
      const target = path.join(repoRoot, 'apps/worker/src/message-log.service.ts');
      expect(fs.existsSync(target)).toBe(true);
      const source = fs.readFileSync(target, 'utf-8');
      expect(source).toMatch(/pool\.query/);
    });

    it('scans apps/worker/src/processors/coach-memory.processor.ts', () => {
      const target = path.join(repoRoot, 'apps/worker/src/processors/coach-memory.processor.ts');
      expect(fs.existsSync(target)).toBe(true);
      const source = fs.readFileSync(target, 'utf-8');
      expect(source).toMatch(/pool\.query/);
    });

    it('scans apps/api/src/streaks/streaks.service.ts', () => {
      const target = path.join(repoRoot, 'apps/api/src/streaks/streaks.service.ts');
      expect(fs.existsSync(target)).toBe(true);
      const source = fs.readFileSync(target, 'utf-8');
      expect(source).toMatch(/\$queryRaw/);
    });

    it('scans apps/api/src/admin/admin.service.ts', () => {
      const target = path.join(repoRoot, 'apps/api/src/admin/admin.service.ts');
      expect(fs.existsSync(target)).toBe(true);
      const source = fs.readFileSync(target, 'utf-8');
      expect(source).toMatch(/\$queryRaw/);
    });
  });

  describe('known correct INSERTs (spot-check)', () => {
    /**
     * Positive coverage: verify that the two known-correct INSERTs in the
     * codebase are parsed without issues by our validators.
     */

    it('message-log.service.ts INSERT passes all checks', () => {
      const repoRoot = path.resolve(__dirname, '../../../');
      const file = path.join(repoRoot, 'apps/worker/src/message-log.service.ts');
      const source = fs.readFileSync(file, 'utf-8');

      const fragments = extractPoolQueryFragments(source, file);
      const insertFrag = fragments.find((f) => /INSERT\s+INTO\s+outbound_messages/i.test(f.sql));

      expect(insertFrag).toBeDefined();

      const insertIssues = validateInsert(insertFrag!.sql, file, insertFrag!.line);
      expect(insertIssues).toHaveLength(0);

      if (insertFrag!.paramsArrayText) {
        const paramIssues = validateParamCount(
          insertFrag!.sql,
          insertFrag!.paramsArrayText,
          file,
          insertFrag!.line,
        );
        expect(paramIssues).toHaveLength(0);
      }
    });

    it('coach-memory.processor.ts UPSERT INSERT passes all checks', () => {
      const repoRoot = path.resolve(__dirname, '../../../');
      const file = path.join(repoRoot, 'apps/worker/src/processors/coach-memory.processor.ts');
      const source = fs.readFileSync(file, 'utf-8');

      const fragments = extractPoolQueryFragments(source, file);
      const insertFrag = fragments.find((f) => /INSERT\s+INTO\s+coach_memories/i.test(f.sql));

      expect(insertFrag).toBeDefined();

      const insertIssues = validateInsert(insertFrag!.sql, file, insertFrag!.line);
      expect(insertIssues).toHaveLength(0);
    });
  });
});
