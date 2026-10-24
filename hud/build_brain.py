"""Pack the brain notes into brain.js so the HUD can read them.

Run from anywhere: python3 hud/build_brain.py
Re-run after the notes change.

python3 hud/build_brain.py --artifact OUT.html also writes a one-file copy
with the notes inlined, ready to publish as a private claude.ai artifact.
"""
import importlib.util
import json
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
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
    brain = {"notes": notes, "stats": stats, "budget": budget_snapshot()}
    out.write_text("window.BRAIN = " + json.dumps(brain, indent=1) + ";\n", encoding="utf-8")
    print(f"Packed {stats['notes']} notes into {out.relative_to(ROOT)}")
    if "--artifact" in sys.argv:
        write_artifact(Path(sys.argv[sys.argv.index("--artifact") + 1]), out.read_text(encoding="utf-8"))


def budget_snapshot():
    """The Budget sheet's numbers, from money/budget (ledger + rules). The page recounts the days itself."""
    spec = importlib.util.spec_from_file_location("budget", ROOT / "money" / "budget" / "budget.py")
    b = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(b)
    cfg, rows = b.load()
    problems = b.lint(cfg, rows)
    snap = b.status(cfg, rows, datetime.now(ZoneInfo("America/Chicago")).date())
    snap["alerts"] = ["The ledger has a problem: " + p for p in problems] + snap["alerts"]
    return snap


PART = re.compile(r'<script src="(src/[\w-]+\.js)"></script>\n?')


def inline_parts(html):
    """index.html loads its code from hud/src/ in pieces; the artifact gets them back as one style and one script."""
    css = (ROOT / "hud" / "src" / "style.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="src/style.css">', "<style>\n" + css + "</style>")
    parts = PART.findall(html)
    code = "".join((ROOT / "hud" / f).read_text(encoding="utf-8") for f in parts)
    assert "</script" not in code, "a hud/src file has </script in it; split the string"
    html = PART.sub("", html, count=len(parts) - 1) if len(parts) > 1 else html
    return PART.sub(lambda m: "<script>\n" + code + "</script>\n", html, count=1)


def write_artifact(dest, brain_js):
    """The artifact host adds its own doctype, head and body, so strip ours."""
    html = (ROOT / "hud" / "index.html").read_text(encoding="utf-8")
    for tag in ("<!doctype html>", '<html lang="en">', "</html>", "<head>", "</head>", "<body>", "</body>"):
        html = html.replace(tag, "")
    html = re.sub(r'<meta (charset|name="viewport")[^>]*>\n', "", html)
    html = inline_parts(html)
    html = html.replace('<script src="brain.js"></script>', "<script>" + brain_js.replace("</", "<\\/") + "</script>")
    factory = (ROOT / "hud" / "factory.js").read_text(encoding="utf-8")
    html = html.replace('<script src="factory.js"></script>', "<script>" + factory.replace("</", "<\\/") + "</script>")
    workshop = (ROOT / "hud" / "src" / "workshop.js").read_text(encoding="utf-8")
    assert "</script" not in workshop, "workshop.js has </script in it; split the string"
    tag = '<script type="module" src="src/workshop.js"></script>'
    assert tag in html, "index.html lost the workshop.js module tag"
    html = html.replace(tag, '<script type="module">\n' + workshop + "</script>")
    vault = (ROOT / "hud" / "src" / "vault.js").read_text(encoding="utf-8").replace("export const CAST", "const CAST").replace("export function createVault", "function createVault")
    ui = (ROOT / "hud" / "src" / "vault-ui.js").read_text(encoding="utf-8").replace('import { createVault } from "./vault.js";\n', "").replace("export function openVault", "function openVault")
    assert "</script" not in vault + ui and "export " not in ui, "vault files need fixing before inlining"
    tag = '<script type="module" src="src/vault-ui.js"></script>'
    assert tag in html, "index.html lost the vault-ui.js module tag"
    html = html.replace(tag, '<script type="module">\n' + vault + ui + "</script>")
    dest.write_text(html.strip() + "\n", encoding="utf-8")
    print(f"Wrote artifact copy to {dest}")


if __name__ == "__main__":
    main()
