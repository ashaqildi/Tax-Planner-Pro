# Supabase setup status

Organization: Tax Manager (Free).

Project: tax-manager, reference lrgotnhjzvfhyzsikjub.

Region: East US (North Virginia), us-east-1. Vercel functions use iad1 with Fluid Compute enabled.

Dashboard: https://supabase.com/dashboard/project/lrgotnhjzvfhyzsikjub

Data API was disabled during project setup; this app uses server-side pg/Drizzle instead. The user entered and submitted the database password. No password is committed or recorded in this document.

Schema and source snapshot transfer are complete. Supabase contains 11 clients, 10 income records and 224 payment records; every row and sequence state was verified against the source snapshot. All 52 target columns match source types, nullability, precision and order. RLS is enabled and anon/authenticated table grants are revoked. Data API remains disabled.

Both session and transaction poolers passed certificate and hostname verification using the official Supabase CA. The local production app uses the transaction pooler and returns all 11 clients; every client's read-only tax summary matched the original engine. The source was accessed read-only. See DATABASE_MIGRATION.md and the JSON verification reports.

Credentials are configured only in ignored .env.local and are excluded from Git/Vercel uploads and ZIP deliverables. The app's database connection is Supabase; SOURCE_DATABASE_URL is reserved for migration tools. Vercel environment variables and a remote deployment test still need to be configured during deployment. A local environment file is not automatically uploaded to Vercel.
