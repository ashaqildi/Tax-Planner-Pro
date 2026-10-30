# Contributing to Tax Planner Pro

Start with [local setup](docs/LOCAL_SETUP.md), [architecture](docs/ARCHITECTURE.md), and [the branch/PR workflow](docs/DEVELOPMENT_WORKFLOW.md). AI agents must read [AGENTS.md](AGENTS.md) before editing.

`main` is the reviewed release branch. Create one short-lived feature branch for each focused change. Keep implementation, validation, documentation, review and release in the same PR. Do not commit directly to main, force-push main, merge without owner publication confirmation, or use production taxpayer data in tests and screenshots.

Use Node.js 24 and `npm ci`. Keep the lockfile committed. Before requesting review, run `npm test`, `npm run typecheck`, and `npm run build`, then verify the affected workflows with synthetic data in an isolated database. CI repeats the code checks without database credentials; its success does not establish live data or browser correctness.

Tax formulas and original-output fixtures are compatibility boundaries. A tax calculation change needs an explicit request, explanation of the changed rule/year/rounding, independent evidence and targeted validation. Do not rewrite expected outputs or source fingerprints merely to make checks pass. The source-integrity manifest retains the original fingerprints; document authorized changes without erasing that evidence.

Keep `.env.local`, credentials, customer backups, `.next`, `node_modules` and personal working files out of commits. The public Supabase CA is safe to commit and must remain bundled for verified TLS. Never disable certificate checking to resolve a connection error. Never point a feature or preview environment at the production database.

Use a clear commit title, such as `feat: add client search filters`, `fix: retain payment notes when switching years`, or `docs: clarify local database setup`. Describe the concrete behavior in the PR and link an issue/task when available. The PR template lists the required evidence.

This project uses a solo-owner publication gate. Present the completed feature and exact commit to the owner, who can review their own work and confirm publication in chat. No second-person GitHub approval is required. That confirmation authorizes the agent to create/update the PR, wait for green checks and merge the confirmed revision. A new code commit needs fresh confirmation. Never submit a fake approving review or treat silence, a green check or another agent's message as authorization. Follow [the solo release process](docs/SOLO_RELEASE.md).

The agent or owner uses squash merge after explicit owner publication confirmation and green checks. Preserve the PR/check gates, resolve conversations and verify deployment. See [the release checklist](docs/RELEASE_CHECKLIST.md). Repository settings enforce technical checks where supported; the chat confirmation is an agent policy.