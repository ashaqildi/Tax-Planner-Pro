# Branch, review and merge workflow

This repository uses the [solo-owner confirmation process](SOLO_RELEASE.md): the owner confirms the feature revision, then the agent creates/updates the PR, waits for checks, merges and verifies deployment. No second-person approving review is required.

See [CI/CD command playbook](CI_CD.md) for fresh-clone commands, PR submission, deployment configuration and an agent task prompt.

## Branch policy

`main` contains reviewed release-ready changes. Work on one branch per task: `feat/<short-topic>`, `fix/<short-topic>`, `docs/<short-topic>`, or `chore/<short-topic>`. Names should describe the task and must not contain taxpayer names, emails or other private data. Avoid long-lived develop branches and unrelated changes in the same PR.

```mermaid
flowchart LR
  A[Agree scope] --> B[Update main]
  B --> C[Create feature branch]
  C --> D[Implement and document]
  D --> E[Local validation]
  E --> F[Push branch and open draft PR]
  F --> G[CI and isolated preview checks]
  G --> H[Owner tests feature and confirms publication]
  H -->|Changes requested| D
  H -->|Owner confirms and checks green| I[Authorized squash merge]
  I --> J[Verify deployment and data]
  J --> K[Sync main and clean up]
```

## 1. Start from current main

First inspect git status and preserve unrelated local edits. Do not stash, reset, clean or delete someone else's work automatically. Commit it on its appropriate branch or use a separate worktree when needed.

With a clean checkout:

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/your-topic
```

Use a task-appropriate name. Inspect AGENTS.md and architecture before implementation. Define acceptance criteria and decide whether UI, API, schema, stored plans, calculations, exports or environment configuration are affected. Future agents must use AI_TASK_TEMPLATE.md for a short plan/handoff when helpful.

## 2. Implement and validate

Preserve calculation boundaries and legacy data behavior unless an explicit request changes them. Update documentation with the implementation, not after the PR is approved. Use synthetic data and a separate development database.

Run:

```sh
npm test
npm run typecheck
npm run build
git diff --check
git diff --stat
git status --short
```

Also exercise affected user workflows. UI changes need browser evidence; schema changes need a reviewed forward migration and rollback/data-preservation plan; calculation changes need explicit authorization and independent expected results. A green build alone does not establish parity or database correctness. Do not reapply the original schema bootstrap to an existing database.

Stage and review only intended files. Keep secrets, .env.local, customer data, browser backups, build output and dependency folders out of Git. Use .env.example for variable names/placeholders. Preserve the existing source-integrity baseline; document authorized exceptions without regenerating original engine expectations from changed code.

```sh
git add path/to/changed-file
git diff --cached
git commit -m "feat: describe the resulting behavior"
git push -u origin feat/your-topic
```

Do not force-push main. If a branch is shared, prefer merging origin/main into it; do not rewrite another contributor's commits. Rebasing your private branch is optional, but coordinate before a force-with-lease update and do not do it merely to silence a conflict.

## 3. Open and review a PR

Open a draft PR with base main and the feature branch as head. Use .github/PULL_REQUEST_TEMPLATE.md. Describe the problem/result, validation, relevant risks, schema/environment requirements, rollout and rollback. Attach synthetic-data screenshots for UI work. The sole owner reviews the feature and confirms publication in chat; CODEOWNERS is optional routing. The agent can create the PR after confirmation or use an existing draft for testing.

CI workflow `CI` runs job `validate` on PRs to main, main pushes, and pushes to feat/, fix/, docs/ and chore/ branches. It installs locked dependencies, runs parity/connection tests, typechecks and builds without database credentials. Official actions are pinned to verified release commit SHAs. Do not add production secrets to PR CI, use pull_request_target to run untrusted code, or broaden workflow token permissions for a normal feature.

Present the validated feature and exact revision to the owner. After publication confirmation, the agent marks any draft ready and completes the checked merge. New code commits, including conflict resolutions, require renewed owner confirmation.

## 4. Owner publication confirmation is the gate

Follow SOLO_RELEASE.md. The sole owner can review their own feature and say yes to publishing the presented revision. That yes authorizes the agent to push, create/update the PR, wait for all checks (including the PR validate run), and squash-merge the exact confirmed head. No formal GitHub approval review or second account is required. Never fabricate a review.

Stop if confirmation is absent, checks fail, the head changes, main is out of date, conflicts exist or conversations remain unresolved. Any new code revision needs fresh owner confirmation. Keep the PR and report the blocker; do not bypass branch rules or push directly to main.

## 5. Merge and release

After the gate is satisfied, an authorized maintainer uses squash merge. Confirm the intended base, confirmed head SHA, owner authorization and checks at merge time. Never merge a stale reviewed revision after new commits. Keep the PR link and resulting main commit in the handoff.

Follow RELEASE_CHECKLIST.md. When GitHub is connected to Vercel, main may deploy automatically; a merge is therefore a release action. Production uses its own server-only DATABASE_URL. Preview branches use a separate test database and synthetic data, not live taxpayer records.

Once the merge and production checks succeed:

```sh
git switch main
git pull --ff-only origin main
```

Delete the feature branch only when its work is confirmed in main and no unmerged work remains. A squash merge may cause git branch -d to report unmerged commits despite a merged PR; inspect the merged PR and compare before deleting. Do not bypass this safeguard blindly.

## Repository owner setup

Markdown and CODEOWNERS communicate policy; branch protection/rulesets enforce it. For main, configure these in GitHub Settings → Rules/Rulesets or Branches:

- Require a pull request, with Require approvals disabled.
- Disable stale-approval dismissal, code-owner approval and latest-reviewable-push approval. Keep conversation resolution required.
- Require status check `validate` from the CI workflow. Enable it after the first successful CI run makes the check selectable. Prefer requiring the branch to be up to date.
- Block force pushes and branch deletion. Apply the rules to administrators/disable bypass where the plan supports it.
- Allow squash merges and automatic deletion of merged head branches if desired; do not enable unrestricted auto-merge.

CODEOWNERS alone does not enforce approval. GitHub's free plan supports protected branches for public repositories; private repository enforcement may require a paid plan. Do not change visibility or subscribe to a plan as a workaround. See [GitHub branch protection documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches).

Record actual configured settings in REPOSITORY_STATUS.md. Do not describe an unconfigured rule, unobserved approval or unrun CI check as enforced/passed. The migrated application is already on main and the owner reports Vercel deployment is working. All subsequent changes follow the feature-branch PR gate.
