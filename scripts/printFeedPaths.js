import fs from 'fs';
import { exec } from 'child_process';

// Flags
const showMissingOnly = process.argv.includes('--missing');
const openMissing = process.argv.includes('--open');
const showCount = process.argv.includes('--count');

// Laad sites.json
const sites = JSON.parse(fs.readFileSync('./configs/sites.json', 'utf-8'));

let total = 0;
let missing = 0;

for (const [url] of Object.entries(sites)) {
  // Zet URL om naar siteKey (zelfde logica als in scraper.js)
  const siteKey = url.replace(/https?:\/\//, '').replace(/[^\w]/g, '_');

  const jsonPath = `./feeds/${siteKey}.json`;
  const xmlPath = `./feeds/${siteKey}.xml`;

  const jsonExists = fs.existsSync(jsonPath);
  const xmlExists = fs.existsSync(xmlPath);

  total++;
  if (!jsonExists || !xmlExists) {
    missing++;
  }

  // Als --missing is meegegeven, toon alleen feeds die compleet zijn
  if (showMissingOnly && jsonExists && xmlExists) {
    continue;
  }

  console.log(`🔗 ${url}`);

  // JSON feed
  if (jsonExists) {
    let count = '';
    if (showCount) {
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        count = ` (${data.length} items)`;
      } catch {
        count = ' ⚠️ fout bij lezen';
      }
    }
    console.log(
      `   JSON feed: https://facilitairinfo.github.io/SlothProxyV2/feeds/${siteKey}.json ✅ bestaat${count}`
    );
  } else {
    console.log(
      `   JSON feed: https://facilitairinfo.github.io/SlothProxyV2/feeds/${siteKey}.json ⚠️ ontbreekt`
    );
    if (openMissing) {
      exec(`xdg-open https://facilitairinfo.github.io/SlothProxyV2/feeds/${siteKey}.json`);
    }
  }

  // XML feed
  if (xmlExists) {
    console.log(
      `   XML  feed: https://facilitairinfo.github.io/SlothProxyV2/feeds/${siteKey}.xml ✅ bestaat`
    );
  } else {
    console.log(
      `   XML  feed: https://facilitairinfo.github.io/SlothProxyV2/feeds/${siteKey}.xml ⚠️ ontbreekt`
    );
    if (openMissing) {
      exec(`xdg-open https://facilitairinfo.github.io/SlothProxyV2/feeds/${siteKey}.xml`);
    }
  }

  console.log('');
}

// Eindtotaal
console.log(`📊 Samenvatting: ${total} feeds gecontroleerd, ${missing} ontbreken.`);
