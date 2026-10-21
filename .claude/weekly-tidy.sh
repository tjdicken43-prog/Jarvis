#!/usr/bin/env bash
# Monday tidy-up for the brain. Starts this week's note from the template,
# carries over last week's "Next" and the open "Now" items in To do, then
# prints what needs a human (or Claude) to look at. See "Weekly tidy-up.md".
# Usage: .claude/weekly-tidy.sh [YYYY-MM-DD]   (defaults to today)
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 1

day=${1:-$(date +%F)}
monday=$(date -d "$day -$(( $(date -d "$day" +%u) - 1 )) days" +%F)
sunday=$(date -d "$monday +6 days" +%F)
note="$(date -d "$monday" +%G) Week $((10#$(date -d "$monday" +%V)))"
last_monday=$(date -d "$monday -7 days" +%F)
last_note="$(date -d "$last_monday" +%G) Week $((10#$(date -d "$last_monday" +%V)))"

echo "Weekly tidy-up for $day: [[$note]] ($monday to $sunday)"

# Lines under a "## Heading" in a file, up to the next heading.
section() { awk -v h="## $2" '$0==h{on=1;next} /^## /{on=0} on && /^- /' "$1" 2>/dev/null; }

if [ -f "$note.md" ]; then
  echo "- [[$note]] already exists, left as is."
else
  {
    printf -- '---\ntype: week\nweek: %s to %s\n---\n# %s\n\n## Done\n\n## Next\n' "$monday" "$sunday" "$note"
    carried=$(section "$last_note.md" Next)
    [ -n "$carried" ] && printf '\nCarried over from [[%s]]:\n%s\n' "$last_note" "$carried"
    open=$(section "To do.md" Now | grep '^- \[ \]' | sed 's/^- \[ \] /- /')
    [ -n "$open" ] && printf '\nStill open in [[To do]] (Now):\n%s\n' "$open"
    printf '\n## Learned\n'
  } > "$note.md"
  echo "- Created [[$note]] from [[Weekly note template]]."
  [ -f "$last_note.md" ] || echo "- No note for last week ([[$last_note]]), nothing carried from it."
fi

# Ticked items in To do should move to the week's Done.
ticked=$(grep -n '^- \[x\]' "To do.md" 2>/dev/null)
[ -n "$ticked" ] && printf -- '- Ticked in [[To do]], move to a week'"'"'s Done:\n%s\n' "$ticked"

# Unconfirmed facts.
checks=$(grep -Hn '(check)' --exclude=CLAUDE.md --exclude=Jarvis.md -- *.md 2>/dev/null
         grep -Hn '(check) ' Jarvis.md 2>/dev/null | grep -v 'Guesses get')
[ -n "$checks" ] && printf -- '- Marked (check), ask TJ:\n%s\n' "$checks"

# Dated facts older than 30 days in living notes (logs and week notes are history by design).
cutoff=$(date -d "$day -30 days" +%F)
stale=$(for f in *.md; do
  case "$f" in *" Week "*|Decisions.md|"Release history.md"|CLAUDE.md|*template*) continue;; esac
  awk -v c="$cutoff" -v f="${f%.md}" '/^## History/{h=1} /^## /&&!/History/{h=0}
    !h { while (match($0, /20[0-9][0-9]-[01][0-9]-[0-3][0-9]/)) { d=substr($0,RSTART,10)
      if (d < c) { print f ": " $0; break } $0=substr($0,RSTART+10) } }' "$f"
done)
[ -n "$stale" ] && printf -- '- Dated before %s, still true?\n%s\n' "$cutoff" "$stale"

exit 0
