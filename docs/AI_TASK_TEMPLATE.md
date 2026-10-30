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
- Owner publication confirmation and exact confirmed SHA:
- Merge authorization status and next owner action:

Do not equate a proposal with completion or a local check with remote CI. Present the feature and exact commit, ask the sole owner whether to publish, and record the response. After an explicit yes, create/update the PR, monitor checks, confirm the head has not changed, squash-merge without bypass, and verify deployment. No second-person approving review is required and no fake review is submitted. If authorization or checks are missing, leave the PR open. Follow SOLO_RELEASE.md.

For a resumed task, inspect its existing branch/PR and continue it. Do not create duplicates, start over, alter original parity baselines or perform unrelated tax-law updates. Authentication, branch protection, deployment, credential changes and data transfers must stay within their explicit task authorization and applicable tool policies.
