---
name: tests
description: The rules for tests in the user's own repos. Read it before writing, changing, deleting or fixing a test, before acting on a failing test, git hook or CI check, and before adding a check to a hook or to CI. It sets which tests may be committed, how to classify a failing test before editing anything, and where each check runs.
---

# Tests

A test is a standing cost. It runs on every change, and someone has to keep it true for as long as it exists. Commit one only when it buys more than that.

The bar is high because of an audit of a month of agent sessions in these repos (November 2026). Half of the local test failures were upkeep of the tests themselves, 16% pointed at a real bug, and 4% were an existing test catching a regression. Most failed browser runs in CI were flakes.

These rules cover repos the user owns. In someone else's repo, such as a fork of an upstream project, follow that repo's testing rules. Where another skill or playbook step calls for a test these rules reject, these rules win.

## Verify first, test second

- Prove a change works by running the real thing, as "Done means" in the global instructions says. That needs no committed test.
- A throwaway test or script is a fine tool while you work. Keep it in the scratchpad and never commit it.

## Commit a test only when all of these hold

1. It states a rule someone decided: a business rule, an invariant, or a contract between two parts (a wire format, sync, a migration, permissions, money, dates and recurrence, parsing). The rule, as one plain sentence, is the test's name. If you can't write the sentence, there is no test.
2. Breaking the rule would be silent or expensive: wrong data that looks fine, or something a person using the app for a minute would not notice.
3. It checks outcomes through the module's public interface, so it survives any refactor that keeps the rule.
4. It runs in-process in milliseconds, with no browser, simulator, network, real clock or sleep.

## Never write

- Browser, end-to-end, UI-driving or snapshot tests. The one exception is a suite the repo's own instructions name as logic that has no runtime except a browser. That suite never drives UI.
- Tests of wiring, config, glue, or anything the type checker already guarantees.
- Assertions on copy, labels, selectors, layout, log lines, call or query counts, or an ordering nobody decided.
- Tests whose mocks restate the implementation.
- A test per function or per file, or a test added because a change "should have tests".

## Bug fixes

If the bug broke a rule in logic, write the test that fails because of it, then fix the code. If the bug is in UI or wiring, reproduce it in the running app, fix it, and show it gone. That bug gets no test.

## When a test fails

Classify the failure before you edit anything, and say which class it is in one line.

1. **It never ran.** A compile error, a stale generated file, a busy port, a missing env value or the hook's environment stopped it. Fix the environment. Touch neither the test nor the code under test.
2. **The rule in its name is still wanted.** The code is wrong, so fix the code. Never edit an expectation to match new output.
3. **The task changes that rule on purpose.** Update the test, rename it to the new rule, and call out the rule change in the commit and the final message.
4. **It fails on something that is not a rule**, such as wording, structure, timing or an incidental count. Delete that assertion or the whole test. Do not patch in the new value.
5. **It passes on a rerun with nothing changed.** One rerun is allowed to establish that. Then remove the nondeterminism or delete the test. Never add a sleep, a retry or a longer timeout.
6. **It fails on the base commit too.** Say so, and fix it only if the fix is small.

When you can't tell whether an assertion is a rule, it is not one. Delete it.

A test you are writing that is still red after three attempts, while the product behaves correctly, is the problem. Delete it.

## Trim as you go

A test you touch that fails the bar above is deleted in the same change. List every test you added, changed or deleted, with the reason, in the final message.

## Where checks run

`setup.md` in this folder has the tools, the hook and CI layout, and the measurements behind them. Read it before you add a check or set up a repo.

- **pre-commit** runs format, lint and typecheck with the fastest tool the repo has, then the whole logic suite. The budget is 10 seconds in total. Nothing in a hook starts a browser, a simulator or a server. A step over budget gets a faster tool or fewer tests. It is never skipped. There is no pre-push hook.
- **CI** runs the same checks over the whole repo, each as its own parallel job, in under 2 minutes. A CI failure the hook could have caught is a hook bug, so fix the hook.
- **iOS** logic worth testing lives in a `Core` Swift package with no UI or device framework imports (SwiftUI, UIKit, HealthKit, WidgetKit, ActivityKit), and runs under `swift test` on the Mac. The app target has no test target, and no test builds the app or boots a simulator. A logic type that needs a colour, an icon or a view gets it from an extension in the app target. Logic that cannot run without the app host is verified in the running app instead.

## Repos that don't match yet

Some repos still have browser suites, app-hosted Swift tests or slow hooks. Moving a repo to these rules is its own task, so don't start it as a side effect of another change. Until then, add nothing to those suites, and apply "When a test fails" to the tests that exist.
