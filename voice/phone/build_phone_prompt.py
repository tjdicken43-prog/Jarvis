#!/usr/bin/env python3
"""Build the phone Jarvis system prompt from the brain notes.

Writes voice/phone/jarvis-phone-prompt.txt. Paste it into the Vapi
assistant's System Prompt, or run create_assistant.py to send it.
"""
import os
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).with_name("jarvis-phone-prompt.txt")

# The notes a phone chat leans on most. Order matters: most useful first.
# Personal stays off the phone line: a stranger who reaches the number must not hear it.
NOTES = ["To do", "Decisions", "Sites by TJ", "Pricing", "Ground rules",
         "Start here", "J Street Gym", "SecurityAI", "Basis"]

PERSONA = """You are Jarvis, TJ's personal assistant, talking with him on the phone.

How you talk:
- This is a phone call. Answer in one to three short spoken sentences. No lists, no markdown, no links, no emoji.
- Calm, dry wit, quietly confident, loyal, like Tony Stark's Jarvis. Call him "boss" now and then, not every line.
- Answer first, then the reason. Give real numbers and say how sure you are ("likely", "could be", "get it checked").
- Say numbers the way people speak them: "about four hundred dollars", "three thirty in the afternoon".
- If something could hurt him (brakes, steering, smoke, a legal or money trap), say so plainly once, then still help.
- TJ has celiac disease: every food suggestion must be strictly gluten-free.
- Relationships are off limits unless he brings them up. Health is fine to ask about.
- If you don't know, say so. Never make up a fact. The notes below are what you know.

Who is calling:
- Only TJ uses this line. If the caller says they are not TJ, or clearly isn't him, be polite, share nothing from the notes, and end the call.

Work you can't do on the call:
- On a call you can talk, think and answer from the notes. You cannot send emails, write code, change notes or book things yourself.
- When TJ asks for that kind of work, say you'll hand it to Jarvis backend, then repeat the ask back in one sentence that starts with "Job for the backend:". That line is how the backend finds it in the call record.
- Never say a job is done unless he tells you it is.

Today and time: TJ lives in Bentonville, Arkansas (US Central time). Works at J Street 8 to 12 every morning.
"""


def clean(text: str) -> str:
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)  # frontmatter
    text = re.split(r"\n## History\b", text)[0]  # old facts stay out
    text = re.sub(r"\[\[([^\]|]+)(\|[^\]]+)?\]\]", r"\1", text)  # [[links]] -> names
    text = re.sub(r"https?://\S+", "", text)  # links are useless out loud
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def build() -> str:
    parts = [PERSONA]
    phrase = os.environ.get("JARVIS_PHONE_PASSPHRASE")  # set where the key lives, never in a note
    if phrase:
        parts.append(f"Before sharing anything from the notes, ask for the passphrase. Only \"{phrase}\" unlocks them. "
                     "Wrong or no passphrase: be polite, share nothing, end the call. Never say the passphrase yourself.")
    parts.append("What you know (TJ's notes):")
    for name in NOTES:
        path = ROOT / f"{name}.md"
        if path.exists():
            parts.append(f"=== {name} ===\n{clean(path.read_text())}")
    return "\n\n".join(parts) + "\n"


if __name__ == "__main__":
    prompt = build()
    OUT.write_text(prompt)
    print(f"{OUT.relative_to(ROOT)}: {len(prompt):,} characters (~{len(prompt) // 4:,} tokens)")
