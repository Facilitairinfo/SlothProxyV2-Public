// search.js
export async function search(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });
  res.json({ q, results: [] });
}
