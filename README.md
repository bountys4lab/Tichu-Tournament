# Tichu Cup Tournament App

Custom tournament flow:

1. Round 1: 12 teams → 6 winners
2. Group Stage: 6 teams → 2 groups of 3 → top 2 from each group advance
3. Finals: Semifinals → Final → Champion

## Run it

```bash
npm install
npm run dev
```

Open the localhost link Vite gives you.

## Scorekeeper

There is a scorekeeper view inside the same app.

Default PIN:

```text
1234
```

Change it in `src/App.jsx`:

```js
const SCORE_PIN = "1234";
```

## Notes

This version saves everything in browser localStorage.
For real online shared editing, connect Supabase later.
