// PreToolUse guard: agents skipped lefthook to get past failing checks instead of fixing them.

const HOOK_SUBCOMMANDS = new Set([
  "commit",
  "push",
  "merge",
  "rebase",
  "cherry-pick",
  "am",
  "checkout",
  "switch",
  "pull",
]);

const CONFIG_READ_OR_UNSET_FLAGS = new Set([
  "--get",
  "--get-all",
  "--get-regexp",
  "--get-urlmatch",
  "--list",
  "-l",
  "--unset",
  "--unset-all",
  "--show-origin",
  "--show-scope",
  "--name-only",
]);

function stripHeredocs(command: string): string {
  const lines = command.split("\n");
  const out: string[] = [];
  const pending: { delimiter: string; stripTabs: boolean }[] = [];

  for (const line of lines) {
    if (pending.length > 0) {
      const current = pending[0]!;
      const candidate = current.stripTabs ? line.replace(/^\t+/, "") : line;
      if (candidate === current.delimiter) pending.shift();
      continue;
    }
    out.push(line);
    // Match quoted strings and heredoc redirections in one left-to-right pass so `echo "<<EOF"` is ignored
    // while `<<'EOF'` still captures its quoted delimiter, and `<<<` here-strings are excluded.
    const tokenRe =
      /"(?:\\.|[^"\\])*"|'[^']*'|(?<!<)<<(?!<)(-)?\s*(?:'([^']+)'|"([^"]+)"|\\?([^\s'"<>|&;()]+))/g;
    for (const match of line.matchAll(tokenRe)) {
      const delimiter = match[2] ?? match[3] ?? match[4];
      if (delimiter) pending.push({ delimiter, stripTabs: Boolean(match[1]) });
    }
  }

  return out.join("\n");
}

function setsHooksPathViaConfig(tokens: string[]): boolean {
  const configIndex = tokens.indexOf("config");
  if (configIndex < 0) return false;
  const rest = tokens.slice(configIndex + 1);
  if (rest.some((token) => CONFIG_READ_OR_UNSET_FLAGS.has(token))) return false;
  const keyIndex = rest.findIndex(
    (token) => token === "core.hooksPath" || token.startsWith("core.hooksPath="),
  );
  if (keyIndex < 0) return false;
  const keyToken = rest[keyIndex]!;
  if (keyToken.startsWith("core.hooksPath=")) return true;
  // `git config core.hooksPath` with no value argument is a read; a trailing non-flag argument sets it.
  const after = rest.slice(keyIndex + 1).filter((token) => !token.startsWith("-"));
  return after.length > 0;
}

function setsHooksPathInlineForHookCommand(tokens: string[]): boolean {
  let hasHooksPathOverride = false;
  let subcommand: string | undefined;
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token === "-c") {
      const next = tokens[++i] ?? "";
      if (/^core\.hooksPath=/i.test(next)) hasHooksPathOverride = true;
      continue;
    }
    if (/^-c\s*core\.hooksPath=/i.test(token)) {
      hasHooksPathOverride = true;
      continue;
    }
    // Skip known git global options that take an argument so we find the actual subcommand.
    if (
      token === "-C" ||
      token === "--git-dir" ||
      token === "--work-tree" ||
      token === "--namespace"
    ) {
      i++;
      continue;
    }
    if (token.startsWith("-")) continue;
    subcommand = token;
    break;
  }
  if (!hasHooksPathOverride) return false;
  return subcommand === undefined || HOOK_SUBCOMMANDS.has(subcommand);
}

function hasCommitShortNoVerify(tokens: string[]): boolean {
  const commitIndex = tokens.indexOf("commit");
  if (commitIndex < 0) return false;
  return tokens.slice(commitIndex + 1).some((token) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(token));
}

export function skipsGitHooks(command: string): boolean {
  // Strip heredocs first so stray quotes or git-like lines inside script/doc bodies never interfere.
  // A quoted single word is still an argument to git; only multi-word strings are messages.
  const cleaned = stripHeredocs(command)
    .replace(/"([^"\s\\]*)"|'([^'\s]*)'/g, "$1$2")
    .replace(/"(\\.|[^"\\])*"|'[^']*'/g, "''");

  for (const rawSegment of cleaned.split(/&&|\|\||[;|\n]/)) {
    const segment = rawSegment.trim();
    if (!segment) continue;

    if (
      /^export\s+(?:.*\s)?(?:LEFTHOOK=(?:0|false)|LEFTHOOK_(?:EXCLUDE|SKIP)=|HUSKY=(?:0|false))\b/.test(
        segment,
      )
    ) {
      return true;
    }

    const gitMatch = /^(?:env\s+)?(?:\w+=\S*\s+)*(git|gai)\b/.exec(segment);
    if (!gitMatch) continue;

    if (
      /(?:^|\s)--no-verify(?:\s|$|=)/.test(segment) ||
      /\bLEFTHOOK=(?:0|false)\b/.test(segment) ||
      /\bLEFTHOOK_(?:EXCLUDE|SKIP)=/.test(segment) ||
      /\bHUSKY=(?:0|false)\b/.test(segment)
    ) {
      return true;
    }

    const commandStart = segment.indexOf(gitMatch[1]!);
    const tokens = segment.slice(commandStart).split(/\s+/).filter(Boolean);
    if (gitMatch[1] === "git") {
      if (
        hasCommitShortNoVerify(tokens) ||
        setsHooksPathViaConfig(tokens) ||
        setsHooksPathInlineForHookCommand(tokens)
      ) {
        return true;
      }
    }
  }

  return false;
}

if (import.meta.main) {
  const { tool_input } = await Bun.stdin.json();
  const command: string = tool_input?.command ?? "";

  if (skipsGitHooks(command)) {
    console.error(
      "Git hooks must run. Fix the underlying failure in this PR or file a follow-up task; a flaky test is a bad test, so fix why it flakes instead of retrying.",
    );
    process.exit(2);
  }
}
