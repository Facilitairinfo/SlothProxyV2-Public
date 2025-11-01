import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// Supabase client + debug checks
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // aangepast naar SUPABASE_KEY

if (!supabaseUrl) {
  throw new Error("❌ SUPABASE_URL is missing. Controleer je GitHub secret.");
}
if (!supabaseKey) {
  throw new Error("❌ SUPABASE_KEY is missing. Controleer je GitHub secret.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configs
const sites = JSON.parse(fs.readFileSync('./configs/sites.json', 'utf-8'));
const feedsDir = './feeds';

// Zorg dat feeds/ bestaat
if (!fs.existsSync(feedsDir)) {
  fs.mkdirSync(feedsDir);
}

// Helper: schrijf JSON en XML feeds
function writeFeeds(siteKey, items) {
  const jsonPath = path.join(feedsDir, `${siteKey}.json`);
  const xmlPath = path.join(feedsDir, `${siteKey}.xml`);

  // JSON
  fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2));

  // XML
  const xmlItems = items
    .map(
      (item) => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <pubDate>${item.date}</pubDate>
    </item>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>${siteKey}</title>
      <link>https://${siteKey}</link>
      <description>Feed for ${siteKey}</description>
      ${xmlItems}
    </channel>
  </rss>`;

  fs.writeFileSync(xmlPath, xml);
}

// Scraper
async function scrapeSite(url, config) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const items = [];
    $(config.itemSelector).each((_, el) => {
      const title = $(el).find(config.titleSelector).text().trim();
      const link = new URL($(el).find(config.linkSelector).attr('href'), url).href;
      const date = $(el).find(config.dateSelector).text().trim();
      if (title && link) {
        items.push({ title, link, date });
      }
    });

    const siteKey = url.replace(/https?:\/\//, '').replace(/[^\w]/g, '_');
    writeFeeds(siteKey, items);

    console.log(`✅ ${url} → ${items.length} items`);
  } catch (err) {
    console.error(`⚠️ Fout bij scrapen van ${url}:`, err.message);
  }
}

// Supabase keep-alive
async function keepAlive() {
  try {
    const { error } = await supabase.rpc('version'); // simpele ping
    if (error) {
      console.error('⚠️ Supabase keep-alive error:', error.message);
    } else {
      console.log('✅ Supabase keep-alive ping uitgevoerd');
    }
  } catch (err) {
    console.error('⚠️ Supabase keep-alive exception:', err.message);
  }
}

// 🔎 Debug: test SELECT
async function testSelect() {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .limit(1);

  if (error) {
    console.error("❌ Select error:", error.message);
  } else {
    console.log("✅ Select gelukt. Voorbeeldrij:", data);
  }
}

// 🔎 Debug: test INSERT + cleanup
async function testInsert() {
  const { data, error } = await supabase
    .from('articles')
    .insert([
      { title: 'Test insert', content: 'Dit is een testrecord', created_at: new Date() }
    ])
    .select();

  if (error) {
    console.error("❌ Insert error:", error.message);
    return;
  }

  console.log("✅ Insert gelukt:", data);

  // Verwijder testrecord weer
  const { error: deleteError } = await supabase
    .from('articles')
    .delete()
    .eq('id', data[0].id);

  if (deleteError) {
    console.error("⚠️ Kon testrecord niet verwijderen:", deleteError.message);
  } else {
    console.log("🧹 Testrecord verwijderd");
  }
}

// Main
(async () => {
  // Run scraper
  for (const [url, config] of Object.entries(sites)) {
    await scrapeSite(url, config);
  }

  // Supabase checks
  await keepAlive();
  await testSelect();
  await testInsert();
})();
