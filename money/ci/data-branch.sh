#!/usr/bin/env bash
# Usage: money/ci/data-branch.sh open   -> checks out the money-data branch into ./data
#        money/ci/data-branch.sh save "message"  -> commits ./data and pushes, retrying on races
set -euo pipefail
git config --global user.name "money-bot"
git config --global user.email "money-bot@users.noreply.github.com"
case "$1" in
  open)
    if git ls-remote --exit-code --heads origin money-data >/dev/null 2>&1; then
      git fetch -q origin money-data
      git worktree add -q data origin/money-data
      git -C data checkout -q -B money-data
    else
      git worktree add -q --detach data
      git -C data checkout -q --orphan money-data
      git -C data rm -rq --cached . >/dev/null 2>&1 || true
      find data -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
      printf '# money-data\nWritten by the money bots (prospects, paper trades, rug checks). Code lives on main in money/.\n' > data/README.md
    fi ;;
  save)
    cd data
    git add -A
    git diff --cached --quiet && { echo "no changes"; exit 0; }
    git commit -qm "$2"
    for i in 1 2 3 4 5; do
      git push -q origin HEAD:money-data && exit 0
      sleep $((i * 3))
      git pull -q --rebase origin money-data || true
    done
    exit 1 ;;
esac
