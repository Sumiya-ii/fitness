#!/usr/bin/env node
/**
 * Daily production monitor — analyzes Railway logs and queries the database
 * for anomalies. Produces a markdown report and email body.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import pg from 'pg';

const today = new Date().toISOString().split('T')[0];
const reportDir = 'reports/daily-monitor';
const reportPath = `${reportDir}/${today}.md`;

// ── Log Analysis ────────────────────────────────────────────────────────────

function analyzeLogFile(filePath, serviceName) {
  let lines;
  try {
    lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  } catch {
    return { serviceName, lines: 0, errors: [], warnings: [], slow: [], restarts: 0, raw: '' };
  }

  const errors = [];
  const warnings = [];
  const slow = [];
  let restarts = 0;

  for (const line of lines) {
    // 500 errors
    if (line.includes('"statusCode":500') || line.includes(' 500 ') || line.includes('status code 500')) {
      const endpoint = line.match(/"url":"([^"]+)"/)?.[1] || 'unknown';
      const msg = line.match(/"message":"([^"]+)"/)?.[1] || line.substring(0, 200);
      errors.push({ endpoint, message: msg, severity: 'HIGH', line });
    }
    // Other errors (non-500)
    else if (/"level":\s*50/.test(line) || /\[ERROR\]/.test(line) || /ERR/.test(line)) {
      const msg = line.match(/"message":"([^"]+)"/)?.[1] || line.substring(0, 200);
      errors.push({ endpoint: '-', message: msg, severity: 'MEDIUM', line });
    }
    // Warnings
    else if (/"level":\s*40/.test(line) || /\[WARN\]/.test(line)) {
      const msg = line.match(/"message":"([^"]+)"/)?.[1] || line.substring(0, 200);
      warnings.push(msg);
    }
    // Slow requests (>5s)
    const rt = line.match(/"responseTime":(\d+)/);
    if (rt && parseInt(rt[1]) > 5000) {
      const endpoint = line.match(/"url":"([^"]+)"/)?.[1] || 'unknown';
      slow.push({ endpoint, responseTime: parseInt(rt[1]) });
    }
    // Restarts
    if (line.includes('Starting Container') || line.includes('started with')) {
      restarts++;
    }
  }

  return { serviceName, lines: lines.length, errors, warnings, slow, restarts, raw: lines.join('\n') };
}

function groupErrors(errors) {
  const groups = {};
  for (const err of errors) {
    // Normalize the message for grouping
    const key = err.message.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '<timestamp>')
      .substring(0, 120);
    if (!groups[key]) groups[key] = { count: 0, endpoint: err.endpoint, severity: err.severity, sample: err.message };
    groups[key].count++;
  }
  return Object.values(groups).sort((a, b) => b.count - a.count);
}

// ── Database Checks ─────────────────────────────────────────────────────────

async function queryDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { error: 'DATABASE_URL not set', results: {} };

  const pool = new pg.Pool({ connectionString: dbUrl, ssl: false, connectionTimeoutMillis: 10000 });
  const results = {};

  const queries = [
    {
      name: 'outbound_messages',
      sql: `SELECT status, count(*)::int as count FROM outbound_messages WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY status ORDER BY count DESC`,
    },
    {
      name: 'stuck_voice_drafts',
      sql: `SELECT status, count(*)::int as count FROM voice_drafts WHERE status NOT IN ('completed', 'failed') AND created_at < NOW() - INTERVAL '1 hour' GROUP BY status`,
    },
    {
      name: 'new_users_24h',
      sql: `SELECT count(*)::int as count FROM users WHERE created_at > NOW() - INTERVAL '24 hours'`,
    },
    {
      name: 'meal_logs_24h',
      sql: `SELECT count(*)::int as count FROM meal_logs WHERE created_at > NOW() - INTERVAL '24 hours'`,
    },
    {
      name: 'failed_jobs',
      sql: `SELECT queue, count(*)::int as count FROM bull_jobs WHERE failed_reason IS NOT NULL AND created_at > NOW() - INTERVAL '24 hours' GROUP BY queue ORDER BY count DESC`,
      optional: true,
    },
  ];

  for (const q of queries) {
    try {
      const res = await pool.query(q.sql);
      results[q.name] = res.rows;
    } catch (err) {
      if (q.optional) {
        results[q.name] = `skipped (${err.message.substring(0, 80)})`;
      } else {
        results[q.name] = `error: ${err.message.substring(0, 120)}`;
      }
    }
  }

  await pool.end();
  return { error: null, results };
}

// ── Report Generation ───────────────────────────────────────────────────────

function generateReport(api, worker, db) {
  const totalErrors = api.errors.length + worker.errors.length;
  const apiGroups = groupErrors(api.errors);
  const workerGroups = groupErrors(worker.errors);
  const criticalCount = [...api.errors, ...worker.errors].filter(e => e.severity === 'HIGH').length;

  const apiHealthy = api.errors.length === 0 && api.lines > 0;
  const workerHealthy = worker.errors.length === 0 && worker.lines > 0;

  let md = `# Coach Daily Monitor — ${today}\n\n`;
  md += `## Summary\n`;
  md += `- **Total errors found:** ${totalErrors}\n`;
  md += `- **Critical (500s):** ${criticalCount}\n`;
  md += `- **API:** ${apiHealthy ? 'healthy' : `${api.errors.length} errors`} (${api.lines} lines analyzed, ${api.restarts} restarts)\n`;
  md += `- **Worker:** ${workerHealthy ? 'healthy' : `${worker.errors.length} errors`} (${worker.lines} lines analyzed, ${worker.restarts} restarts)\n`;
  md += `- **Slow requests (>5s):** ${api.slow.length + worker.slow.length}\n\n`;

  // API Errors
  md += `## API Errors\n`;
  if (apiGroups.length === 0) {
    md += `No errors detected.\n\n`;
  } else {
    md += `| Count | Endpoint | Error | Severity |\n|-------|----------|-------|----------|\n`;
    for (const g of apiGroups.slice(0, 20)) {
      md += `| ${g.count} | ${g.endpoint} | ${g.sample.substring(0, 80)} | ${g.severity} |\n`;
    }
    md += `\n`;
  }

  // Worker Errors
  md += `## Worker Errors\n`;
  if (workerGroups.length === 0) {
    md += `No errors detected.\n\n`;
  } else {
    md += `| Count | Error | Severity |\n|-------|-------|----------|\n`;
    for (const g of workerGroups.slice(0, 20)) {
      md += `| ${g.count} | ${g.sample.substring(0, 100)} | ${g.severity} |\n`;
    }
    md += `\n`;
  }

  // Slow requests
  if (api.slow.length + worker.slow.length > 0) {
    md += `## Slow Requests (>5s)\n`;
    md += `| Endpoint | Response Time |\n|----------|---------------|\n`;
    for (const s of [...api.slow, ...worker.slow].sort((a, b) => b.responseTime - a.responseTime).slice(0, 10)) {
      md += `| ${s.endpoint} | ${(s.responseTime / 1000).toFixed(1)}s |\n`;
    }
    md += `\n`;
  }

  // Database
  md += `## Database Anomalies\n`;
  if (db.error) {
    md += `Database check failed: ${db.error}\n\n`;
  } else {
    const r = db.results;
    // Outbound messages
    if (typeof r.outbound_messages === 'string') {
      md += `- **Outbound messages:** ${r.outbound_messages}\n`;
    } else if (Array.isArray(r.outbound_messages)) {
      const total = r.outbound_messages.reduce((s, row) => s + row.count, 0);
      const failed = r.outbound_messages.find(row => row.status === 'failed')?.count || 0;
      md += `- **Outbound messages (24h):** ${failed} failed / ${total} total\n`;
      if (r.outbound_messages.length > 0) {
        md += `  - Breakdown: ${r.outbound_messages.map(row => `${row.status}: ${row.count}`).join(', ')}\n`;
      }
    }
    // Stuck voice drafts
    if (typeof r.stuck_voice_drafts === 'string') {
      md += `- **Stuck voice drafts:** ${r.stuck_voice_drafts}\n`;
    } else if (Array.isArray(r.stuck_voice_drafts)) {
      const stuck = r.stuck_voice_drafts.reduce((s, row) => s + row.count, 0);
      md += `- **Stuck voice drafts:** ${stuck}\n`;
    }
    // New users
    if (Array.isArray(r.new_users_24h) && r.new_users_24h[0]) {
      md += `- **New users (24h):** ${r.new_users_24h[0].count}\n`;
    }
    // Meal logs
    if (Array.isArray(r.meal_logs_24h) && r.meal_logs_24h[0]) {
      md += `- **Meal logs (24h):** ${r.meal_logs_24h[0].count}\n`;
    }
    // Failed jobs
    if (typeof r.failed_jobs === 'string') {
      md += `- **Failed queue jobs:** ${r.failed_jobs}\n`;
    } else if (Array.isArray(r.failed_jobs) && r.failed_jobs.length > 0) {
      md += `- **Failed queue jobs:** ${r.failed_jobs.map(row => `${row.queue}: ${row.count}`).join(', ')}\n`;
    }
    md += `\n`;
  }

  // Recommendations
  md += `## Recommended Actions\n`;
  const actions = [];
  if (criticalCount > 0) {
    actions.push(`Fix ${criticalCount} HTTP 500 errors — check endpoints: ${[...new Set(apiGroups.filter(g => g.severity === 'HIGH').map(g => g.endpoint))].join(', ')}`);
  }
  if (api.restarts > 1 || worker.restarts > 1) {
    actions.push(`Investigate service restarts (API: ${api.restarts}, Worker: ${worker.restarts}) — possible crash loop or OOM`);
  }
  const stuckCount = Array.isArray(db.results?.stuck_voice_drafts)
    ? db.results.stuck_voice_drafts.reduce((s, r) => s + r.count, 0) : 0;
  if (stuckCount > 0) {
    actions.push(`${stuckCount} stuck voice drafts need investigation`);
  }
  if (api.slow.length > 3) {
    actions.push(`${api.slow.length} slow requests detected — consider query optimization or caching`);
  }
  if (actions.length === 0) {
    actions.push('No immediate actions required. Services look healthy.');
  }
  for (const a of actions) {
    md += `- ${a}\n`;
  }
  md += `\n---\n*Generated by Coach Daily Monitor at ${new Date().toISOString()}*\n`;

  return { markdown: md, totalErrors, criticalCount, apiHealthy, workerHealthy, stuckCount };
}

function generateEmailBody(report, totalErrors, criticalCount, apiHealthy, workerHealthy) {
  let body = `Coach Daily Monitor — ${today}\n`;
  body += `${'='.repeat(50)}\n\n`;

  if (totalErrors === 0) {
    body += `All clear. No errors detected in the last log window.\n\n`;
  } else {
    body += `${totalErrors} errors found (${criticalCount} critical 500s).\n\n`;
  }

  body += `API: ${apiHealthy ? 'Healthy' : 'ERRORS DETECTED'}\n`;
  body += `Worker: ${workerHealthy ? 'Healthy' : 'ERRORS DETECTED'}\n\n`;
  body += `Full report committed to: reports/daily-monitor/${today}.md\n`;
  body += `View on GitHub: https://github.com/Sumiya-ii/fitness/blob/main/reports/daily-monitor/${today}.md\n`;

  return body;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Coach Daily Monitor — ${today}`);

  // Analyze logs
  const api = analyzeLogFile('/tmp/api-logs.txt', 'coach-api');
  const worker = analyzeLogFile('/tmp/worker-logs.txt', 'coach-worker');
  console.log(`API: ${api.lines} lines, ${api.errors.length} errors`);
  console.log(`Worker: ${worker.lines} lines, ${worker.errors.length} errors`);

  // Query database
  console.log('Querying database...');
  const db = await queryDatabase();
  if (db.error) console.log(`DB check: ${db.error}`);
  else console.log('DB checks complete');

  // Generate report
  const { markdown, totalErrors, criticalCount, apiHealthy, workerHealthy } = generateReport(api, worker, db);

  // Write report file
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, markdown);
  console.log(`Report written to ${reportPath}`);

  // Write email body
  const emailBody = generateEmailBody(markdown, totalErrors, criticalCount, apiHealthy, workerHealthy);
  writeFileSync('/tmp/email-body.txt', emailBody);

  // Set GitHub Actions output for email subject
  const subjectLine = totalErrors === 0
    ? `Coach Monitor ${today} — All Clear`
    : `Coach Monitor ${today} — ${totalErrors} errors (${criticalCount} critical)`;

  // Write to GITHUB_ENV for the email step
  const envFile = process.env.GITHUB_ENV;
  if (envFile) {
    const { appendFileSync } = await import('fs');
    appendFileSync(envFile, `EMAIL_SUBJECT=${subjectLine}\n`);
  }

  console.log(`Subject: ${subjectLine}`);
  console.log('Done.');
}

main().catch(err => {
  console.error('Monitor failed:', err);
  process.exit(1);
});
