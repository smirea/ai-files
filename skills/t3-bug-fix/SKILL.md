---
name: t3-bug-fix
description: Report and fix a T3 Code bug upstream. Reproduce it on the latest nightly in a fresh clone, check GitHub for prior art, build the minimal root-cause fix as a draft PR on the user's fork, get it reviewed, then file the upstream issue and open the upstream PR back to back, and end with a visual report. Run only when the user invokes it with a bug description.
disable-model-invocation: true
argument-hint: "<bug description>"
---

Bug: $ARGUMENTS

If the harness didn't fill that in, the description is the rest of the user's message. If there is none, stop and ask for one.

The order is the point. T3 Code's maintainers run bots that turn new issues into PRs within minutes: issue [#31153](https://github.com/pingdotgg/t3code/issues/31153) got a maintainer PR ([#31174](https://github.com/pingdotgg/t3code/pull/31174)) 36 minutes after it was filed, and it was kept over ours ([#31159](https://github.com/pingdotgg/t3code/pull/31159)). So the fix is finished, reviewed, and sitting on the fork before anything appears upstream, and the issue and the upstream PR go out in the same minute.

## Links

- Upstream: [pingdotgg/t3code](https://github.com/pingdotgg/t3code) (`main`). Fork: [smirea/t3code](https://github.com/smirea/t3code). Local reference checkout: `~/code/t3code` (`origin` = fork, `upstream` = upstream). Never work in it; it is someone else's branch.
- Rules: [CONTRIBUTING.md](https://github.com/pingdotgg/t3code/blob/main/CONTRIBUTING.md), [AGENTS.md](https://github.com/pingdotgg/t3code/blob/main/AGENTS.md), [development runbook](https://github.com/pingdotgg/t3code/blob/main/docs/operations/development.md#first-checkout), [testing](https://github.com/pingdotgg/t3code/blob/main/docs/internals/testing.md), [scenarios](https://github.com/pingdotgg/t3code/blob/main/docs/operations/scenarios.md). Re-read them from the clone each run; they change often.
- Templates: [bug report form](https://github.com/pingdotgg/t3code/blob/main/.github/ISSUE_TEMPLATE/bug_report.yml), [PR template](https://github.com/pingdotgg/t3code/blob/main/.github/pull_request_template.md).
- Nightlies: [releases](https://github.com/pingdotgg/t3code/releases), tagged `v<version>-nightly.<date>.<n>`, built a few times a day by [release.yml](https://github.com/pingdotgg/t3code/blob/main/.github/workflows/release.yml).
- Search: [issues](https://github.com/pingdotgg/t3code/issues?q=is%3Aissue), [PRs](https://github.com/pingdotgg/t3code/pulls?q=is%3Apr).
- Repo skills for driving the app: [test-t3-app](https://github.com/pingdotgg/t3code/blob/main/.agents/skills/test-t3-app/SKILL.md) (web and desktop), [test-t3-mobile](https://github.com/pingdotgg/t3code/blob/main/.agents/skills/test-t3-mobile/SKILL.md).

## 1. Reproduce on the latest nightly

1. Pick a short kebab-case slug for the bug. Find the newest nightly: `gh release list -R pingdotgg/t3code --limit 20 --json tagName --jq '[.[] | select(.tagName | test("-nightly\\."))][0].tagName'`.
2. Clone fresh into `~/code/t3code-bugs/<slug>`, borrowing objects from the local checkout so it takes seconds:
   ```
   git clone --reference-if-able ~/code/t3code --dissociate git@github.com:smirea/t3code.git ~/code/t3code-bugs/<slug>
   cd ~/code/t3code-bugs/<slug>
   git remote add upstream git@github.com:pingdotgg/t3code.git
   git fetch upstream main --tags
   git switch --detach <nightly-tag>
   node scripts/setup-worktree.ts
   ```
   `setup-worktree.ts` is what `t3.json` runs for a new worktree (install, ports, env links). Read the repo's `AGENTS.md` now and follow it, above all "The three ways to hurt yourself": never touch `~/.t3/userdata`, never kill by pattern.
3. Reproduce it the way a user would, in the real client: `vp run dev` (it seeds the clone's `.t3` from a copy of real data) and drive it with T3's preview tools per `test-t3-app`, the `Replay (dev)` provider instead of paid turns, and `test-t3-mobile` for mobile. Capture a screenshot or short recording of the broken state into the scratchpad. Server-only bugs get a log or runtime transcript instead.
4. Check `upstream/main` too (`git log <nightly-tag>..upstream/main` for a likely fix, then reproduce there if anything looks related). The fix branches from `main`, so a bug already fixed there ends the run.
5. If it does not reproduce, stop: report what you tried and what you saw, and ask the user for missing steps.

## 2. Search for prior art

Search open and closed issues and PRs, with several phrasings (symptom, component, error text, file names you found):
```
gh search issues --repo pingdotgg/t3code --include-prs "<terms>" --limit 30 --json number,title,state,url,isPullRequest,updatedAt
```
Read every plausible hit, not just titles. Also check the commits between the nightly and `main`.

If an open issue or PR covers it, or a merged one already fixed it, stop. CONTRIBUTING prefers a +1 to a second PR: report the links, and offer to comment with the repro and evidence. Commenting is public, so ask first.

## 3. Fix it on the fork, as a draft PR

1. `gh repo sync smirea/t3code -b main` so the fork's `main` matches upstream (stop and tell the user if it has diverged), then `git fetch origin && git switch -c fix/<slug> origin/main`.
2. Find the root cause before writing the fix. Write the smallest change that removes the cause, with every part the fix needs (contracts, server, clients, tests) and nothing else: no refactor, no cleanup, no second fix. If the only real fix is a behavior change or a feature, stop and tell the user; CONTRIBUTING auto-closes those.
3. Prove it the way the repo's AGENTS.md "Verifying" section asks: a failing test first for logic, state, data, and protocol bugs (lowest layer that fails on `main`, extending an existing case); before and after captures for visual bugs; `vp run scenarios:prove` when the bug reproduces in the web client. Run `vp run check:changed`. Re-run the step 1 repro on the fixed build and capture the after state.
4. Commit with a conventional title in plain language, such as `fix(web): new threads no longer spike CPU`, using `AI_COMITTER_NAME=<model> gai '<title>'`. Push to the fork.
5. Open a draft PR inside the fork, so nothing shows upstream yet: `gh pr create -R smirea/t3code --base main --head fix/<slug> --draft`, body following the upstream PR template (Problem, Change, Scope, Verification; leave Scope's issue link as a placeholder), ending with the model and harness that did the work. Attach before and after captures with `--attach`. Link the PR in T3 (`link_pull_request`).

## 4. Review, then go public

1. Review: if the fork PR already has a Codex review (`chatgpt-codex-connector`), use it. Otherwise (it may skip drafts or not be on for the fork), don't wait for one: run one review child through `delegate_task` (`role: review`, `mode: wait`, a Codex model from `orchestrator_capabilities`, falling back to the t3-pstack sheet's review entry). Give it the clone path, the diff, the bug, the repro, and the repo's AGENTS.md and testing doc to judge against, not your conclusions. Fix every real finding, push, and re-review until clean.
2. Check the limit: at most 3 open upstream PRs (`gh pr list -R pingdotgg/t3code --author @me --state open`). At 3, stop and tell the user.
3. Rebase on fresh `upstream/main` and re-run `vp run check:changed` if it moved.
4. File the issue: `gh issue create -R pingdotgg/t3code --title "[Bug]: <title>" --body-file <file> --attach <capture>...`. Issue forms can't be submitted from the CLI, so write the body as the form's sections in order: `### Area` (one of the form's options), `### Steps to reproduce`, `### Expected behavior`, `### Actual behavior`, `### Impact` (one of the form's options), `### Version or commit` (the nightly tag and the `main` SHA), `### Environment`, `### Logs or stack traces`, `### Screenshots, recordings, or supporting files`, `### Workaround`. Be thorough: exact steps, the root cause in a sentence, and the captures. Redact secrets and home-directory paths. Don't mention the coming PR.
5. Within the same minute, open the upstream PR from the same branch, ready for review (draft status does not defer upstream triage): `gh pr create -R pingdotgg/t3code --base main --head smirea:fix/<slug>`, the fork PR's body with `Fixes #<issue>` in Scope, and the captures attached again. Close the fork draft PR with a comment linking the upstream one. Link the upstream PR in T3 and `unlink_pull_request` the fork one.
6. Babysit per the repo's AGENTS.md: `watch_pull_request` on the upstream PR and end the turn. On wake, verify each bot finding (Codex, Macroscope, CodeRabbit) against the source, fix real ones, reply to false positives with a reason. Stop when bots are green on the latest commit and `unwatch_pull_request`; merging is the maintainers' call.

## 5. Visual report

Write one HTML page and show it with `html_preview` and `html_render`: the bug in a sentence, before and after captures side by side, the root cause, the fix in a few lines (files touched, test added), and at the end the issue and PR links. Keep it to one screen.

## Cleanup

Stop the dev server by its tracked PID. Keep `~/code/t3code-bugs/<slug>` while the upstream PR is open, since review fixes land there; trash it once the PR merges or closes. Trash scratch captures after they're uploaded.
