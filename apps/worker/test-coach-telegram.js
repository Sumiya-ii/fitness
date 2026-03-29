#!/usr/bin/env node
/**
 * End-to-end test script for Coach → Telegram message delivery.
 * Usage:   node scripts/test-coach-telegram.js
 */

require('dotenv/config');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const results = [];

function check(name, status, detail) {
  results.push({ name, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${status}] ${name}: ${detail}`);
}

async function main() {
  console.log('\n========================================');
  console.log('  Coach Telegram E2E Verification');
  console.log('========================================\n');

  // ─── 1. Environment Variables ──────────────────────────────────────
  console.log('--- Step 1: Environment Variables ---');
  if (!DATABASE_URL) {
    check('DATABASE_URL', 'FAIL', 'Not set');
    return;
  }
  check('DATABASE_URL', 'PASS', 'Set');
  if (!REDIS_URL) {
    check('REDIS_URL', 'FAIL', 'Not set');
    return;
  }
  check('REDIS_URL', 'PASS', 'Set');
  if (!TELEGRAM_BOT_TOKEN) {
    check('TELEGRAM_BOT_TOKEN', 'FAIL', 'Not set');
    return;
  }
  check('TELEGRAM_BOT_TOKEN', 'PASS', 'Set');
  if (!OPENAI_API_KEY) {
    check('OPENAI_API_KEY', 'FAIL', 'Not set');
    return;
  }
  check('OPENAI_API_KEY', 'PASS', 'Set');

  // ─── 2. Database ───────────────────────────────────────────────────
  console.log('\n--- Step 2: Database Connectivity ---');
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const { rows } = await pool.query('SELECT 1 as ok');
    check(
      'PostgreSQL',
      rows[0]?.ok === 1 ? 'PASS' : 'FAIL',
      rows[0]?.ok === 1 ? 'Connected' : 'Bad result',
    );
  } catch (err) {
    check('PostgreSQL', 'FAIL', `Cannot connect: ${err.message}`);
    await pool.end();
    return;
  }

  // ─── 3. Redis ──────────────────────────────────────────────────────
  console.log('\n--- Step 3: Redis Connectivity ---');
  const redis = new Redis(REDIS_URL);
  try {
    const pong = await redis.ping();
    check(
      'Redis',
      pong === 'PONG' ? 'PASS' : 'FAIL',
      pong === 'PONG' ? 'Connected' : `Unexpected: ${pong}`,
    );
  } catch (err) {
    check('Redis', 'FAIL', `Cannot connect: ${err.message}`);
    redis.disconnect();
    await pool.end();
    return;
  }

  // ─── 4. Telegram Bot ──────────────────────────────────────────────
  console.log('\n--- Step 4: Telegram Bot ---');
  const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
  try {
    const me = await bot.telegram.getMe();
    check('Telegram bot', 'PASS', `@${me.username} (id: ${me.id})`);
  } catch (err) {
    check('Telegram bot', 'FAIL', `Invalid token: ${err.message}`);
    redis.disconnect();
    await pool.end();
    return;
  }

  // ─── 5. OpenAI ────────────────────────────────────────────────────
  console.log('\n--- Step 5: OpenAI API ---');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
      max_tokens: 5,
    });
    check('OpenAI API', 'PASS', `Response: "${resp.choices[0]?.message?.content?.trim()}"`);
  } catch (err) {
    check('OpenAI API', 'FAIL', `Error: ${err.message}`);
    redis.disconnect();
    await pool.end();
    return;
  }

  // ─── 6. Schema ────────────────────────────────────────────────────
  console.log('\n--- Step 6: Database Schema ---');
  try {
    await pool.query('SELECT count(*) FROM outbound_messages LIMIT 1');
    check('outbound_messages table', 'PASS', 'Exists');
  } catch (err) {
    check('outbound_messages table', 'FAIL', `Missing: ${err.message}`);
  }

  // ─── 7. Telegram-linked users ─────────────────────────────────────
  console.log('\n--- Step 7: Users with Telegram Links ---');
  const { rows: tgUsers } = await pool.query(`
    SELECT tl.user_id, tl.chat_id, tl.telegram_username,
           p.display_name, p.locale,
           np.channels, np.morning_reminder, np.evening_reminder,
           np.reminder_timezone, np.quiet_hours_start, np.quiet_hours_end
    FROM telegram_links tl
    JOIN profiles p ON p.user_id = tl.user_id
    LEFT JOIN notification_preferences np ON np.user_id = tl.user_id
    WHERE tl.active = true
  `);

  if (tgUsers.length === 0) {
    check('Telegram-linked users', 'FAIL', 'No users have active Telegram links.');
    redis.disconnect();
    await pool.end();
    return;
  }
  check('Telegram-linked users', 'PASS', `Found ${tgUsers.length} user(s)`);

  for (const u of tgUsers) {
    console.log(`\n  User: ${u.display_name ?? 'unnamed'} (${u.user_id})`);
    console.log(`    Chat ID: ${u.chat_id}`);
    console.log(`    Telegram: @${u.telegram_username ?? 'unknown'}`);
    console.log(`    Channels: ${JSON.stringify(u.channels)}`);
    console.log(`    Timezone: ${u.reminder_timezone ?? 'not set'}`);
    console.log(`    Morning: ${u.morning_reminder}, Evening: ${u.evening_reminder}`);

    const ch = u.channels ?? [];
    if (!ch.includes('telegram')) {
      check(`User ${u.display_name} channels`, 'FAIL', `'telegram' not in ${JSON.stringify(ch)}`);
    } else {
      check(`User ${u.display_name} channels`, 'PASS', `'telegram' in channels`);
    }
    if (!u.reminder_timezone) {
      check(`User ${u.display_name} prefs`, 'WARN', 'No notification prefs — skipped by scheduler');
    }
  }

  // ─── 8. BullMQ queues ─────────────────────────────────────────────
  console.log('\n--- Step 8: BullMQ Queue State ---');
  for (const q of ['coach-messages', 'reminders', 'meal-nudge']) {
    try {
      const w = await redis.llen(`bull:${q}:wait`);
      const a = await redis.llen(`bull:${q}:active`);
      const d = await redis.zcard(`bull:${q}:delayed`);
      const f = await redis.zcard(`bull:${q}:failed`);
      check(`Queue: ${q}`, 'PASS', `wait=${w}, active=${a}, delayed=${d}, failed=${f}`);
      if (f > 0) {
        const ids = await redis.zrange(`bull:${q}:failed`, -3, -1);
        for (const id of ids) {
          const data = await redis.hgetall(`bull:${q}:${id}`);
          if (data.failedReason)
            console.log(`    ⚠ Failed ${id}: ${data.failedReason.substring(0, 200)}`);
        }
      }
    } catch {
      check(`Queue: ${q}`, 'WARN', 'Could not read');
    }
  }

  // ─── 9. Recent outbound messages ──────────────────────────────────
  console.log('\n--- Step 9: Recent Outbound Messages ---');
  try {
    const { rows: msgs } = await pool.query(`
      SELECT channel, message_type, status, error_message, sent_at
      FROM outbound_messages ORDER BY sent_at DESC LIMIT 10
    `);
    if (msgs.length === 0) {
      check('Recent messages', 'WARN', 'None found');
    } else {
      check('Recent messages', 'PASS', `${msgs.length} message(s)`);
      for (const m of msgs) {
        const st = m.status === 'sent' ? '✅' : '❌';
        console.log(
          `    ${st} [${m.channel}] ${m.message_type} at ${m.sent_at}${m.error_message ? ` — ${m.error_message.substring(0, 100)}` : ''}`,
        );
      }
    }
  } catch (err) {
    check('Recent messages', 'WARN', `Query error: ${err.message}`);
  }

  // ─── 10. Cooldown state ───────────────────────────────────────────
  console.log('\n--- Step 10: Coach Cooldown State ---');
  const target = tgUsers[0];
  if (target) {
    const keys = await redis.keys(`coach:*:${target.user_id}:*`);
    if (keys.length === 0) {
      check('Coach cooldowns', 'PASS', 'No active cooldowns — eligible');
    } else {
      for (const k of keys) {
        const ttl = await redis.ttl(k);
        check('Coach cooldown', 'PASS', `${k} (TTL: ${ttl}s)`);
      }
    }
  }

  // ─── 11. Live Telegram delivery ───────────────────────────────────
  console.log('\n--- Step 11: Live Telegram Delivery Test ---');
  if (target?.chat_id) {
    try {
      const aiResp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a friendly nutrition coach. Send a brief test message in Mongolian to verify the system is working. Keep it to 1-2 sentences. Mention that this is a system test.',
          },
          { role: 'user', content: 'Send a quick test message.' },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });
      const msg = aiResp.choices[0]?.message?.content?.trim() ?? 'Test message from Coach.';

      try {
        await bot.telegram.sendMessage(target.chat_id, msg, { parse_mode: 'Markdown' });
        check('Telegram delivery (Markdown)', 'PASS', `Sent: "${msg.substring(0, 80)}"`);
      } catch (mdErr) {
        console.log(`    ⚠ Markdown failed: ${mdErr.message}, trying plain text`);
        await bot.telegram.sendMessage(target.chat_id, msg);
        check('Telegram delivery (plain text)', 'PASS', `Sent: "${msg.substring(0, 80)}"`);
      }
    } catch (err) {
      check('Telegram delivery', 'FAIL', `Could not send: ${err.message}`);
    }
  } else {
    check('Telegram delivery', 'FAIL', 'No chat_id');
  }

  // ─── 12. Chat history ─────────────────────────────────────────────
  console.log('\n--- Step 12: Chat History ---');
  if (target) {
    const raw = await redis.get(`chat:history:${target.user_id}`);
    if (raw) {
      try {
        const h = JSON.parse(raw);
        check('Chat history', 'PASS', `${h.length} message(s)`);
      } catch {
        check('Chat history', 'WARN', 'Malformed JSON');
      }
    } else {
      check('Chat history', 'WARN', 'No history found');
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  const p = results.filter((r) => r.status === 'PASS').length;
  const f = results.filter((r) => r.status === 'FAIL').length;
  const w = results.filter((r) => r.status === 'WARN').length;
  console.log(`  ✅ PASS: ${p}  ❌ FAIL: ${f}  ⚠️  WARN: ${w}`);

  if (f > 0) {
    console.log('\n  FAILED CHECKS:');
    for (const r of results.filter((r) => r.status === 'FAIL'))
      console.log(`    ❌ ${r.name}: ${r.detail}`);
  }
  console.log(f === 0 ? '\n  🎉 All critical checks passed!' : '\n  🚨 Failures need fixing.');
  console.log('');

  redis.disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
