# SlothProxyV2

[![Update Feeds](https://github.com/Facilitairinfo/SlothProxyV2/actions/workflows/update-feeds.yml/badge.svg)](https://github.com/Facilitairinfo/SlothProxyV2/actions/workflows/update-feeds.yml)

## Setup
1. Kopieer `.env.example` naar `.env` en vul je Supabase gegevens in.
2. Start Codespace of lokaal:
npm install
npx playwright install
npm run dev


## Test
- Status:
curl http://localhost:8080/status
- Feed:
curl "http://localhost:8080/feed?siteKey=facilitairnetwerk"


## Snapshot
Indien nodig:
npm i -D playwright 
npx playwright install

