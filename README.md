# Tax Planner Pro

Tax Planner Pro by Ahmad. The application retains the Tax Estimated Payment Manager interface and branding from the supplied project.

Migration of the supplied Replit export to Next.js 16.4.3 and TypeScript. Existing React screens, Express endpoints, PostgreSQL schema, tax algorithms, reports, and browser-storage behavior are retained. Next hosts the frontend and API in one deployment. This is a compatibility migration: Wouter and Express intentionally remain to preserve navigation and request handling.

Current database: Supabase tax-manager in North Virginia. The Replit snapshot has been transferred and verified: 11 clients, 10 income records and 224 payment records. Local credentials are configured in ignored .env.local; credentials and customer backups are excluded from the ZIP. See [database migration results](docs/DATABASE_MIGRATION.md). Vercel still needs its own server-only DATABASE_URL environment setting and deployed acceptance testing.

## Run locally

For a fresh clone, follow [the full local setup guide](docs/LOCAL_SETUP.md). It covers Node.js 24, locked dependencies, development databases, private environment values, browser storage and troubleshooting. Do not overwrite an existing .env.local or use the production database for feature tests.

Use Node.js 24 LTS and npm. In this folder:

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
# Edit .env.local with your database URL and existing cosmetic access code.
npm run db:check
npm run dev
```

Open http://localhost:3000. Never prefix DATABASE_URL with NEXT_PUBLIC_. The display code must use NEXT_PUBLIC_ACCESS_CODE because the original gate compares it in the browser. Restart dev after changing environment variables; rebuild production after changing the display code.

```powershell
npm test
npm run typecheck
npm run build
npm start
```

Builds do not read or write the database. Database endpoints require a working PostgreSQL URL at runtime. No automatic schema push, seed, or data import runs on startup, build, or deployment. Existing client-detail GET requests can create/recalculate payment records, exactly as in the original app; use a database copy for acceptance testing.

## Read next

- [Contributor instructions](CONTRIBUTING.md)
- [Feature branches, PR review and approved merges](docs/DEVELOPMENT_WORKFLOW.md)
- [AI task and handoff template](docs/AI_TASK_TEMPLATE.md)
- [Release and rollback checklist](docs/RELEASE_CHECKLIST.md)
- [Observed repository/branch controls](docs/REPOSITORY_STATUS.md)
- [AI context and architecture](docs/ARCHITECTURE.md)
- [Migration decisions and fidelity](docs/MIGRATION.md)
- [Database and Vercel deployment](docs/DEPLOYMENT.md)
- [Completed Replit-to-Supabase transfer](docs/DATABASE_MIGRATION.md)
- [Browser plan export/import](docs/BROWSER_DATA_MIGRATION.md)
- [Acceptance test checklist](docs/TESTING.md)
- [Verification results and remaining work](docs/VERIFICATION.md)
- [API contract](docs/openapi.yaml)

The source archives contain schema only, not customer data or an operational cloud URL. Connecting to an existing reachable database reuses its data; it does not copy it to Vercel. Browser analyzer plans need a separate backup and restore when changing origins.

The original display-code gate is not server authentication. For personal Vercel hosting, enable Vercel Authentication deployment protection for the production site and verify that it also protects /api URLs. Do not expose taxpayer data behind only the cosmetic gate.
