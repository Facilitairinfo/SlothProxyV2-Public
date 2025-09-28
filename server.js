// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { snapshot } from './snapshot.js';
import { search } from './search.js';
import { page } from './page.js';
import { cron } from './cron.js';
import { fetchSites, fetchArticles } from './supabase.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Health check
app.get('/status', (_, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      supabaseUrl: !!process.env.SUPABASE_URL,
      supabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
});

// Kern endpoints
app.get('/snapshot', snapshot);
app.get('/search', search);
app.get('/page', page);

// Feed endpoint
app.get('/feed', async (req, res) => {
  const siteKey = req.query.siteKey;
  if (!siteKey) return res.status(400).json({ error: 'Missing siteKey parameter' });

  try {
    const articles = await fetchArticles(siteKey);
    res.json({ siteKey, articles });
  } catch (err) {
    console.error('Supabase error:', err);
    res.status(500).json({ error: 'supabase_error', detail: err.message });
  }
});

// Feeds discovery
app.get('/feeds', async (_, res) => {
  try {
    const sites = await fetchSites();
    res.json({ count: sites.length, sites });
  } catch (err) {
    console.error('Supabase error:', err);
    res.status(500).json({ error: 'supabase_error', detail: err.message });
  }
});

// Cron
app.post('/cron', cron);

app.listen(PORT, () => {
  console.log(`✅ SlothProxyV2 listening on :${PORT}`);
});
