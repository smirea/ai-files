# pstack model configuration (T3). One line per role. Delete a line to fall back to the skill default.
# `inherit-parent` or `auto` as a value: the role runs on the parent chat's model (`delegate_task` omits `target`). Alias entries in a panel list still count toward its fan-out.
# budget: medium (high)
feature, refactoring: claudeAgent/claude-opus-5-5 effort=high
bug-fix: claudeAgent/claude-opus-5-5 effort=high
perf-issue: claudeAgent/claude-opus-5-5 effort=high
hillclimb: claudeAgent/claude-opus-5-5 effort=high
judgment and prose: claudeAgent/claude-opus-5-5 effort=high
hardest tasks: claudeAgent/claude-fable-5-2 effort=high
how explorer: claudeAgent/claude-opus-5-5 effort=high
how explainer: claudeAgent/claude-opus-5-5 effort=high
why investigators: claudeAgent/claude-opus-5-5 effort=high
why synthesizer: claudeAgent/claude-opus-5-5 effort=high
reflect tooling: claudeAgent/claude-haiku-5-5 effort=high
reflect judgment, divergent, synthesizer: claudeAgent/claude-opus-5-5 effort=high
arena runners: claudeAgent/claude-fable-5-2 effort=high, claudeAgent/claude-opus-5-5 effort=high, claudeAgent/claude-sonnet-5-5 effort=high, claudeAgent/claude-haiku-5-5 effort=high, codex/gpt-6.2-sol reasoningEffort=high, grok/grok-4.7 reasoningEffort=high
arena cross-judge pool: codex/gpt-6.2-sol reasoningEffort=high, grok/grok-4.7 reasoningEffort=high, claudeAgent/claude-fable-5-2 effort=high, claudeAgent/claude-opus-5-5 effort=high, claudeAgent/claude-sonnet-5-5 effort=high, claudeAgent/claude-haiku-5-5 effort=high
swarm workers: claudeAgent/claude-sonnet-5-5 effort=high
architect runners: claudeAgent/claude-fable-5-2 effort=high, claudeAgent/claude-opus-5-5 effort=high, claudeAgent/claude-sonnet-5-5 effort=high, claudeAgent/claude-haiku-5-5 effort=high, codex/gpt-6.2-sol reasoningEffort=high, grok/grok-4.7 reasoningEffort=high
interrogate reviewers: claudeAgent/claude-fable-5-2 effort=high, claudeAgent/claude-opus-5-5 effort=high, claudeAgent/claude-sonnet-5-5 effort=high, claudeAgent/claude-haiku-5-5 effort=high, codex/gpt-6.2-sol reasoningEffort=high, grok/grok-4.7 reasoningEffort=high
session hook: off
