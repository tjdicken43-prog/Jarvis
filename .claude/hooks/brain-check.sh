#!/usr/bin/env bash
# Runs at the start of every Claude session. Prints a short health report of
# the brain so Claude starts from today's facts, not stale ones.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

today=$(date +%F)
year=$(date +%G)
week=$((10#$(date +%V)))
week_note="$year Week $week.md"

echo "Brain check for $today (ISO week $week of $year)"

if [ -f "$week_note" ]; then
  echo "- This week's note: [[${week_note%.md}]] exists."
else
  echo "- This week's note is missing: create \"$week_note\" from [[Weekly note template]]."
fi

open=$(grep -c '^- \[ \]' "To do.md" 2>/dev/null || echo 0)
echo "- Open items in [[To do]]: $open"

checks=$(grep -l '(check)' --exclude=CLAUDE.md -- *.md 2>/dev/null | sed 's/\.md$//' | paste -sd, - | sed 's/,/, /g')
[ -n "$checks" ] && echo "- Unconfirmed facts marked (check) in: $checks"

# Links that point at a note that doesn't exist.
broken=$(grep -oh '\[\[[^]|]*' -- *.md 2>/dev/null | sed 's/^\[\[//' | sort -u | while read -r name; do
  [ -f "$name.md" ] || printf '%s\n' "$name"
done | paste -sd, - | sed 's/,/, /g')
[ -n "$broken" ] && echo "- Links to missing notes: $broken"

# Secret-looking strings must never be in notes. Show file names only.
leaks=$(grep -lE '(sk-ant-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)' -- *.md 2>/dev/null | paste -sd, - | sed 's/,/, /g')
[ -n "$leaks" ] && echo "- WARNING: something that looks like a key is in: $leaks. Remove it and tell TJ to change it."

exit 0
