// snapshot.js
export async function snapshot(req, res) {
  const enabled = process.env.ENABLE_SNAPSHOT !== 'false';
  if (!enabled) return res.json({ snapshot: 'disabled' });

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (err) {
    return res.status(500).json({
      error: 'playwright_missing',
      detail: 'Voer uit: npm i -D playwright && npx playwright install'
    });
  }

  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const content = await page.content();
    await browser.close();

    res.json({ url, length: content.length });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ error: 'snapshot_failed', detail: err.message });
  }
}
