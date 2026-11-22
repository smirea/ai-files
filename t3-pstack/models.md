# pstack model configuration (T3). One line per role. Delete a line to fall back to the skill default.
# `inherit-parent` or `auto` as a value: the role runs on the parent chat's model (`delegate_task` omits `target`). Alias entries in a panel list still count toward its fan-out.
# defaults: 3
# budget: medium (high)
feature, refactoring: claudeAgent/claude-opus-5-5 effort=high
bug-fix: claudeAgent/claude-opus-5-5 effort=high
perf-issue: claudeAgent/claude-opus-5-5 effort=high
hillclimb: claudeAgent/claude-opus-5-5 effort=high
judgment and prose: claudeAgent/claude-opus-5-5 effort=high
arena runners: claudeAgent/claude-fable-5-2 effort=low, claudeAgent/claude-opus-5-5 effort=low, claudeAgent/claude-sonnet-5-5 effort=low, claudeAgent/claude-haiku-5-5 effort=low, codex/gpt-6.2-sol reasoningEffort=low, grok/grok-4.7 reasoningEffort=low, antigravity/gemini-4-neon thought_level=low
arena cross-judge pool: codex/gpt-6.2-sol reasoningEffort=low, grok/grok-4.7 reasoningEffort=low, antigravity/gemini-4-neon thought_level=low, claudeAgent/claude-fable-5-2 effort=low, claudeAgent/claude-opus-5-5 effort=low, claudeAgent/claude-sonnet-5-5 effort=low, claudeAgent/claude-haiku-5-5 effort=low
swarm workers: claudeAgent/claude-sonnet-5-5 effort=low
interrogate reviewers: claudeAgent/claude-fable-5-2 effort=low, claudeAgent/claude-opus-5-5 effort=low, claudeAgent/claude-sonnet-5-5 effort=low, claudeAgent/claude-haiku-5-5 effort=low, codex/gpt-6.2-sol reasoningEffort=low, grok/grok-4.7 reasoningEffort=low, antigravity/gemini-4-neon thought_level=low
session hook: off
