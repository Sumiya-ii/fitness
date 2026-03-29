import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@coach/shared';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface RecentJob {
  queue: string;
  id: string | undefined;
  name: string;
  state: string;
  timestamp: number;
  finishedOn: number | undefined;
  failedReason: string | undefined;
  attemptsMade: number;
  data: unknown;
}

export function createAdminDashboardRouter(redisUrl: string): Router {
  const router = Router();

  const queues = Object.entries(QUEUE_NAMES).map(([key, name]) => ({
    key,
    name,
    queue: new Queue(name, { connection: { url: redisUrl } }),
  }));

  // JSON API for queue stats
  router.get('/api/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await Promise.all(
        queues.map(async ({ name, queue }) => {
          const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
            queue.isPaused(),
          ]);
          return { name, waiting, active, completed, failed, delayed, paused } as QueueStats;
        }),
      );

      // Get recent failed jobs across all queues
      const failedJobs: RecentJob[] = [];
      const recentJobs: RecentJob[] = [];

      for (const { name, queue } of queues) {
        const [failed, completed, active] = await Promise.all([
          queue.getFailed(0, 4),
          queue.getCompleted(0, 2),
          queue.getActive(0, 4),
        ]);

        for (const job of failed) {
          failedJobs.push({
            queue: name,
            id: job.id,
            name: job.name,
            state: 'failed',
            timestamp: job.timestamp,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade,
            data: summarizeData(job.data),
          });
        }

        for (const job of [...active, ...completed]) {
          const state = job.finishedOn ? 'completed' : 'active';
          recentJobs.push({
            queue: name,
            id: job.id,
            name: job.name,
            state,
            timestamp: job.timestamp,
            finishedOn: job.finishedOn,
            failedReason: undefined,
            attemptsMade: job.attemptsMade,
            data: summarizeData(job.data),
          });
        }
      }

      failedJobs.sort((a, b) => (b.finishedOn ?? b.timestamp) - (a.finishedOn ?? a.timestamp));
      recentJobs.sort((a, b) => (b.finishedOn ?? b.timestamp) - (a.finishedOn ?? a.timestamp));

      res.json({
        stats,
        failedJobs: failedJobs.slice(0, 15),
        recentJobs: recentJobs.slice(0, 20),
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // HTML dashboard
  router.get('/', (_req: Request, res: Response) => {
    res.type('html').send(dashboardHtml());
  });

  return router;
}

function summarizeData(data: Record<string, unknown>): unknown {
  const str = JSON.stringify(data);
  if (str.length <= 120) return data;
  // Return just the keys and truncated values
  const summary: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    const vs = String(v);
    summary[k] = vs.length > 40 ? vs.slice(0, 40) + '...' : vs;
  }
  return summary;
}

function dashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coach Admin Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0f1117; color: #e1e4e8; font-size: 13px; }
  .header { background: #161b22; border-bottom: 1px solid #30363d; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 16px; font-weight: 600; color: #f0f6fc; }
  .header .meta { font-size: 11px; color: #8b949e; display: flex; gap: 16px; align-items: center; }
  .header .meta .dot { width: 6px; height: 6px; border-radius: 50%; background: #3fb950; display: inline-block; margin-right: 4px; }
  .header a { color: #58a6ff; text-decoration: none; font-size: 12px; }
  .container { max-width: 1200px; margin: 0 auto; padding: 16px 20px; }

  /* Queue overview table */
  .section { margin-bottom: 20px; }
  .section-title { font-size: 12px; font-weight: 600; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #30363d; border-radius: 6px; overflow: hidden; }
  th { background: #1c2129; text-align: left; padding: 6px 10px; font-size: 11px; font-weight: 600; color: #8b949e; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1px solid #30363d; }
  td { padding: 5px 10px; border-bottom: 1px solid #21262d; font-size: 12px; font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #1c2129; }
  .queue-name { font-weight: 500; color: #f0f6fc; white-space: nowrap; }

  /* Number badges */
  .n { display: inline-block; min-width: 20px; text-align: right; }
  .n-wait { color: #d29922; }
  .n-active { color: #58a6ff; }
  .n-done { color: #3fb950; }
  .n-fail { color: #f85149; }
  .n-delay { color: #bc8cff; }
  .n-zero { color: #484f58; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .badge-paused { background: #d2992233; color: #d29922; }
  .badge-ok { background: #3fb95022; color: #3fb950; }

  /* Jobs list */
  .jobs-table td { padding: 4px 10px; }
  .jobs-table .job-queue { color: #8b949e; font-size: 11px; }
  .jobs-table .job-id { color: #58a6ff; font-family: monospace; font-size: 11px; }
  .jobs-table .job-name { color: #f0f6fc; }
  .jobs-table .job-time { color: #8b949e; font-size: 11px; white-space: nowrap; }
  .jobs-table .job-error { color: #f85149; font-size: 11px; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .jobs-table .job-data { color: #8b949e; font-family: monospace; font-size: 10px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .state { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .state-failed { background: #f8514933; color: #f85149; }
  .state-completed { background: #3fb95022; color: #3fb950; }
  .state-active { background: #58a6ff22; color: #58a6ff; }

  /* Totals bar */
  .totals { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .total-card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 10px 16px; min-width: 100px; }
  .total-card .label { font-size: 10px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.3px; }
  .total-card .value { font-size: 22px; font-weight: 700; margin-top: 2px; font-variant-numeric: tabular-nums; }

  .refresh-btn { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; }
  .refresh-btn:hover { background: #30363d; }
  .loading { color: #8b949e; font-style: italic; }
  .tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid #30363d; }
  .tab { padding: 8px 16px; font-size: 12px; cursor: pointer; color: #8b949e; border-bottom: 2px solid transparent; }
  .tab:hover { color: #f0f6fc; }
  .tab.active { color: #f0f6fc; border-bottom-color: #f78166; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
</style>
</head>
<body>
<div class="header">
  <h1>Coach Queue Dashboard</h1>
  <div class="meta">
    <span><span class="dot"></span>Connected</span>
    <span id="last-update">—</span>
    <button class="refresh-btn" onclick="refresh()">Refresh</button>
    <label style="font-size:11px;display:flex;align-items:center;gap:4px;">
      <input type="checkbox" id="auto-refresh" checked style="margin:0"> Auto 5s
    </label>
    <a href="/admin/queues" target="_blank">Full Bull Board &rarr;</a>
  </div>
</div>
<div class="container">
  <div id="totals" class="totals"></div>

  <div class="section">
    <div class="section-title">Queue Overview</div>
    <table id="queue-table">
      <thead>
        <tr>
          <th>Queue</th>
          <th style="text-align:right">Waiting</th>
          <th style="text-align:right">Active</th>
          <th style="text-align:right">Completed</th>
          <th style="text-align:right">Failed</th>
          <th style="text-align:right">Delayed</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody id="queue-body"><tr><td colspan="7" class="loading">Loading...</td></tr></tbody>
    </table>
  </div>

  <div class="tabs">
    <div class="tab active" data-tab="failed">Failed Jobs</div>
    <div class="tab" data-tab="recent">Recent Activity</div>
  </div>

  <div id="tab-failed" class="tab-content active">
    <table class="jobs-table" id="failed-table">
      <thead>
        <tr><th>Queue</th><th>Job ID</th><th>Name</th><th>Error</th><th>Attempts</th><th>Time</th></tr>
      </thead>
      <tbody id="failed-body"><tr><td colspan="6" class="loading">Loading...</td></tr></tbody>
    </table>
  </div>

  <div id="tab-recent" class="tab-content">
    <table class="jobs-table" id="recent-table">
      <thead>
        <tr><th>Queue</th><th>Job ID</th><th>Name</th><th>State</th><th>Data</th><th>Time</th></tr>
      </thead>
      <tbody id="recent-body"><tr><td colspan="6" class="loading">Loading...</td></tr></tbody>
    </table>
  </div>
</div>

<script>
const basePath = location.pathname.replace(/\\/$/, '');
let timer;

function nc(val, cls) {
  return '<span class="n ' + (val === 0 ? 'n-zero' : cls) + '">' + val + '</span>';
}

function ago(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

async function refresh() {
  try {
    const res = await fetch(basePath + '/api/stats');
    const data = await res.json();
    renderStats(data.stats);
    renderFailed(data.failedJobs);
    renderRecent(data.recentJobs);
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
  } catch (e) {
    console.error('Refresh failed:', e);
  }
}

function renderStats(stats) {
  let totalW = 0, totalA = 0, totalC = 0, totalF = 0, totalD = 0;
  let rows = '';
  for (const q of stats) {
    totalW += q.waiting; totalA += q.active; totalC += q.completed; totalF += q.failed; totalD += q.delayed;
    const status = q.paused
      ? '<span class="badge badge-paused">Paused</span>'
      : (q.active > 0 ? '<span class="badge badge-ok">Processing</span>' : '<span style="color:#484f58">Idle</span>');
    rows += '<tr>'
      + '<td class="queue-name">' + esc(q.name) + '</td>'
      + '<td style="text-align:right">' + nc(q.waiting, 'n-wait') + '</td>'
      + '<td style="text-align:right">' + nc(q.active, 'n-active') + '</td>'
      + '<td style="text-align:right">' + nc(q.completed, 'n-done') + '</td>'
      + '<td style="text-align:right">' + nc(q.failed, 'n-fail') + '</td>'
      + '<td style="text-align:right">' + nc(q.delayed, 'n-delay') + '</td>'
      + '<td>' + status + '</td>'
      + '</tr>';
  }
  document.getElementById('queue-body').innerHTML = rows || '<tr><td colspan="7" style="color:#484f58">No queues</td></tr>';

  document.getElementById('totals').innerHTML =
    card('Waiting', totalW, '#d29922') +
    card('Active', totalA, '#58a6ff') +
    card('Completed', totalC, '#3fb950') +
    card('Failed', totalF, '#f85149') +
    card('Delayed', totalD, '#bc8cff');
}

function card(label, value, color) {
  return '<div class="total-card"><div class="label">' + label + '</div><div class="value" style="color:' + color + '">' + value.toLocaleString() + '</div></div>';
}

function renderFailed(jobs) {
  if (!jobs.length) {
    document.getElementById('failed-body').innerHTML = '<tr><td colspan="6" style="color:#3fb950">No failed jobs</td></tr>';
    return;
  }
  let rows = '';
  for (const j of jobs) {
    rows += '<tr>'
      + '<td class="job-queue">' + esc(j.queue) + '</td>'
      + '<td class="job-id">' + esc(j.id) + '</td>'
      + '<td class="job-name">' + esc(j.name) + '</td>'
      + '<td class="job-error" title="' + esc(j.failedReason) + '">' + esc(j.failedReason) + '</td>'
      + '<td style="text-align:center">' + j.attemptsMade + '/3</td>'
      + '<td class="job-time">' + ago(j.finishedOn || j.timestamp) + '</td>'
      + '</tr>';
  }
  document.getElementById('failed-body').innerHTML = rows;
}

function renderRecent(jobs) {
  if (!jobs.length) {
    document.getElementById('recent-body').innerHTML = '<tr><td colspan="6" style="color:#484f58">No recent jobs</td></tr>';
    return;
  }
  let rows = '';
  for (const j of jobs) {
    const stateClass = 'state-' + j.state;
    const dataStr = typeof j.data === 'object' ? JSON.stringify(j.data) : String(j.data || '');
    rows += '<tr>'
      + '<td class="job-queue">' + esc(j.queue) + '</td>'
      + '<td class="job-id">' + esc(j.id) + '</td>'
      + '<td class="job-name">' + esc(j.name) + '</td>'
      + '<td><span class="state ' + stateClass + '">' + j.state + '</span></td>'
      + '<td class="job-data" title="' + esc(dataStr) + '">' + esc(dataStr) + '</td>'
      + '<td class="job-time">' + ago(j.finishedOn || j.timestamp) + '</td>'
      + '</tr>';
  }
  document.getElementById('recent-body').innerHTML = rows;
}

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// Auto refresh
function startAutoRefresh() {
  clearInterval(timer);
  if (document.getElementById('auto-refresh').checked) {
    timer = setInterval(refresh, 5000);
  }
}
document.getElementById('auto-refresh').addEventListener('change', startAutoRefresh);

refresh();
startAutoRefresh();
</script>
</body>
</html>`;
}
