## Change

Describe the user-visible problem, resulting behavior, and scope.

## Validation

- [ ] `npm ci` succeeds on Node.js 24.
- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] Relevant browser/database/report checks completed; describe any unavailable checks.
- [ ] CI `validate` is green for the latest commit.

## Compatibility and data

- [ ] Tax logic is unchanged, or the explicitly requested calculation change and independent evidence are explained.
- [ ] No secrets, customer data, database dumps, or browser backups are included.
- [ ] Schema/environment changes, migration order, and rollback are explained, if applicable.
- [ ] Documentation and AI context match the final implementation.

## Review evidence

Add screenshots for UI changes and a short test summary. Use synthetic data; redact private values.

## Approval and rollout

Record the sole owner's explicit publication confirmation and the exact commit it covers. No second-person GitHub approving review is required. After confirmation, the agent can create/update this PR, wait for passing checks, resolve conversations and squash-merge the same revision, then verify Vercel. Leave open if confirmation or checks are missing. Never submit a fake approval review. Follow docs/SOLO_RELEASE.md.