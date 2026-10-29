# AI task and handoff template

Copy this outline into the task/PR description as useful. Do not store customer data or secrets in it.

## Before implementation

- Requested behavior and acceptance criteria:
- Current branch, clean/dirty checkout, base main commit:
- Related issue/PR:
- Relevant AGENTS.md / architecture / database / calculation boundaries:
- Intended files and expected impact:
- Database choice for tests (development/test only; no credentials):
- Validation plan:

Read AGENTS.md, README.md, LOCAL_SETUP.md, DEVELOPMENT_WORKFLOW.md and the files relevant to the task. Inspect the repository and available context before asking for information. Preserve unrelated edits. Create a focused branch from current main and work within the user's scope.

## Completion handoff

- Branch and latest commit:
- PR URL and base/head:
- Resulting behavior and why:
- Changed files/subsystems:
- Commands/checks run and outcomes:
- Browser/database/export evidence:
- Missing or blocked checks, stated explicitly:
- Schema/environment changes and ordering:
- Known compatibility limitations:
- Rollback approach:
- Human review/approval status:
- Merge authorization status and next owner action:

Do not equate a proposal with completion, a local check with remote CI, or a reviewed old commit with approval of a newer one. If review is pending, leave the PR open and report that state. If merge is authorized after approval, recheck the latest head, required checks and unresolved conversations before merging; then verify main/deployment and report the resulting commit.

For a resumed task, inspect its existing branch/PR and continue it. Do not create duplicates, start over, alter original parity baselines or perform unrelated tax-law updates. Authentication, branch protection, deployment, credential changes and data transfers must stay within their explicit task authorization and applicable tool policies.
