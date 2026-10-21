"""Pack the brain notes into brain.js so the HUD can read them.

Run from anywhere: python3 hud/build_brain.py
Re-run after the notes change.

python3 hud/build_brain.py --artifact OUT.html also writes a one-file copy
with the notes inlined, ready to publish as a private claude.ai artifact.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINK = re.compile(r"\[\[([^\]|#]+)")
SKIP = {"README.md"}


def read_note(path):
    text = path.read_text(encoding="utf-8")
    kind = ""
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            m = re.search(r"^type:\s*(\S+)", text[3:end], re.M)
            kind = m.group(1) if m else ""
            text = text[end + 4:].lstrip("\n")
    links = sorted({l.strip() for l in LINK.findall(text)})
    return {"name": path.stem, "type": kind, "links": links, "text": text}


def main():
    paths = [p for p in ROOT.glob("*.md") if p.name not in SKIP]
    paths += list((ROOT / "Weekly").glob("*.md")) if (ROOT / "Weekly").is_dir() else []
    notes = [read_note(p) for p in sorted(paths)]
    todo = next((n["text"] for n in notes if n["name"] == "To do"), "")
    stats = {
        "notes": len(notes),
        "open_todos": todo.count("- [ ]"),
        "checks": sum(n["text"].count("(check)") for n in notes),
    }
    out = ROOT / "hud" / "brain.js"
    out.write_text("window.BRAIN = " + json.dumps({"notes": notes, "stats": stats}, indent=1) + ";\n", encoding="utf-8")
    print(f"Packed {stats['notes']} notes into {out.relative_to(ROOT)}")
    if "--artifact" in sys.argv:
        write_artifact(Path(sys.argv[sys.argv.index("--artifact") + 1]), out.read_text(encoding="utf-8"))


def write_artifact(dest, brain_js):
    """The artifact host adds its own doctype, head and body, so strip ours."""
    html = (ROOT / "hud" / "index.html").read_text(encoding="utf-8")
    for tag in ("<!doctype html>", '<html lang="en">', "</html>", "<head>", "</head>", "<body>", "</body>"):
        html = html.replace(tag, "")
    html = re.sub(r'<meta (charset|name="viewport")[^>]*>\n', "", html)
    html = html.replace('<script src="brain.js"></script>', "<script>" + brain_js.replace("</", "<\\/") + "</script>")
    dest.write_text(html.strip() + "\n", encoding="utf-8")
    print(f"Wrote artifact copy to {dest}")


if __name__ == "__main__":
    main()
