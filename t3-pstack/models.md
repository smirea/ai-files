# pstack model configuration (T3). One line per role. Delete a line to fall back to the skill default.
# `inherit-parent` or `auto` as a value: the role runs on the parent chat's model (`delegate_task` omits `target`). Alias entries in a panel list still count toward its fan-out.
# budget: small (medium)
feature, refactoring: claudeAgent/claude-opus-5-5 effort=medium
bug-fix: claudeAgent/claude-opus-5-5 effort=medium
perf-issue: claudeAgent/claude-opus-5-5 effort=medium
hillclimb: claudeAgent/claude-opus-5-5 effort=medium
judgment and prose: claudeAgent/claude-opus-5-5 effort=medium
hardest tasks: claudeAgent/claude-fable-5-2 effort=medium
how explorer: claudeAgent/claude-opus-5-5 effort=medium
how explainer: claudeAgent/claude-opus-5-5 effort=medium
why investigators: claudeAgent/claude-opus-5-5 effort=medium
why synthesizer: claudeAgent/claude-opus-5-5 effort=medium
reflect tooling: claudeAgent/claude-haiku-5-5 effort=medium
reflect judgment, divergent, synthesizer: claudeAgent/claude-opus-5-5 effort=medium
arena runners: claudeAgent/claude-fable-5-2 effort=medium, claudeAgent/claude-opus-5-5 effort=medium, claudeAgent/claude-sonnet-5-5 effort=medium, claudeAgent/claude-haiku-5-5 effort=medium, codex/gpt-6.1-sol reasoningEffort=medium
arena cross-judge pool: codex/gpt-6.1-sol reasoningEffort=medium, claudeAgent/claude-fable-5-2 effort=medium, claudeAgent/claude-opus-5-5 effort=medium, claudeAgent/claude-sonnet-5-5 effort=medium, claudeAgent/claude-haiku-5-5 effort=medium
swarm workers: claudeAgent/claude-sonnet-5-5 effort=medium
architect runners: claudeAgent/claude-fable-5-2 effort=medium, claudeAgent/claude-opus-5-5 effort=medium, claudeAgent/claude-sonnet-5-5 effort=medium, claudeAgent/claude-haiku-5-5 effort=medium, codex/gpt-6.1-sol reasoningEffort=medium
interrogate reviewers: claudeAgent/claude-fable-5-2 effort=medium, claudeAgent/claude-opus-5-5 effort=medium, claudeAgent/claude-sonnet-5-5 effort=medium, claudeAgent/claude-haiku-5-5 effort=medium, codex/gpt-6.1-sol reasoningEffort=medium
session hook: on
