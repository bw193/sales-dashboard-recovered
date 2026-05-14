# Sales Dashboard Recovery

Recovered dashboard source from the Cloudflare Pages deployment at:

https://1eda4048.sales-dashboard-7ry.pages.dev/

## Current state

- `public/index.html` is the recovered Cloudflare frontend.
- `public/sales-data.json` and `public/sales-data.js` are generated from the live `/api/sales` snapshot.
- The snapshot contains 593 records and was generated at `2026-05-14T00:49:24Z`.
- `functions/api/sales/` contains a rebuilt Cloudflare Pages Functions API for D1.
- `wrangler.toml` sets the Cloudflare Pages output directory to `public`.

## Local preview

Open `public/index.html` directly, or serve the `public` folder with any static server.

The recovered frontend expects `/api/sales` for live D1 data. Without a configured Cloudflare D1 binding, it falls back to `sales-data.js`.

## Cloudflare Pages settings

Use this repo as a Cloudflare Pages project, not a generic Worker static-assets deploy.

- Build command: leave blank
- Build output directory: `public`
- Deploy command: leave blank for Pages, or use `npx wrangler pages deploy public --project-name sales-dashboard-recovered` if Cloudflare asks for an explicit deploy command

Do not use `npx wrangler deploy` with the repo root as assets. That tries to upload `node_modules`.

## D1 binding

Bind the existing D1 database as `DB` in Cloudflare, or add the real values to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "your-existing-d1-database-name"
database_id = "your-existing-d1-database-id"
```

For add/edit/delete, configure a Cloudflare secret or environment variable named `SALES_ADMIN_TOKEN`.
