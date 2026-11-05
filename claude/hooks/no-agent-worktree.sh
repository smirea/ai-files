#!/bin/sh
[ -n "$T3CODE_THREAD_ID" ] || exit 0
jq -e '.tool_input.isolation == "worktree"' >/dev/null 2>&1 || exit 0
echo 'Blocked: in T3 Code, use delegate_task with isolation: "worktree" instead of the Agent tool'"'"'s worktree isolation. That checkout skips the project setup script, its guard refuses ordinary shell commands and gai, and T3 never cleans it up. For review or research, call Agent without isolation.' >&2
exit 2
