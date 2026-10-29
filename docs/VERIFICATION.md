# Verification record — 2026-10-29

## Latest checkpoint: live Supabase transfer and app connection

Replit was inspected read-only with verified TLS. All 52 column definitions matched the exported app schema; database/schema.sql was updated from a live schema-only dump to preserve physical order too. Supabase received all 11 clients, 10 income records and 224 payment records in a committed transaction, with every row checksum, ID and sequence state verified before commit. RLS and browser-role restrictions were applied without changing server business logic. The source was not modified.

Both pooler connections, npm run db:check and a local production Next server were verified against Supabase. All 11 client IDs and all 11 read-only tax summaries matched original snapshot/engine results. The suite now passes 455 tests, including two pg TLS parsing regression tests; full TypeScript and optimized build passed. The official CA is bundled into the function, Vercel pool lifecycle handling is enabled and the region is iad1. See DATABASE_MIGRATION.md, database-transfer-verification.json and live-api-verification.json.

Still pending: actual Vercel environment/deployment checks, full CRUD/browser/report acceptance, and analyzer browser backup transfer. The earlier checkpoints below are historical and their missing-source/database limitations are superseded by the results above. npm audit currently reports seven entries; the added Vercel package dependency chain also references the already documented Zod advisory. No forced breaking dependency upgrade was applied.

## Follow-up: separate client directory

User requested moving All Clients from the dashboard bottom to the third Tax Planning Tools card and a separate /clients route. Implemented and verified dashboard card order, absence of the bottom directory, and navigation to the new client directory in the browser. Existing directory markup, creation and delete workflows were moved intact; no live CRUD check is claimed without a database. Current regression suite passes 453 checks (375 original calculation outputs plus 78 unchanged source modules); Home.tsx is now an explicitly authorized UI change rather than an unchanged-source assertion. Original fingerprints are retained. TypeScript and the optimized production build passed. Supabase connection and transfer instructions were added to DEPLOYMENT.md; no credentials or data transfer have been supplied or executed.

## Passed

- Current stable npm dist-tag queried directly: Next.js 16.4.3, pinned in package.json and package-lock.json.
- Dependency installation completed. Existing direct runtime dependency versions were pinned from the supplied pnpm lockfile. New Next/PostCSS integration dependencies use the npm lockfile.
- 454 automated checks: 375 frozen original-engine output comparisons and 79 byte-integrity checks of unchanged retained source modules. All passed, none skipped.
- Full TypeScript check passed.
- Optimized Next.js production build passed, including TypeScript, page generation and output tracing. Both catch-all UI and API routes are present.
- Production server started locally. Nine HTTP smoke checks returned 200: /, /s-corp-calculator, /tax-savings-analyzer, /tax-savings-analyzer/new, /clients/1, /api/healthz, /favicon.svg, /images/logo.png and /images/brand.png. Health returned {"status":"ok"}; API cache control is no-store. HTML success confirms route delivery, not successful database retrieval or complete client interaction.
- Browser dev preview rendered the original cosmetic gate, accepted the local test code, opened dashboard and S-Corp calculator, and rendered comparison results for synthetic $200,000 gross income / $80,000 salary. A viewport screenshot was saved outside the project as calculator-preview.jpg. Browser tooling recovered from its initial connection timeout.

## Still required

- Replit URL classification and real external connectivity check. No operational DATABASE_URL was supplied in the archives. No live customer database was contacted or changed.
- Live PostgreSQL CRUD, payment persistence, source/target row counts, concurrency behavior, schema drift and data transfer verification. An attempted isolated local PostgreSQL initialization was blocked by the Windows execution sandbox; no existing PostgreSQL service was modified.
- Visual comparison with the original running Replit app, mobile and full browser acceptance, analyzer backup restoration, all dialogs and report comparisons. S-Corp PDF export automation timed out waiting for the download; export success is unverified, not counted as a pass.
- GitHub push and Vercel deployment after local acceptance. Neither has been performed. Production authentication/protection must be verified before connecting real taxpayer data.
- Runtime validation on Vercel's configured Node 24.x. The available system runtime used for these tests was Node 22.20.0, supported by Next but below the project's intended Node 24 engine. Windows sandbox denied os.userInfo for tool processes; a temporary runner-only fallback in work/ was used for the test/build commands. That fallback is not shipped and does not change application code.

## Dependency audit

npm audit reported four entries: high zod, moderate postcss-selector-parser and its dependent @tailwindcss/typography, and low esbuild (dev tooling). These findings were not silently fixed through a breaking upgrade because exact compatibility was requested. The supplied zod 3.25.76 includes zod/v4 usage; npm's proposed major upgrade requires separate validation. Audit results change over time; rerun npm audit before deployment. Do not use npm audit fix --force without reviewing behavior and repeating parity checks.

## Interpretation

All three calculation engines, strategy definitions, business handlers and schema are unchanged. The tests establish strong source/output compatibility for the covered scenarios. They do not establish exhaustive 100% operational parity or tax-law correctness. Complete TESTING.md against a copied database and the original running app before final cutover.
