# Repository workflow status

Repository: https://github.com/Xghayor/tax-planner-pro

Default branch: main. Repository visibility observed as public. The existing main commit at setup was 95382abc55e013c3bdad70f79a58908ad476ee52, containing only README.md. That history is preserved.

The migrated app and workflow are prepared on feat/nextjs-supabase-migration for a PR against main. Local checks pass: 455 tests, TypeScript and optimized production build. The staged Git blobs preserve all 78 unchanged source fingerprints; credentials, customer backups and generated/dependency folders are excluded. Git's whitespace check reports inherited trailing spaces in retained original source; these were left intact to preserve the migration baseline.

Publication, PR creation, remote CI and branch-protection configuration are not yet verified. Git authentication is unavailable in the Codex execution environment; the owner is taking over the push from their own terminal. Main must not receive the feature before its PR is approved and merge is authorized.

Committed workflow resources:

- AGENTS.md: AI context, feature branch and approval gates.
- CONTRIBUTING.md and docs/LOCAL_SETUP.md: development setup and contributor rules.
- docs/DEVELOPMENT_WORKFLOW.md: scope → branch → implement → validate → PR → human approval → authorized squash merge → deployment verification.
- docs/AI_TASK_TEMPLATE.md and docs/RELEASE_CHECKLIST.md: resumable handoffs, rollout and rollback.
- .github/workflows/ci.yml: Node 24, npm ci, tests, TypeScript and production build, without database secrets. Expected check: validate.
- .github/PULL_REQUEST_TEMPLATE.md and CODEOWNERS: review evidence and owner routing.
- .gitattributes: exact source-byte preservation for cross-platform parity checks.

Markdown/CODEOWNERS do not themselves enforce branch protection. After the first successful CI run, configure required reviews and validate status on main as described in DEVELOPMENT_WORKFLOW.md. An author's own approval cannot satisfy GitHub's approving-review requirement; a self-authored PR needs a different eligible human collaborator. Never report those controls as active until their actual settings are verified.
