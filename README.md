# Haste

A mental arithmetic speed trainer with detailed post-game analytics.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Push to a repo and import to Vercel — it autodetects Next.js.

## Notes

- Settings are persisted via `localStorage` in this prototype. To key by IP, add a Vercel KV-backed API route and read/write settings from there.
- Game keys: type the answer, **Tab** to restart, **Esc** to exit to home.
