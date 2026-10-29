# Local setup

## 1. Clone and install

Install Git and Node.js 24 LTS with npm. The repository pins the runtime family in .nvmrc and package.json. If you use nvm, run `nvm install` then `nvm use` (nvm-windows users select Node 24 with their installed version manager).

```sh
git clone https://github.com/Xghayor/tax-planner-pro.git
cd tax-planner-pro
node --version
npm --version
npm ci
```

Do not copy node_modules from the old Replit export. npm ci uses package-lock.json and the checked-in .npmrc. Do not switch package managers or regenerate dependencies for an unrelated feature.

## 2. Create local environment configuration

On Windows PowerShell, create the file only if it does not already exist:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

On macOS/Linux, copy .env.example to .env.local only if you do not already have local configuration. Never overwrite a configured environment file as a setup step. Fill in:

| Variable | Use |
|---|---|
| DATABASE_URL | Server-only PostgreSQL URL for an isolated development database. Use Supabase's transaction pooler on port 6543 when using Supabase. |
| NEXT_PUBLIC_ACCESS_CODE | Local cosmetic display code. This is public browser configuration, not API authentication. |
| LOCAL_MODE | Leave 0 or unset. The legacy two-port local mode is incompatible with this Next app. |

SOURCE_DATABASE_URL and MIGRATION_DATABASE_URL are optional operator-only transfer credentials, not required for ordinary feature work. Do not request or copy production/source credentials for unrelated tasks. This repository does not include operational passwords. Get development access privately from the owner or provision your own empty development database.

Supabase passwords with special characters must be URL-encoded inside the URI. Copy host, username, database and port from the dashboard Connect panel. connection-options.mjs applies the bundled official CA with certificate and hostname verification. Do not set NODE_TLS_REJECT_UNAUTHORIZED=0 or rejectUnauthorized=false. Local native PostgreSQL on loopback can use its normal local connection settings.

## 3. Choose a development database

Use an isolated Supabase development project or local PostgreSQL 16+. Never use the production database for feature branches or automated tests: the existing client-detail GET endpoint can create/recalculate persisted payment records.

For an EMPTY local database, after installing/configuring PostgreSQL and authenticating through its normal password prompt, a typical setup is:

```sh
createdb tax_planner_dev
psql --dbname tax_planner_dev --set ON_ERROR_STOP=1 --file database/schema.sql
```

Point DATABASE_URL to that database using your own local username/password. For an empty Supabase development database, apply database/schema.sql once using an authorized SQL client, then restrict its browser roles/RLS as appropriate for server-only use. Do not run the bootstrap against the already migrated production project. It is a schema-only initial setup, not an incremental migration or a customer backup. Source/target transfer results are documented in DATABASE_MIGRATION.md.

Create only synthetic test clients. Request a separately approved anonymized fixture if a scenario needs representative data; never commit a real database dump or a browser analyzer backup.

## 4. Run the app

```sh
npm run db:check
npm run dev
```

Open http://localhost:3000 and use the display code configured in NEXT_PUBLIC_ACCESS_CODE. Use the same hostname and port consistently: localhost and 127.0.0.1 have separate browser storage. Restart the server after database or credential changes; development pool reuse can retain an old connection. Public environment values also need a production rebuild.

Tax Savings Analyzer plans and drafts are browser-local and are separate from PostgreSQL. An empty plan list in a new browser origin does not mean the database transfer failed. See BROWSER_DATA_MIGRATION.md before changing origins or restoring backups.

## 5. Validate and run a production build

```sh
npm test
npm run typecheck
npm run build
npm start
```

Stop the development server before starting production on the same port. Tests and build do not require DATABASE_URL and never import customer data. db:check needs a reachable database. Run feature-specific manual checks in addition to these commands; follow TESTING.md. GitHub CI runs Node 24 on Linux without database secrets. The original Windows sandbox workaround in the historical verification notes is specific to that execution environment and is not part of normal setup.

## Troubleshooting

- Connection rejected: confirm the exact pooler URI, encoded password, project status and network connectivity. Free Supabase projects may pause. Restart the app after updating credentials.
- Certificate error: check the bundled CA and provider settings; retain TLS verification. Do not replace strict verification with a bypass.
- Missing relation: verify that DATABASE_URL points to the intended development database and its schema was initialized. Do not initialize a live target blindly.
- Cannot unlock display gate: confirm NEXT_PUBLIC_ACCESS_CODE, restart/rebuild and check the browser origin. The gate does not authenticate HTTP API requests.
- Integrity check failure after checkout: .gitattributes intentionally preserves existing bytes across platforms. Do not mass-normalize line endings or autoformat protected modules. Inspect the actual diff before changing any manifest.
