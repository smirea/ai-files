#!/usr/bin/env bash
# Links this repo's agent files into every place the agent tools read them. Safe to rerun.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

link() {
	local source="$repo/$1" target="$2"
	[ -e "$source" ] || { echo "missing $source" >&2; exit 1; }
	if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
		echo "ok      $target"
		return
	fi
	mkdir -p "$(dirname "$target")"
	if [ -L "$target" ]; then
		rm "$target"
	elif [ -e "$target" ]; then
		if diff -rq "$source" "$target" >/dev/null 2>&1; then
			trash "$target"
		else
			trash "$target"
			echo "trashed $target (it differed from the repo's copy; restore it from the Trash if it held anything new)"
		fi
	fi
	ln -s "$source" "$target"
	echo "linked  $target -> $source"
}

link GLOBAL_AGENTS.md ~/.claude/CLAUDE.md
link GLOBAL_AGENTS.md ~/.codex/AGENTS.md
link GLOBAL_AGENTS.md ~/.config/opencode/AGENTS.md
link GLOBAL_AGENTS.md ~/.gemini/GEMINI.md
link t3-pstack/models.md ~/.config/t3-pstack/models.md
# Older t3-pstack releases read the sheet from each host's config dir.
link t3-pstack/models.md ~/.claude/t3-pstack-models.md
link t3-pstack/models.md ~/.codex/t3-pstack-models.md
link claude/hooks/no-agent-worktree.sh ~/.claude/hooks/no-agent-worktree.sh
link claude/hooks/no-hook-skipping.ts ~/.claude/hooks/no-hook-skipping.ts
t3_userdata="${T3CODE_HOME:-$HOME/.t3}/userdata"
link t3/settings.json "$t3_userdata/settings.json"
link t3/client-settings.json "$t3_userdata/client-settings.json"
link t3/keybindings.json "$t3_userdata/keybindings.json"
link t3/pre-commit "$repo/.git/hooks/pre-commit"

register_hook() {
	local settings=~/.claude/settings.json event="$1" matcher="$2" command="$3" timeout="${4:-}"
	[ -f "$settings" ] || echo '{}' > "$settings"
	if jq -e --arg e "$event" --arg c "$command" 'any(.hooks[$e][]?.hooks[]?; .command == $c)' "$settings" >/dev/null; then
		echo "ok      hook $command"
		return
	fi
	jq --arg e "$event" --arg m "$matcher" --arg c "$command" --arg t "$timeout" '
		.hooks[$e] += [(if $m == "" then {} else {matcher: $m} end)
			+ {hooks: [{type: "command", command: $c} + (if $t == "" then {} else {timeout: ($t | tonumber)} end)]}]
	' "$settings" > "$settings.tmp"
	mv "$settings.tmp" "$settings"
	echo "added   hook $command"
}

register_hook PreToolUse 'Agent|Task' '$HOME/.claude/hooks/no-agent-worktree.sh'
register_hook PreToolUse Bash 'bun --no-env-file "$HOME/.claude/hooks/no-hook-skipping.ts"'
# Repairs a T3 worktree whose setup is missing (dependencies, ports, env files) before the session starts.
register_hook SessionStart '' '"$HOME/bin/agent-t3-worktree" check --heal --quiet' 600

# Claude Code reads ~/.claude/skills; Codex reads ~/.agents/skills (and ~/.codex/skills, skipped so it doesn't list each skill twice).
for skill in "$repo"/skills/*/; do
	name="$(basename "$skill")"
	link "skills/$name" ~/.claude/skills/"$name"
	link "skills/$name" ~/.agents/skills/"$name"
done

# Installs or updates the t3-pstack plugin in every Claude Code and Codex home T3 runs, and trusts its Codex hook.
# npm 12 refuses git packages unless --allow-git is passed.
npx --allow-git=all -y github:chhoumann/t3-pstack install

"$repo/t3/sync.ts" apply
