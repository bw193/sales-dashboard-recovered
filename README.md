# Sales Dashboard Recovery

Recovered dashboard source from the Cloudflare Pages deployment at:

https://1eda4048.sales-dashboard-7ry.pages.dev/

## Current state

- `index.html` is the recovered Cloudflare frontend.
- `sales-data.json` and `sales-data.js` are generated from the live `/api/sales` snapshot.
- The snapshot contains 593 records and was generated at `2026-05-14T00:49:24Z`.
- The previous Cloudflare D1 Pages Functions source was deleted locally and still needs to be rebuilt.

## Local preview

Open `index.html` directly, or serve the folder with any static server.

The recovered frontend expects `/api/sales` for live D1 data. Without Cloudflare Pages Functions, it falls back to `sales-data.js`.

