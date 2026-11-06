// Vercel serverless function: live usage counter backed by Upstash Redis (REST API).
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'Redis not configured' });
  const { id, load } = req.body || {};
  if (typeof id !== 'string' || id.length < 8 || id.length > 64) return res.status(400).json({ error: 'bad id' });
  const now = Date.now();
  const cmds = [
    ['ZADD', 'ink:online', now, id],
    ['ZREMRANGEBYSCORE', 'ink:online', 0, now - 70000],
    ['ZCARD', 'ink:online'],
    ['SADD', 'ink:people', id],
    ['SCARD', 'ink:people'],
    load ? ['INCR', 'ink:visits'] : ['GET', 'ink:visits'],
  ];
  try {
    const r = await fetch(`${URL_}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    const out = await r.json();
    res.status(200).json({ online: out[2].result, unique: out[4].result, visits: +out[5].result || 0 });
  } catch (e) {
    res.status(500).json({ error: 'stats failed' });
  }
};
