// page.js
export async function page(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });
  res.json({ url, status: 'ok' });
}
