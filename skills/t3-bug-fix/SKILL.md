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

1. Pick a short kebab-case slug for the bug. Find the newest nightly: `gh release list -R pingdotgg/t3code --limit 20 --json tagName --jq '[.[] | select(.tagName | test("-nightly\\."))][0].tagName'`. Earlier runs end before their PR does, so trash each `~/code/t3code-bugs/<dir>` whose branch's upstream PR has merged or closed (`gh pr list -R pingdotgg/t3code --head <branch> --state all`), after checking it has no uncommitted or unpushed work.
2. Make an isolated instance: a standalone clone in `~/code/t3code-bugs/<slug>` that shares no state, ports, env, or credentials with the T3 Code you are running in or any other checkout. `--dissociate` copies the borrowed objects, so the clone doesn't depend on `~/code/t3code` afterwards:
   ```
   D=~/code/t3code-bugs/<slug>
   I=~/code/ai-files/skills/t3-bug-fix/scripts/isolated.ts
   git clone --reference-if-able ~/code/t3code --dissociate git@github.com:smirea/t3code.git $D
   git -C $D remote add upstream git@github.com:pingdotgg/t3code.git
   git -C $D fetch upstream main --tags
   git -C $D switch --detach <nightly-tag>
   $I $D vp i --frozen-lockfile -- --yes
   $I $D node scripts/dev-runner.ts dev --dry-run
   ```
   Run every command in the clone except `git` and `gai` through `$I $D` (`scripts/isolated.ts`, `--help` for details). Keep `$I` a single path: zsh doesn't split an unquoted variable, so `I="isolated.ts $D"` runs a file by that whole name. T3 Code's own safety nets only work inside a git worktree. Outside one, the dev server falls back to `~/.t3`, your live database, and to the default ports. It also inherits this thread's `T3CODE_*` variables, which point its `t3` CLI and agents at the live server. The wrapper drops those variables, sets `T3CODE_HOME` to the clone's `.t3`, and moves ports with `T3CODE_DEV_INSTANCE`. The dry run's `[dev-runner]` line must show `baseDir=<clone>/.t3` and the `t3-bug-fix-<slug>` instance. If it shows anything else, stop. Pass dev-runner flags directly, as above. `vp run dev -- --flag` hands the flag to the child processes instead.
   Don't run `scripts/setup-worktree.ts`: it needs a T3 project and symlinks the main checkout's `.env`, which holds the shared dev auth token. Don't add the clone as a T3 project, and don't drive it with the `t3` CLI or T3's thread tools, since those all talk to the live T3. Use `$I $D node apps/server/src/bin.ts ... --base-dir $D/.t3` instead. Read the clone's `AGENTS.md` now and follow it, above all "The three ways to hurt yourself": never touch `~/.t3/userdata`, never kill by pattern.
