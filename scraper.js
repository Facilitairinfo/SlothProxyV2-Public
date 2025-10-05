import fs from 'fs';
import { chromium } from 'playwright';
import jsdom from 'jsdom';

// Nederlandse maanden
const months = {
  januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5,
  juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11
};

function parseDutchDate(text) {
  if (!text) return new Date();
  const parsed = Date.parse(text);
  if (!isNaN(parsed)) return new Date(parsed);
  const parts = text.toLowerCase().trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = months[parts[1]];
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  return new Date();
}

function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href || baseUrl;
  }
}

// XML feed generator
function generateXMLFeed(items, siteLabel = 'Feed') {
  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">\n<channel>\n<title>${siteLabel}</title>\n<link>${items[0]?.source || ''}</link>\n<description>Feed van ${siteLabel}</description>\n<language>nl</language>\n`;
  const footer = `</channel>\n</rss>`;
  const entries = items.map(item => {
    const desc = item.image
      ? `<![CDATA[<img src="${item.image}" alt="" /><br/>${item.summary || ''}]]>`
      : `<![CDATA[${item.summary || ''}]]>`;
    return `<item>
  <title><![CDATA[${item.title}]]></title>
  <link>${item.url}</link>
  <description>${desc}</description>
  <pubDate>${new Date(item.published_at).toUTCString()}</pubDate>
  <guid>${item.url}</guid>
  ${item.image ? `<media:content url="${item.image}" medium="image" />` : ''}
</item>`;
  }).join('\n');
  return header + entries + '\n' + footer;
}

export async function scrapeLatest() {
  const sites = JSON.parse(fs.readFileSync('./configs/sites.json', 'utf-8'));

  // Zorg dat feeds-map bestaat
  if (!fs.existsSync('./feeds')) {
    fs.mkdirSync('./feeds');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const [url, selectors] of Object.entries(sites)) {
    const siteResults = [];
    try {
      console.log(`🔎 Start scraping: ${url}`);
      await page.goto(url, {
        waitUntil: process.env.WAIT_UNTIL || 'networkidle',
        timeout: Number(process.env.NAV_TIMEOUT_MS) || 25000,
      });

      // Wacht expliciet op containers (voor CSU en dynamische sites)
      if (selectors.list) {
        try {
          await page.waitForSelector(selectors.list, { timeout: 10000 });
        } catch {
          console.warn(`⚠️ Geen containers gevonden voor ${url} binnen timeout`);
        }
      }

      const html = await page.content();
      const dom = new jsdom.JSDOM(html);
      const doc = dom.window.document;
      const containers = doc.querySelectorAll(selectors.list || 'article');
      console.log(`➡️ ${containers.length} containers gevonden voor ${url}`);

      containers.forEach(el => {
        let title = el.querySelector(selectors.title)?.textContent?.trim() || null;
        if (title && title.toLowerCase().startsWith('lees verder')) {
          title = title.replace(/^lees verder[:\\s-]*/i, '').trim();
        }

        const linkNode = el.querySelector(selectors.link);
        const rawHref = linkNode?.getAttribute('href') || null;
        const resolvedUrl = rawHref ? resolveUrl(rawHref, url) : null;

        const dateNode = el.querySelector(selectors.date);
        let dateText = dateNode?.getAttribute('datetime') || dateNode?.textContent?.trim() || null;
        const publishedAt = parseDutchDate(dateText);

        let summary = null;
        const summaryNode = el.querySelector(selectors.summary || 'p');
        if (summaryNode) {
          summary = summaryNode.textContent.trim();
        }
        if (!summary) {
          const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content');
          if (metaDesc) summary = metaDesc;
        }

        let image = null;
        const imageNode = selectors.image ? el.querySelector(selectors.image) : null;
        if (imageNode) {
          image = imageNode.getAttribute('src') || imageNode.getAttribute('data-src') || imageNode.getAttribute('srcset') || null;
        }
        if (!image) {
          const pictureNode = el.querySelector('picture source');
          if (pictureNode) image = pictureNode.getAttribute('srcset');
        }
        if (image) image = resolveUrl(image.split(' ')[0], url);

        if (title && resolvedUrl) {
          const item = {
            source: url,
            title,
            url: resolvedUrl,
            summary,
            image,
            published_at: publishedAt.toISOString(),
            scraped_at: new Date().toISOString()
          };
          siteResults.push(item);
        }
      });

      // Sorteer per site op publicatiedatum (nieuwste eerst)
      siteResults.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

      // Bestandsnamen
      const siteKey = url.replace(/https?:\/\//, '').replace(/[^\w]/g, '_');

      // ✅ Skip als er geen items zijn
      if (siteResults.length === 0) {
        console.warn(`⚠️ Geen items gevonden voor ${url}, feed wordt NIET overschreven`);
        continue;
      }

      // Schrijf per site JSON en XML in ./feeds/
      fs.writeFileSync(`./feeds/${siteKey}.json`, JSON.stringify(siteResults, null, 2), 'utf-8');
      fs.writeFileSync(`./feeds/${siteKey}.xml`, generateXMLFeed(siteResults, siteKey), 'utf-8');
      console.log(`✅ Feed opgeslagen: feeds/${siteKey}.json & feeds/${siteKey}.xml (${siteResults.length} items)`);

    } catch (err) {
      console.error(`❌ Fout bij ${url}: ${err.message}`);
    }
  }

  await browser.close();
}

// 🚀 Direct uitvoeren
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeLatest()
    .then(() => {
      console.log('--- Scraping voltooid ---');
    })
    .catch(err => {
      console.error('❌ Fout tijdens scraping:', err);
    });
}
