import { expect, test } from 'bun:test';
import { skipsGitHooks } from './no-hook-skipping';

test('blocks direct hook-skipping flags, env overrides, and config writes on git and gai', () => {
	for (const cmd of [
		'git commit -m "wip" --no-verify',
		'git commit "--no-verify" -m "wip"',
		'git push --no-verify -u origin HEAD',
		'git commit -qm "wip" -n',
		'git -C /tmp/repo commit -an -m "wip"',
		'LEFTHOOK=0 gai "feat: x"',
		'LEFTHOOK=false git commit -m "x"',
		'LEFTHOOK_EXCLUDE=fix git commit -m "x"',
		'LEFTHOOK_SKIP=test gai "fix: x"',
		'HUSKY=0 git commit -m "x"',
		'env LEFTHOOK=0 git commit -m "x"',
		'export LEFTHOOK=0 && git commit -m "x"',
		'git -c core.hooksPath=/dev/null commit -qm "feat: x"',
		'git config core.hooksPath /dev/null',
		'git config --local core.hooksPath /tmp/empty',
	]) {
		expect(skipsGitHooks(cmd), cmd).toBe(true);
	}
});

test('allows heredocs, read-only hooksPath inspection, non-hook git commands, and commit messages mentioning flags', () => {
	for (const cmd of [
		`python3 - <<'EOF'\np = "it's fine"\ngit commit --no-verify\nLEFTHOOK=0 git push\nEOF`,
		`cat <<EOF > doc.md\ngit config core.hooksPath /dev/null\nEOF`,
		`echo "<<EOF"\ngit log -n 3`,
		`cat <<<'hello'\ngit status`,
		'git config --get core.hooksPath',
		'git config --show-origin core.hooksPath',
		'git config core.hooksPath',
		'git config --unset core.hooksPath',
		'git -c core.hooksPath=/dev/null stash push -q -u -- file.ts',
		'git -c core.hooksPath=/dev/null diff --stat',
		'git log -n 5 --oneline',
		'git push -n origin master',
		'git commit -m "fix: stop blocking git config --get core.hooksPath and --no-verify docs"',
		'gai "docs: mention LEFTHOOK=0 in README"',
	]) {
		expect(skipsGitHooks(cmd), cmd).toBe(false);
	}
});
