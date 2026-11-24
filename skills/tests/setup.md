# Setting up checks

How a repo wires its lint, type check, tests, hook and CI. Read it when you create a repo, add a check, or bring an older repo in line with `SKILL.md`.

The templates in `~/code/stefan-utils/scripts/setup-new-app/files/` implement everything here: `lefthook.yml`, `github/*.yml`, `github/swift.ts`, and `swift/` for the `Core` target. Copy from them instead of writing a hook or a workflow from scratch, and change them in the same task when you change a rule here.

The numbers below were measured in these repos in November 2026.

## Tools

Use the fastest tool for each job. Every check is a package script, and the hook and CI call the same script.

| Job | Tool | Measured |
|---|---|---|
| Lint | oxlint | median 0.1 s per run |
| Type check, TypeScript | `bun check` | median 0.8 s per run |
| Type check, Svelte | `svelte-check-native` | |
| Tests, TypeScript | `bun test` | 2,384 tests in 3.2 s; 124 tests in 1.4 s |
| Compile and tests, Swift | `swift test` on the Mac | 99 tests in 2.7 s warm |
| App build, Swift | `xcodebuild build` for a generic simulator | median 249 s in CI |

Don't add eslint, prettier, oxfmt, the JavaScript `tsc`, jest, vitest, Playwright or `xcodebuild test`. Keep formatting out of generated repos; oxlint's `correctness` category (with default `typescript`, `unicorn`, and `oxc` plugins) handles bug detection without style or warning noise.

Four things the move to these tools needs:

- `bun check` follows TypeScript 7, which loads no `@types` package by default. Set `"types": ["bun"]` in `tsconfig.json`.
- Name the script `typecheck`. `bun check` runs a package script named `check` when one exists, and on a Bun too old to have the command that loops forever. Pin Bun in `.bun-version` and `packageManager`.
- oxlint loads only `.oxlintrc.json`. It ignores a file named `oxlint.json`, and the repo then lints with the defaults.
- `svelte-kit sync` needs the JavaScript API that TypeScript 7 dropped, so a SvelteKit app keeps `typescript` 6 beside `svelte-check-native`.

## Where logic is tested

- **TypeScript.** Logic lives in a plain module that imports no framework. Its test is a `*.test.ts` file beside it, run by `bun test`.
- **Stored data.** A rule that needs a database runs against an in-process one. It never talks to a server on a port.
- **Web UI and extension entrypoints.** They stay thin and call the plain modules. They get no tests. Verify them in the running app.
- **Logic with no runtime except a browser.** The repo's own instructions name that suite. It is its own CI job and never runs in the hook.
- **Swift.** Logic lives in a `Core` target with no UI or device framework imports. `Package.swift` builds it for `swift test`, and the Xcode project builds the same folder as a static library that the app links. The app target has no test target. `swift test` compiles the app's sources for macOS too, so it is also the fastest compile check.

## Pre-commit

One parallel group runs these, and the whole hook has 10 seconds on a warm machine:

1. Lint fixes on the staged JS/TS/Svelte files, restaged.
2. The type check over the whole project.
3. The whole TypeScript test suite.
4. `swift test`, when a Swift file is staged.

Select by stack, not by test. A `glob` on each job decides whether that stack's checks run at all. Within a stack, run every test. The largest suite here takes 3.2 seconds, so choosing tests through the import graph saves at most that. It also misses a test whose input is not an import, such as a fixture read from disk or a generated file.

When a suite passes 5 seconds, delete or speed up tests first. Add selection by import graph only after that.

A check gives the same result from a clean checkout. A test that reads a generated file regenerates it inside the script the hook and CI both call. A stale ignored file once failed three Swift tests on a green commit.

Every hook job that runs tests starts with `unset $(git rev-parse --local-env-vars)`. Git exports `GIT_DIR` and `GIT_INDEX_FILE` to hooks, so a test that runs git in a temp directory acts on the real repository. One such test set `core.bare` on a shared checkout.

No test runs at pre-push, because it would rerun what pre-commit just ran. A check on what a push publishes, such as a changeset or a changelog entry, may live there.

Nothing in a hook starts a browser, a simulator or a server, or uses the network.

## CI

CI repeats the hook's checks over the whole repo for what a hook can't see: a merge, a machine without hooks, and the build.

- **One job per check, all parallel.** A job costs about 10 seconds of setup (checkout, Bun, install) and no wall-clock time, so a run takes as long as its slowest check. A job has `needs` only when it consumes another job's output.
- **No change detection in front of cheap jobs.** A detection job delayed every other job by a median 10 to 12 seconds, and the Bun jobs themselves take 11 to 17. They run on every change.
- **Change detection only for macOS jobs.** It picks their runner. When native inputs did not change, each job reports success from a Linux runner, so a required check stays green.
- **Swift runs as two jobs.** `package` runs `swift test` on a macOS runner. `app` runs `xcodebuild build` for a generic simulator. Neither boots a simulator.
- **Swift tests stay off Linux.** A Linux container took as long (67 against 59 seconds, 36 of them pulling the image), and its build system crashed about once in 60 runs.
- **A newer push cancels the run in progress** through the workflow's `concurrency` group.
- **Deploy needs every check** and runs only on the default branch.
- **Bun jobs time out at 5 minutes.** The Bun side of a run should finish in under 2.

A CI failure the hook could have caught is a hook bug. Fix the hook.
