# Sales Dashboard Recovery

Recovered dashboard source from the Cloudflare Pages deployment at:

https://1eda4048.sales-dashboard-7ry.pages.dev/

## Current state

- `public/index.html` is the recovered Cloudflare frontend.
- `public/sales-data.json` and `public/sales-data.js` are generated from the live `/api/sales` snapshot.
- The snapshot contains 593 records and was generated at `2026-05-14T00:49:24Z`.
- `src/index.js` contains a rebuilt Cloudflare Workers API for D1.
- `functions/api/sales/` contains equivalent Pages Functions if you later recreate this as a Pages project.
- `wrangler.toml` deploys `public/` as Workers static assets.

## Local preview

Open `public/index.html` directly, or serve the `public` folder with any static server.

The recovered frontend expects `/api/sales` for live D1 data. Without a configured Cloudflare D1 binding, it falls back to `sales-data.js`.

## Cloudflare Workers settings

For the current Cloudflare Workers project connected to GitHub:

- Build command: leave blank
- Deploy command: `npx wrangler deploy`
- Non-production branch deploy command: leave blank
- Path: `/`

The `wrangler.toml` file points static assets at `public/`, so Wrangler will not upload `node_modules`.

If you recreate this as a classic Pages project instead:

- Build command: leave blank
- Build output directory: `public`
- Deploy command: leave blank

## D1 binding

Bind the existing D1 database as `DB` in Cloudflare, or add the real values to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "your-existing-d1-database-name"
database_id = "your-existing-d1-database-id"
```

For add/edit/delete, configure a Cloudflare secret or environment variable named `SALES_ADMIN_TOKEN`.
