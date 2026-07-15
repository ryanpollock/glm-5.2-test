const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Dev: never cache HTML/JS/CSS so edits are picked up on refresh
app.use((req, res, next) => {
  if (/\.(html|js|css)$/.test(req.path)) res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Runner (side-scroller) page
app.get('/runner', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'runner.html'));
});

// In-memory leaderboard (top scores kept sorted, capped at 100).
const MAX_ENTRIES = 100;
const TOP_N = 10;
const leaderboard = [];

function normalizeName(name) {
  return String(name || '').trim().slice(0, 32) || 'Anonymous';
}

function normalizeScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function secretToken() {
  return crypto.randomBytes(16).toString('hex');
}

// GET top 10 scores
app.get('/api/scoreboard', (req, res) => {
  const top = leaderboard.slice(0, TOP_N).map((e) => ({
    name: e.name,
    score: e.score,
    level: e.level,
    won: e.won,
    game: e.game,
    token: e.token,
    date: e.date,
  }));
  res.json({ top });
});

// POST a new score: { name, score, level, won }
app.post('/api/scoreboard', (req, res) => {
  const game = String(req.body.game || 'explorer').trim().slice(0, 16) || 'explorer';
  const entry = {
    name: normalizeName(req.body.name),
    score: normalizeScore(req.body.score),
    level: Math.max(1, Math.floor(Number(req.body.level) || 1)),
    won: Boolean(req.body.won),
    game,
    token: secretToken(),
    date: new Date().toISOString(),
  };

  leaderboard.push(entry);
  leaderboard.sort((a, b) => b.score - a.score || b.level - a.level);
  if (leaderboard.length > MAX_ENTRIES) leaderboard.length = MAX_ENTRIES;

  const rank = leaderboard.indexOf(entry) + 1;
  res.json({ ok: true, rank, entry, top: leaderboard.slice(0, TOP_N) });
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Panda's City Tour server running: http://localhost:${PORT}`);
  });
}

module.exports = app;