3. Reproduce it the way a user would, in the real client. When the bug shows in the web client, write the repro as a scenario first: `scripts/scenarios/<slug>.e2e.ts`, per the clone's [scenarios doc](https://github.com/pingdotgg/t3code/blob/main/docs/operations/scenarios.md), run with `$I $D vp run scenarios --target web scenarios/<slug>.e2e.ts` (`pnpm exec` there can fail to switch to the repo's pnpm version; `vp` doesn't). The runner starts its own server and browser, seeds through the CLI, and records captures and video, and `scenarios:prove` turns the same file into the proof in step 3. That proof is the evidence maintainers want: they closed an earlier fix for the same bug ([#14168](https://github.com/pingdotgg/t3code/pull/14168)) for having none, and ran their own scenario proof on [#37507](https://github.com/pingdotgg/t3code/pull/37507) before merging it.
   Use the `Replay (dev)` agent, not a paid model. Its recordings are the `SCENARIOS` in `apps/server/scripts/dev-replay-agent.ts`, and it covers running turns, steering (T3 steers it by interrupt and restart), approvals, and questions. A paid model is a last resort: take the cheapest, and keep its turn busy with a foreground command, since Claude Haiku moved a `sleep` into the background and ended its turn.
   Bugs a scenario can't reach (mobile, server-only, real data) get the dev server. If the bug needs real data, seed it first with `$I $D node apps/server/scripts/migrate-dev-db.ts --base-dir $D/.t3`. That makes a read-only copy of recent projects and threads and drops scheduled tasks, auth, and environment links; outside a worktree the dev server won't seed on its own. Start `$I $D node scripts/dev-runner.ts dev` as a background task, and stop it with the harness's stop, which ends the whole process tree. Open the `pairingUrl` it prints with T3's preview tools and drive it per `test-t3-app`, or `test-t3-mobile` for mobile. Capture a screenshot or short recording of the broken state into the scratchpad. Server-only bugs get a log or runtime transcript instead.
   The same repro runs again on the fix in step 3, so set it up to be re-run. Do through the CLI or HTTP whatever they cover (`$I $D node apps/server/src/bin.ts --help`, the server's routes), and save the steps and commands you used. Driving forms through `preview_evaluate` is slow and costs a lot of context; use it only for what has no other route. `preview_snapshot` with `save` writes into the live T3's `~/.t3/userdata/browser-artifacts`. Copy captures from there to the scratchpad and leave the originals alone. If the preview panel is hidden, its screenshots time out. Take them with the clone's own headless Chromium instead (`playwright-core`, from `scripts`), with a fresh pairing token from `$I $D node apps/server/src/bin.ts pair --base-dir $D/.t3`.
4. Check `upstream/main` too (`git log <nightly-tag>..upstream/main` for a likely fix, then reproduce there if anything looks related). The fix branches from `main`, so a bug already fixed there ends the run.
5. If it does not reproduce, stop: report what you tried and what you saw, and ask the user for missing steps.

## 2. Search for prior art

Search open and closed issues and PRs, with several phrasings (symptom, component, error text, file names you found):
```
gh search issues --repo pingdotgg/t3code --include-prs "<terms>" --limit 30 --json number,title,state,url,isPullRequest,updatedAt
```
Read every plausible hit, not just titles. Also check the commits between the nightly and `main`. The search is cheap, so once you know the bug well enough to search for it, you may do it before cloning in step 1.

If an open issue or PR covers it, or a merged one already fixed it, stop. CONTRIBUTING prefers a +1 to a second PR: report the links, and offer to comment with the repro and evidence. Commenting is public, so ask first.

## 3. Fix it on the fork, as a draft PR

1. Before anything else, question whether this is a bug at all, in parallel with the fix. CONTRIBUTING treats a change to intended behavior as a feature and closes it, and a repro only shows that the app does something, not that it's wrong. Start one research child through `delegate_task` (`role: research`, `mode: async`, the model on the `why investigators` line of the t3-pstack sheet, `~/.config/t3-pstack/models.md`), then carry on with the next steps while it works. Give it the user's description in their words, the repro steps and what you saw, the clone path (it only reads files and runs `git`, so it needs no `$I`), and the links above. Don't give it your view on whether this is a bug. Ask it to argue first that this is intended behavior, then that it is a bug, and to look at:
   - `docs/user/` and `docs/internals/`
   - tests that assert the current behavior
   - `git log -S` and `git blame` on the code involved, plus the PR that introduced the behavior and its discussion
   - maintainer comments in issues and [Ideas discussions](https://github.com/pingdotgg/t3code/discussions/categories/ideas)
   - CONTRIBUTING's rule on features

   It returns a verdict of `bug`, `intended`, or `unclear`, each point with a link or `path:line`. Step 4 acts on the verdict.
2. `gh repo sync smirea/t3code -b main` so the fork's `main` matches upstream (stop and tell the user if it has diverged), then `git -C $D fetch origin && git -C $D switch -c fix/<slug> origin/main && $I $D vp i --frozen-lockfile -- --yes`.
3. Find the root cause before writing the fix. Write the smallest change that removes the cause, with every part the fix needs (contracts, server, clients, tests) and nothing else: no refactor, no cleanup, no second fix. If the only real fix is a behavior change or a feature, stop and tell the user; CONTRIBUTING auto-closes those.
   List every route to the broken action before you settle the fix: the keyboard shortcut, a modifier-click, the button, and each client (web, desktop, mobile). Fix every route that shares the cause, and name the ones left alone, with the reason, in the PR's Scope. A review caught Cmd-click still broken after a Cmd+Enter fix, and the user asked about the other clients afterwards.
4. Prove it the way the repo's AGENTS.md "Verifying" section asks: a failing test first for logic, state, data, and protocol bugs (lowest layer that fails on `main`, extending an existing case); before and after captures for visual bugs. Then revert each changed source file in turn and check that the test or the scenario fails. A test that still passes without the entry-point change doesn't cover the bug; a review caught one that called the inner function directly. Run `$I $D vp run check:changed`.
   With a scenario from step 1, prove it: `$I $D vp run scenarios:prove scripts/scenarios/<slug>.e2e.ts --base origin/main`. It exits 0 only when the scenario fails on base and passes on head; exit 3 means the scenario broke on its way to the bug, so fix it and rerun. Its `markdown` (in `scripts/.e2e/prove/proof.json`) is the before/after table for the PR. Leave the scenario file out of the commit (upstream commits one with few fixes) and put its source in a `<details>` block in the PR. Without a scenario, re-run the step 1 repro on the fixed build and capture the after state.
5. Commit with a conventional title in plain language, such as `fix(web): new threads no longer spike CPU`, using `AI_COMITTER_NAME=<model> gai '<title>'`. Push to the fork.
6. Open a draft PR inside the fork, so nothing shows upstream yet: `gh pr create -R smirea/t3code --base main --head fix/<slug> --draft`, body following the upstream PR template (Problem, Change, Scope, Verification; leave Scope's issue link as a placeholder), ending with the model and harness that did the work. Attach every capture the issue or the upstream PR will show with `--attach`, embedded where it belongs, such as a before/after table. `--attach` only works on repos you can write to, so these `https://github.com/user-attachments/...` URLs are the ones step 4 reuses upstream. Link the PR in T3 (`link_pull_request`).

## 4. Review, then go public

1. Review: if the fork PR already has a Codex review (`chatgpt-codex-connector`), use it. Otherwise (it may skip drafts or not be on for the fork), don't wait for one: run one review child through `delegate_task` (`role: review`, `mode: async`, the Codex model on the sheet's `interrogate reviewers` line, or the newest Codex model `orchestrator_capabilities` lists). Give it the clone path and the rule that every non-git command there runs through `isolated.ts <clone>` (give the full path), the diff, the bug, the repro, and the repo's AGENTS.md and testing doc to judge against, not your conclusions. Fix every real finding, push, and re-review until clean.
   While a review runs, write the issue body as item 5 below describes, plus the upstream PR body with a `Fixes #<issue>` placeholder, into the scratchpad, then end the turn. The review's completion and the intent check's completion each wake you. File nothing upstream until the review is clean and the intent check is back. If a fix changes the root cause, the steps, or the captures, update both drafts.
2. Read the intent check's evidence yourself, not just the verdict. The verdict shapes how the issue and PR argue, not whether they go: the user wants every fix upstream, even when the check says `intended` (said on the #37507 run, which then merged).
   - `bug`: put its strongest evidence, such as the doc line the behavior breaks, in the issue's Expected behavior and the PR's Problem.
   - `intended` or `unclear`: lead with the bug-side evidence instead, such as a doc line the behavior contradicts or a user request dropped with no feedback, and tell the user the verdict and its evidence in the final message. Don't stop to ask.
3. Check the limit: at most 3 open upstream PRs (`gh pr list -R pingdotgg/t3code --author @me --state open`). At 3, stop and tell the user.
4. Rebase on fresh `upstream/main` and re-run `$I $D vp i --frozen-lockfile -- --yes` and `$I $D vp run check:changed` if it moved.
5. File the issue from the draft: `gh issue create -R pingdotgg/t3code --title "[Bug]: <title>" --body-file <file>`. Upstream rejects `--attach` and `--label` from someone without write access, and the call then creates nothing. Embed the captures with the fork PR's `user-attachments` URLs. The form's `bug` and `needs-triage` labels won't be applied; leave that to triage. Issue forms can't be submitted from the CLI, so write the body as the form's sections in order: `### Before submitting` (both boxes checked), `### Area` (one of the form's options), `### Steps to reproduce`, `### Expected behavior`, `### Actual behavior`, `### Impact` (one of the form's options), `### Version or commit` (the nightly tag and the `main` SHA), `### Environment`, `### Logs or stack traces`, `### Screenshots, recordings, or supporting files`, `### Workaround`. Be thorough: exact steps, the root cause in a sentence, and the captures. Redact secrets and home-directory paths. Don't mention the coming PR.
6. Within the same minute, open the upstream PR from the same branch, ready for review (draft status does not defer upstream triage): `gh pr create -R pingdotgg/t3code --base main --head smirea:fix/<slug>`, with the drafted body, its placeholder filled in with the issue number. Its embedded capture URLs carry over as they are. Close the fork draft PR with a comment linking the upstream one. Link the upstream PR in T3 and `unlink_pull_request` the fork one.
7. Babysit per the repo's AGENTS.md: `watch_pull_request` on the upstream PR and end the turn. On wake, verify each bot finding (Codex, Macroscope, CodeRabbit) against the source, fix real ones, reply to false positives with a reason.
   - Maintainers push to the branch (they merged `main` into both earlier PRs). Once the upstream PR is open, `git pull` before every fix and never force-push.
   - Macroscope's "Needs Human Approval" is a question about intended behavior, not a code finding. Reply once with the intent evidence.
   - A real finding that predates the PR and needs its own change: reply with why it's out of scope, resolve the thread, and offer the user a separate issue.
   - Stop when required checks are green and no review thread is open on the latest commit, then `unwatch_pull_request`; merging is the maintainers' call. Don't wait on workflows held for maintainer approval (GitHub holds them on fork PRs), on Codex re-reviewing a later push (it reviews once), or on CodeRabbit, which sometimes never posts.

## 5. Visual report

Write one HTML page and show it with `html_preview` and `html_render`: the bug in a sentence, before and after captures side by side, the root cause, the fix in a few lines (files touched, test added, which routes and clients it covers), and at the end the issue and PR links. Keep it to one screen.

## Cleanup

Stop the dev server with the harness stop for its background task, and confirm its ports are free (`lsof -nP -iTCP:<port> -sTCP:LISTEN`). Keep `~/code/t3code-bugs/<slug>` while the upstream PR is open, since review fixes land there; step 1 of a later run trashes it once the PR merges or closes. Trash the scratchpad copies of captures after they're uploaded, and close any preview tab you opened.
