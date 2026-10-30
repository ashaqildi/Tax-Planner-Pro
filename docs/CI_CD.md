# CI/CD and agent playbook

The release path is: clone → feature branch → local checks → push → pull request → CI and preview → owner publication confirmation → squash merge to main → Vercel production → verify. Read AGENTS.md first. The detailed policy is in DEVELOPMENT_WORKFLOW.md; this page is the command reference and CI/CD operating guide.

## Start a task

Install Git, Node.js 24 and, optionally, GitHub CLI. Authenticate Git/CLI using your own account. Never share tokens with an agent in chat or commit credentials.

```sh
git clone https://github.com/Xghayor/tax-planner-pro.git
cd tax-planner-pro
git status --short --branch
git switch main
git pull --ff-only origin main
git switch -c feat/short-description
npm ci
```

For an existing checkout, skip clone and preserve unrelated edits before switching branches. Use fix/, docs/ or chore/ when appropriate. Read LOCAL_SETUP.md to create an ignored .env.local and use a separate development database. CI needs no database. Review acceptance criteria and calculation boundaries before editing.

## Implement, validate and submit

```sh
npm test
npm run typecheck
npm run build
git diff --check
git diff --stat
git status --short
git add path/to/intended-file
git diff --cached
git commit -m "feat: describe resulting behavior"
git push -u origin feat/short-description
gh pr create --draft --base main --head feat/short-description
```

Use the PR template and AI_TASK_TEMPLATE.md. Add browser evidence for UI work and isolated database checks for API/schema work. Preserve the frozen calculation outputs and source-integrity evidence. Do not add secrets or real customer fixtures. A missing credential is a setup issue, never a reason to disable TLS or use production data.

Without GitHub CLI, use GitHub's Compare & pull request link after pushing and select main as base. Once checks and evidence are complete, present the feature to the owner and ask whether to publish. A yes authorizes the agent to handle PR creation/update, checks, merge and deployment verification. Push fixes to the same branch; new code needs fresh confirmation.

## What runs automatically

| Event | GitHub Actions | Vercel Git integration |
| --- | --- | --- |
| Push feat/, fix/, docs/ or chore/ branch | validate: install, tests, typecheck, production build | Preview deployment when enabled |
| PR opened, reopened or updated against main | validate on the proposed merge | Preview/check link when enabled |
| Owner-confirmed PR squash-merged into main | validate again on main | Production deployment |
| Manual Actions dispatch | validate only | No deployment from this workflow |

CI has read-only repository permissions, pinned action SHAs, a time limit and cancellation of superseded runs. It never connects to Supabase, copies customer records, applies schema changes, or deploys with a Vercel token. Vercel already owns deployment through its Git integration; do not add a duplicate deployment job or VERCEL_TOKEN secret.

The required check is `validate`. Keep this name stable or update branch protection in a coordinated change. Do not add path filters that leave a required check pending. Failed tests, typechecks or builds block merging when protection is configured. Inspect the first failing Actions step, reproduce locally, fix on the branch, and push again. Do not weaken the rule or skip tests.

## Solo-owner publication gate

Follow [SOLO_RELEASE.md](SOLO_RELEASE.md). The agent presents the feature, validation and exact commit and asks whether to publish. After the owner says yes, the agent pushes the feature branch, creates/reuses its PR, waits for passing checks, and squash-merges that exact revision. No second person or formal GitHub approving review is required. Never create a fake approval review. New code revisions need fresh confirmation.

Keep main's PR requirement, validate status, up-to-date branches, resolved conversations, no administrator bypass and blocked force pushes/deletion. Disable Require approvals, stale approvals and latest-reviewable-push approval. Active rules must still be respected.

## Vercel configuration and release

Verify the Vercel project is connected to the current owner's repository (resolve it from origin after handover) and its Production Branch is main. Use Node.js 24 and the committed vercel.json. Branch/PR previews must use a separate synthetic-data database; keep Production DATABASE_URL scoped to Production. NEXT_PUBLIC_ACCESS_CODE is a cosmetic display gate and is public in the browser. Do not copy migration/source credentials into CI or Vercel.

Vercel Hobby private-repository deployments require the commit author to match the Vercel owner; collaborator previews may be blocked. A GitHub transfer does not transfer Vercel ownership. See SOLO_RELEASE.md.

Vercel previews can build before GitHub CI finishes. Protection on main is the pre-production gate. After a merge, Vercel starts its production build independently of the post-merge Actions run; a green Actions check is not proof of a Ready deployment. Verify Vercel's source commit and Ready status, deployment access protection, /api/healthz, affected routes and the changed workflow. Record the deployment URL and commit in the PR. Follow RELEASE_CHECKLIST.md for schema ordering and rollback.

If deployment fails, inspect the Vercel build/runtime logs without exposing credentials. Restore the last known good deployment or prepare a reviewed revert PR. App rollback does not reverse database changes. No database migration runs automatically in this pipeline.

After verified release:

```sh
git switch main
git pull --ff-only origin main
```

Delete the feature branch after confirming its PR is merged and no work remains. For the next task, create a new branch. Record actual enforcement and known gaps in REPOSITORY_STATUS.md rather than assuming settings were saved.

## Agent task prompt

> Read AGENTS.md and docs/CI_CD.md. Implement [specific change] on a focused branch from current main. Preserve existing tax behavior and unrelated work. Use synthetic data and an isolated database. Run tests, typecheck, build and affected manual checks. Push the branch and open a PR with evidence. Present the tested feature and exact commit and ask the owner whether to publish. After a clear yes, create/update the PR, wait for green checks, merge the confirmed revision and verify deployment. No second-person GitHub approval is required; never fabricate one. Report the branch, commit, PR, checks and next action.

References: [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [Vercel Git deployments](https://vercel.com/docs/git).
