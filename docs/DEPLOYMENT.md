# Database, GitHub and Vercel

## Supabase option

The free Tax Manager organization and tax-manager project (lrgotnhjzvfhyzsikjub) have been created in North Virginia (us-east-1), with Data API disabled. Source schema and data transfer, strict TLS pooler connectivity, and the local production app have been verified. See SUPABASE_SETUP.md and DATABASE_MIGRATION.md.

vercel.json now explicitly enables Fluid Compute and places functions in North Virginia (iad1), matching the prepared database region. The app reuses a bounded pg pool, enables socket keepalive, handles idle socket errors without logging credentials, and attaches Vercel's database-pool lifecycle helper on Vercel. That helper closes idle connections before an instance suspends. Business requests are not automatically retried, since doing so could duplicate a committed write. These settings reduce avoidable connection failures; they cannot guarantee provider uptime or prevent free-tier project pauses. See [Vercel pool management](https://vercel.com/kb/guide/connection-pooling-with-functions).

Before deployment acceptance: set server-only DATABASE_URL in Vercel Production using the already tested Supabase transaction-pooler URI, retain the bundled verified-TLS configuration, use a separate test database for Preview, deploy, then repeat database and application checks remotely. The target schema/data and local production connection are already provisioned and verified; do not rerun schema.sql on this database. Local .env.local files are not deployed to Vercel. Do not hard-code or expose credentials, rotate them without updating all deployments, or use localhost/direct IPv6-only URLs in serverless configuration.

Supabase is compatible with the existing PostgreSQL/pg/Drizzle implementation. No Supabase browser SDK or change to calculation logic is required. For the deployed app, use the PostgreSQL Transaction pooler URI from Supabase's Connect panel as server-only DATABASE_URL. For a dump/restore, use the direct PostgreSQL or Session pooler URI, not the Transaction pooler. See [connection options](https://supabase.com/docs/guides/database/connecting-to-postgres) and [PostgreSQL migration guidance](https://supabase.com/kb/guides/migrate-from-postgres).

For the future data transfer, store SOURCE_DATABASE_URL (the externally reachable Replit source) and DATABASE_URL (the Supabase app destination) privately in .env.local. A separate direct/session destination URL may be needed for restore. A Supabase HTTPS project URL or anon/publishable API key is not a PostgreSQL connection string. No transfer has been run. Analyzer browser plans still require their own export/import. Before transfer, confirm the target, inspect source data read-only, take backups, restore into an empty target, and compare counts, IDs, constraints, sequence values and representative calculation outputs.

Supabase's Free plan is subject to database, storage and traffic quotas and project pausing; it is not an unconditional free-forever hosting guarantee. Check [current pricing](https://supabase.com/pricing) against actual data size and usage. Restrict Supabase's Data API access to application tables (or disable it if unused); the current app uses a server database connection and does not supply browser authorization policies.

## What Vercel hosts

Vercel hosts the Next UI and Node API functions. PostgreSQL runs externally. A smaller database does not make a PostgreSQL server deployable inside a Vercel function; local function files and process memory are not durable application storage. Retaining PostgreSQL avoids changing JSONB, decimal precision, SQL behavior or formulas.

Personal, non-commercial use is eligible for Hobby within its limits. The user confirmed personal use. This does not guarantee zero database costs. See [Vercel Hobby](https://vercel.com/docs/plans/hobby) and [function limits](https://vercel.com/docs/functions/limitations). Current configuration allows up to 300 seconds for the API function; actual runtime, payload, connection and plan limits still apply. Select Node 24.x on Vercel.

## Replit URL compatibility

[Replit connection details](https://docs.replit.com/features/data-and-storage/connection-details) distinguish these cases:

- Current development database: its URL is app-scoped and cannot be used by external apps. Moving that URL into Vercel will not work.
- Legacy Neon development database: credentials can allow external access. Confirm the host and connectivity with the read-only check.
- Production database: supports external PostgreSQL clients using its production Settings connection string. It may remain billable through Replit.

Put the correct external URL in `.env.local`, then run `npm run db:check`. The check only lists public tables. It must show clients, income_sources and estimated_payments. Verify actual schema compatibility before using existing data. Do not paste secrets into chat, documentation, screenshots or Git. Prefer the provider's pooled URL and TLS settings, keep TLS verification enabled, and URL-encode password characters. Three pool connections per function instance is a bound per instance, not a global connection limit.

The app's requirement is a standard PostgreSQL URL; there is no Replit-specific dependency. If external access or Replit cost is unacceptable, export the existing database and restore it to another managed PostgreSQL provider whose free limits fit your usage. That is a separate data transfer, not an automatic part of this code migration. Do not delete Replit before verifying the new database and browser backups.

## Database transfer

Prefer a full PostgreSQL dump/restore into an empty target so data, IDs, sequences, constraints and decimal values are preserved. Use pg_dump/pg_restore versions compatible with the source server. Supply credentials privately via environment or PostgreSQL password files; do not put passwords in shell history. Back up both sides first, pause writes for final cutover, and check row counts, serial sequences, foreign keys, per-year incomes, entity payment records and representative summaries. Restore into a test database first. Do not apply schema.sql on top of a full restored dump.

database/schema.sql is the supplied schema-only bootstrap for an EMPTY PostgreSQL database. It is not a data backup, incremental migration, or reconciliation tool. Apply it once with an authorized SQL client only when creating an empty database. The app intentionally never runs it automatically. Database dumps omit browser analyzer plans: use the in-app Download Backup / Restore Backup workflow separately for localhost and the final Vercel origin.

## GitHub after local acceptance

The deliverable is a standalone project folder, not the surrounding Codex workspace. Complete TESTING.md first. Create a private personal GitHub repository, initialize Git inside this project folder, review the files, then commit the source and package-lock.json. Push only after checking that .env.local, browser exports, database dumps, node_modules and .next are excluded. The dependency ZIPs are not needed. No remote repository has been created or pushed by this migration.

## Vercel setup

1. Import the personal GitHub repository into Vercel; choose Next.js. Use this project folder as root if it is nested in a larger repository. The checked-in vercel.json uses npm ci and npm run build.
2. Set DATABASE_URL as a server environment variable. Use a test database for preview deployments so testing cannot change live records.
3. Set NEXT_PUBLIC_ACCESS_CODE to the existing cosmetic gate code. It is public in the browser bundle and cannot protect the API. Set LOCAL_MODE=0 or leave it unset. The old LOCAL_MODE=1 two-port host checks are incompatible with Next's single port and Vercel hosts.
4. Enable Vercel Authentication deployment protection for the personal production deployment before exposing real data. Check the current plan's availability, and verify unauthenticated requests to BOTH the page and /api/clients are blocked. The source itself contains no server authentication. Preview protection alone does not prove production protection.
5. Deploy, verify /api/healthz, deep links, assets, reports and all data workflows against the test DB, then configure the production URL and rebuild as needed. Verify protection again on every public alias/custom domain. Restore browser plans on the final origin and compare totals with the original.
6. Keep the old app and backups available until acceptance is complete. If deployment fails or parity differs, return to the old app and database without deleting either.

No Vercel deployment or database mutation has been executed as part of preparing this deliverable.
