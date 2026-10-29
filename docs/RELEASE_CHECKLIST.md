# Approved PR to production

## Before merge

Confirm the intended PR targets main, the latest revision has human approval, all required checks pass, conversations are resolved and merge is authorized. Review the final diff, schema/environment changes and validation evidence. GitHub author self-review does not count. Do not bypass an unmet branch rule.

For database changes, back up the target, inspect current schema and data read-only, and rehearse the migration against a copy. Keep changes compatible with both the old and new app during rollout where possible. Document whether schema or app deploys first, and how a failed rollout preserves data. database/schema.sql is the initial bootstrap and must not be rerun on production.

## Deploy

An authorized maintainer squash-merges the approved PR. Record the main commit. If Vercel's Git integration is enabled, this can trigger production deployment automatically. Otherwise an explicitly authorized deploy is still required; a Git push is not proof of a completed deployment.

Production uses server-only DATABASE_URL for the Supabase transaction pooler and Node.js 24. vercel.json uses North Virginia (iad1), matching the database. Keep Fluid Compute and the pool lifecycle helper enabled, and keep the bundled official CA with strict TLS verification. Configure environment variables in Vercel itself: .env.local is deliberately not uploaded. Rebuild/redeploy after changing them. Preview environments must use a separate test database.

Before public access to taxpayer records, verify deployment access protection for every production alias and direct /api URLs. The original browser passcode is cosmetic and does not authorize API requests. This release checklist does not add a login system or claim that protection has already been configured.

## Verify

- Confirm the Vercel deployment is built from the intended main commit and is Ready.
- Check /api/healthz, page deep links, assets and server database connectivity on the deployed hostname.
- Compare representative read-only client/tax-summary output and check logs for connection/TLS failures without logging taxpayer data or URLs.
- Exercise the changed user workflow using an approved test record or test environment; avoid triggering writes on live records merely to inspect them.
- Verify exports and browser analyzer storage/backup behavior if the change affects them. Browser plans do not migrate with PostgreSQL and do not automatically follow a new domain.
- Record success, limitations, deployment URL and rollback commit in the PR/handoff.

## Roll back if needed

Use the last known good Vercel deployment or a reviewed Git revert PR. Do not force-reset main or delete live data. App rollback does not automatically undo a schema/data migration; follow the reviewed data-specific plan and preserve backups. If a credential is rotated, update both local and Vercel configuration together and redeploy. Pooling cannot prevent provider outages, quota limits or free-project inactivity pauses.

After acceptance, synchronize local main and clean up merged task branches. Keep the PR and verification record as the audit trail. For a future change, start a new focused branch from updated main.
