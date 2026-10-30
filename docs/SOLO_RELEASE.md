# Solo owner: confirm once, agent publishes

The owner can be the only contributor. No second person or formal GitHub approving review is required. The owner tests/reviews the feature, then explicitly authorizes publication. The agent handles the Git commands, pull request, check monitoring and merge. GitHub's ban on approving your own PR is respected: the agent does not create a fake approval review.

## Before asking to publish

1. Work on a focused feature branch from updated main. Read AGENTS.md and preserve calculation/data boundaries.
2. Implement and document the feature, run npm test, npm run typecheck and npm run build, and verify affected behavior with synthetic data.
3. Commit the intended files. Present the feature, local test/preview instructions, check results, limitations, rollback plan, branch and exact commit SHA.
4. Ask: "Feature [description] at commit [SHA] is ready. Publish it? Yes will push this branch, create/update its PR, wait for checks and squash-merge into main, which can deploy production."

Do not publish while the answer is pending. Silence, test success, an agent's opinion or a previous feature's confirmation is not authorization. "Yes, publish" for the presented feature authorizes the complete sequence below; do not ask the owner to create or approve a GitHub PR manually. An existing draft PR may be used for preview/testing before the confirmation, but it must not merge yet.

## After the owner says yes

The agent performs these steps through authenticated GitHub tools or GitHub CLI:

1. Verify the checkout is clean, branch is not main, and HEAD is still the commit the owner confirmed. If it changed, explain the difference and obtain fresh confirmation before publication.
2. Push only that feature branch. Resolve the repository from its current origin, so a handover does not keep sending work to Xghayor's old repository.
3. Reuse the branch's existing open PR against main, or create one using the PR template and actual implementation/validation evidence. Mark a draft ready when appropriate. Record the owner confirmation and confirmed SHA in the description. Never call gh pr review --approve or add an approval bot.
4. Wait for CI on the latest PR revision, including the validate job on the proposed merge. Check all reported checks, Vercel preview results when available, open review threads and merge conflicts. No reported CI job is not a passing result. Stop on failed, cancelled, skipped or missing validate checks. Diagnose failures on the branch; any new code commit requires fresh owner confirmation.
5. Confirm the PR still targets main, its head SHA matches the confirmed commit, main is up to date, checks passed and conversations are resolved. Squash-merge that exact head without administrator bypass. Do not use unattended auto-merge for future revisions.
6. Record the merged commit and verify Vercel production is Ready for that commit and the relevant functionality works. A merge alone is not a verified deployment. Report any deployment failure immediately and use the documented rollback process; do not alter data or hosting plans automatically.
7. Synchronize local main after preserving any unrelated work. Remove merged task branches only after checking for remaining work.

If the agent cannot authenticate, leave the branch/PR intact and report the exact action needed. Do not ask for tokens in chat. If there are conflicts, failing checks, unexpected rule changes or new commits, stop publication and explain what needs correction.

## CLI reference for the agent

Use current repository/branch values and real PR evidence, not literal placeholders. GitHub CLI must already be authenticated. Keep the PR body in an ignored local file and use --body-file, not shell-interpolated multiline text. On Windows PowerShell:

```powershell
$featureBranch = git branch --show-current
$confirmedHead = git rev-parse HEAD
# The owner must have confirmed this exact revision before proceeding.
git push -u origin $featureBranch
gh pr list --head $featureBranch --base main --state open
# Only if no matching PR exists:
gh pr create --base main --head $featureBranch --title 'Describe the resulting feature' --body-file work/pr-body.md
# Use the actual PR number returned above:
gh pr checks <PR_NUMBER> --watch --fail-fast
gh pr view <PR_NUMBER> --json headRefOid,baseRefName,mergeStateStatus,statusCheckRollup
# Confirm validate passed for the PR run and the head still equals $confirmedHead.
gh pr merge <PR_NUMBER> --squash --match-head-commit $confirmedHead
```

An agent executing commands one at a time must inspect exit codes and returned state at every step; never blindly paste the whole block. If checks have not been registered yet, wait for registration and recheck; never proceed on an empty check list. A failed command stops the sequence. Browser/API equivalents are allowed when CLI authentication is unavailable; the same checks and confirmation boundary apply.

## GitHub settings

Keep main's pull-request requirement, validate check, up-to-date requirement, resolved conversations, no administrator bypass and blocked force pushes/deletion. Turn off Require approvals, stale-approval dismissal, code-owner approval and approval of the most recent reviewable push. This allows a sole owner to merge their own PR after validation. If a future repository adds different review rules, respect them and request an explicit configuration decision rather than bypassing them.

The chat confirmation is an agent instruction, not a GitHub-enforced security control. Anyone with permission may still merge using GitHub under the applicable branch rules. Document observed enforcement in REPOSITORY_STATUS.md.

## Handover and hosting

Use the current owner's GitHub identity and remote. On Vercel Hobby with a private repository, the deployable commit author must match the Vercel owner. A different collaborator's commit/preview can be blocked; do not spoof authorship or add deployment workarounds. Report the restriction and let the owner decide on a supported hosting arrangement. GitHub ownership transfer alone does not transfer the Vercel project. Supabase can remain under its current account; production credentials belong only in the server environment, while development/preview use a separate database.

References: [CLI PR creation](https://cli.github.com/manual/gh_pr_create), [check monitoring](https://cli.github.com/manual/gh_pr_checks), [merge with matching head](https://cli.github.com/manual/gh_pr_merge), [Vercel Hobby collaboration](https://vercel.com/docs/deployments/troubleshoot-project-collaboration).
