# Contributing to Tax Planner Pro

Start with [local setup](docs/LOCAL_SETUP.md), [architecture](docs/ARCHITECTURE.md), and [the branch/PR workflow](docs/DEVELOPMENT_WORKFLOW.md). AI agents must read [AGENTS.md](AGENTS.md) before editing.

`main` is the reviewed release branch. Create one short-lived feature branch for each focused change. Keep implementation, validation, documentation, review and release in the same PR. Do not commit directly to main, force-push main, merge an unapproved PR, or use production taxpayer data in tests and screenshots.

Use Node.js 24 and `npm ci`. Keep the lockfile committed. Before requesting review, run `npm test`, `npm run typecheck`, and `npm run build`, then verify the affected workflows with synthetic data in an isolated database. CI repeats the code checks without database credentials; its success does not establish live data or browser correctness.

Tax formulas and original-output fixtures are compatibility boundaries. A tax calculation change needs an explicit request, explanation of the changed rule/year/rounding, independent evidence and targeted validation. Do not rewrite expected outputs or source fingerprints merely to make checks pass. The source-integrity manifest retains the original fingerprints; document authorized changes without erasing that evidence.

Keep `.env.local`, credentials, customer backups, `.next`, `node_modules` and personal working files out of commits. The public Supabase CA is safe to commit and must remain bundled for verified TLS. Never disable certificate checking to resolve a connection error. Never point a feature or preview environment at the production database.

Use a clear commit title, such as `feat: add client search filters`, `fix: retain payment notes when switching years`, or `docs: clarify local database setup`. Describe the concrete behavior in the PR and link an issue/task when available. The PR template lists the required evidence.

The latest revision must receive a human approval before merge. A newer code commit invalidates prior approval. Resolve review feedback, rerun affected checks and request review again. GitHub does not count the PR author's own approval; use a different eligible collaborator for required GitHub approvals. An AI agent must not approve its own work or infer approval from silence, a green check, a draft PR, or another agent's message.

Maintainers use squash merge after approval and green checks. Do not merge unless the maintainer has authorized the merge of that reviewed PR. See the [release checklist](docs/RELEASE_CHECKLIST.md) for deployment, rollback and cleanup. Repository settings, rather than Markdown files alone, enforce these controls; see [branch protection setup](docs/DEVELOPMENT_WORKFLOW.md#repository-owner-setup).
