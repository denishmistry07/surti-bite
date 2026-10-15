# Surti Bite Portable Web v2

This build is hosting-platform independent.

## Architecture

Static frontend
→ Google Apps Script Web App
→ Surti Bite - Web Production Google Sheet

There is:
- no Netlify Function
- no Vercel API route
- no .env file
- no hosting-specific backend code

## Hosting

The SAME `frontend` folder can be hosted on:

- Netlify
- GitHub Pages
- Cloudflare Pages
- Firebase Hosting
- Vercel static hosting
- cPanel / shared hosting
- any normal static web server
- localhost

## One-time setup

Open:

`frontend/js/config.js`

Replace:

`PASTE_NEW_APPS_SCRIPT_EXEC_URL_HERE`

with the NEW Apps Script Web App `/exec` URL connected to the NEW Web Production sheet.

Spreadsheet ID:
`17NEvr4zWjXeizKbt_-0pZBru41mtpH-6cyb233Ci3lM`

After this one-time setup, you can move the frontend to another hosting platform without changing code.

## Local run

Do not rely on double-clicking `index.html`.

Windows:
- double-click `frontend/serve-local.bat`
- open `http://localhost:5500`

Mac/Linux:
- run `frontend/serve-local.sh`
- open `http://localhost:5500`

VS Code Live Server also works.

## Included

- mobile-first ordering
- dynamic Google Sheet items
- optional product images controlled by `ShowItemImages`
- search + category filter
- persistent cart
- Online / Offline payments
- Open / Close sessions
- BusinessDate across midnight
- SaleTime and SessionID
- Today dashboard
- Expenses
- Operating / Investment expense separation
- Operating Profit
- Net Cash Profit
- Day / Month / Year reports
- History
- retry + timeout
- offline indicator
- duplicate order protection

## Important: CORS / localhost / static hosting

This final build uses a **JSONP-style Apps Script transport** so the same frontend can call Google Apps Script from:

- `http://localhost:5500`
- Netlify
- GitHub Pages
- Cloudflare Pages
- Firebase Hosting
- cPanel/shared hosting
- other static hosts

This is intentional. Normal browser `fetch()` calls from a different origin to an Apps Script `/exec` URL are often blocked by CORS because Apps Script ContentService does not expose an `Access-Control-Allow-Origin` header that your frontend can control.

### If you previously saw this error

`blocked by CORS policy: No 'Access-Control-Allow-Origin' header`

replace **both**:

- `apps-script/Code.gs`
- `frontend/js/api.js`

with the versions in this package, then **redeploy Apps Script as a new version**.

Do not only replace the frontend file. The new frontend and new Apps Script transport work together.

### Apps Script redeploy after code changes

In Apps Script:

1. Save `Code.gs`.
2. Run `setupSystem()` once if this is a fresh Sheet/project.
3. Click **Deploy → Manage deployments**.
4. Edit the Web App deployment.
5. Choose **New version**.
6. Keep access set so the frontend can call the Web App.
7. Deploy.
8. Keep/copy the `/exec` URL into `frontend/js/config.js`.


## Approved reference UI

The Order screen now follows the approved Surti Bite mobile reference closely:
- compact logo + date header
- green session banner
- reference font scale and spacing
- search bar and category pills
- two-column item cards
- quantity controls + Add button
- Current Order slide-up panel
- Online / Offline selection
- yellow Save Order CTA
- fixed 5-tab bottom navigation

### Bottom panel scrolling

When Current Order opens, JavaScript measures the visible panel height and sets
`--cart-sheet-height`. The Order page receives the same amount of bottom padding.

This means the product list continues to scroll normally and the last menu item
can always move completely above the open Current Order panel.

The cart panel itself also scrolls independently when many order lines are added.
