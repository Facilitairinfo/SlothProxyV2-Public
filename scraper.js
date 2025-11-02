// scraper.js
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { URL as NodeURL } from 'url';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl) throw new Error("❌ SUPABASE_URL ontbreekt");
if (!supabaseKey) throw new Error("❌ SUPABASE_KEY ontbreekt");

const supabase = createClient(supabaseUrl, supabaseKey);

// Configs
const sites = JSON.parse(fs.readFileSync('./configs/sites.json', 'utf-8'));
const feedsDir = './feeds';
if (!fs.existsSync(feedsDir)) fs.mkdirSync(feedsDir);

// Helper: maak nette feed key
function buildFeedKey(url) {
  const u = new NodeURL(url);
  const pathPart = u.pathname.replace(/\/+$/, '');
  return `${u.host}${pathPart}`.replace(/[^\w]/g, '_');
}

// Helper: NL maandnamen naar maandnummer
const nlMonths = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12
};

function parseDutchDate(str) {
  if (!str) return null;
  const parts = str.trim().toLowerCase().split(/\s+/);
  if (parts.length < 3) return null;
  const day = parseInt(parts[0], 10);
  const month = nlMonths[parts[1]];
  const year = parseInt(parts[2], 10);
  if (!day || !month || !year) return null;
  const iso = new Date(Date.UTC(year, month - 1, day));
  return iso.toISOString();
}

// Helper: schrijf JSON en XML feeds
function writeFeeds(sourceUrl, siteKey, items) {
  const jsonPath = path.join(feedsDir, `${siteKey}.json`);
  const xmlPath = path.join(feedsDir, `${siteKey}.xml`);

  fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2));

  const xmlItems = items.map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <pubDate>${item.date}</pubDate>
      ${item.summary ? `<description><![CDATA[${item.summary}]]></description>` : ''}
      ${item.image ? `<enclosure url="${item.image}" type="image/jpeg" />` : ''}
    </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>${siteKey}</title>
      <link>${sourceUrl}</link>
      <description>Feed for ${siteKey}</description>
      ${xmlItems}
    </channel>
  </rss>`;

  fs.writeFileSync(xmlPath, xml);
}

// Scraper
async function scrapeSite(url, config) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const nodes = config.list ? $(config.list) : $();
    console.log(`ℹ️ ${url} status=${res.status}, nodesFound=${nodes.length}`);

    const items = [];
    nodes.each((_, el) => {
      const title = config.title ? $(el).find(config.title).text().trim() : '';
      const rawHref = config.link ? $(el).find(config.link).attr('href') : '';
      const link = rawHref ? new NodeURL(rawHref, url).href : '';
      const date = config.date ? $(el).find(config.date).text().trim() : '';
      const summary = config.summary ? $(el).find(config.summary).text().trim() : '';
      const image = config.image ? $(el).find(config.image).attr('src') || '' : '';
      if (title && link) {
        items.push({ title, link, date, summary, image });
      }
    });

    const siteKey = buildFeedKey(url);
    writeFeeds(url, siteKey, items);

    for (const item of items) {
      try {
        const row = {
          title: item.title,
          content: item.summary || item.link,
          site: config.siteName || new NodeURL(url).hostname,
          source: siteKey,
          image: item.image || null,
          created_at: parseDutchDate(item.date) || new Date().toISOString()
        };
        const { error } = await supabase.from('articles').insert([row]);
        if (error) {
          if (error.code === '23505') {
            console.log(`ℹ️ Duplicate overgeslagen: ${item.title}`);
          } else {
            console.error(`⚠️ Insert error: ${error.message}`);
          }
        } else {
          console.log(`✅ Nieuw artikel toegevoegd: ${item.title}`);
        }
      } catch (err) {
        console.error(`⚠️ Exception bij insert: ${err.message}`);
      }
    }

    console.log(`✅ ${url} → ${items.length} items verwerkt`);
  } catch (err) {
    console.error(`⚠️ Fout bij scrapen van ${url}:`, err.message);
  }
}

// Supabase keep-alive
async function keepAlive() {
  try {
    const { error } = await supabase.from('articles').select('id').limit(1);
    if (error) console.error('⚠️ Supabase keep-alive error:', error.message);
    else console.log('✅ Supabase keep-alive ping uitgevoerd');
  } catch (err) {
    console.error('⚠️ Supabase keep-alive exception:', err.message);
  }
}

// Main
(async () => {
  const onlySite = process.env.SITE_TO_TEST;
  const entries = Object.entries(sites);

  if (onlySite) {
    const hit = entries.find(([u]) => u === onlySite);
    if (!hit) {
      console.log(`⚠️ SITE_TO_TEST="${onlySite}" niet gevonden in sites.json`);
      return;
    }
    const [url, config] = hit;
    console.log(`ℹ️ Running single-site scrape for: ${url}`);
    await scrapeSite(url, config);
  } else {
    for (const [url, config] of entries) {
      await scrapeSite(url, config);
    }
  }

  await keepAlive();
})();
