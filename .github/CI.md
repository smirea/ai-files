# Continuous integration

`workflows/ci.yml` typechecks the skill scripts and syntax-checks `setup.sh` on pull requests and master pushes. Actions are pinned to commit SHAs, and Dependabot checks for updates weekly. `.bun-version` and `packageManager` pin Bun; update them together.
