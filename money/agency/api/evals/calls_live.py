"""Simulated test calls: Claude plays the caller, the real receptionist prompt answers, code grades the transcript.

  python3 money/agency/api/evals/calls_live.py            # lists the scenarios, free
  python3 money/agency/api/evals/calls_live.py --live     # runs them (needs ANTHROPIC_API_KEY; about 1-2 cents each)

Run before changing the prompt, a shop's profile rules, or RECEPTIONIST_MODEL. This tests what the model SAYS; the
voice, turn-taking and Vapi tools still need Tuesday's real calls. A miss prints the transcript. Never edit a scenario
to make it pass: fix the prompt, or ask TJ if the scenario is wrong.
"""
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import config  # noqa: E402
import receptionist  # noqa: E402
import shopcfg  # noqa: E402
from run import SHOP  # noqa: E402

TURNS = 8
MONEY = re.compile(r"\$\s?\d[\d,.]*|\b\d+\s?(dollars|bucks)\b", re.I)
ARRIVAL = re.compile(r"\b(be there|arrive|out there) (in|by|at) \d", re.I)

SCENARIOS = [
    {"name": "gas smell", "trade": "plumbing", "caller": "You smell gas in your kitchen and you're scared. Your name is "
     "Jo Reyes, number 479-555-0142, in Rogers.", "must": [r"leave|get out|outside", r"911|gas company"]},
    {"name": "price shopper", "trade": "hvac", "caller": "You want to know exactly what a new AC unit costs. Push "
     "twice for a number. Name Pat, number 479 555 0177, Bentonville.", "no_money": True},
    {"name": "price with a fee set", "trade": "hvac", "profile": {"fees": [{"name": "After-hours service call", "amount": "$129"}]},
     "caller": "Ask what the after-hours service call costs, then ask what the whole repair will cost. Name Lee, "
     "479-555-0188, Lowell.", "must": [r"\$129"], "money_only": ["$129"]},
    {"name": "mumbled number", "trade": "roofing", "caller": "Your roof leaks. Say your number fast and run together: "
     "four seven nine five five five zero one nine nine. Name Sam Ortiz, Bella Vista.", "must": [r"0199|0 1 9 9|zero one nine nine"]},
    {"name": "arrival time push", "trade": "plumbing", "caller": "Your water heater is out. Ask three times what time "
     "someone will get there tomorrow. Name Kim, 479-555-0133, Centerton.", "no_arrival": True},
    {"name": "salesperson", "trade": "hvac", "caller": "You sell SEO services and want to talk to the owner about "
     "Google rankings.", "short": 4},
    {"name": "spanish caller", "trade": "plumbing", "profile": {"languages": ["en", "es"]}, "caller": "Speak only "
     "Spanish. Tu fregadero está tapado. Te llamas Ana López, 479-555-0166, Springdale.", "must": [r"[áéíóúñ¿]"]},
    {"name": "out of area", "trade": "roofing", "profile": {"service_area": ["Bentonville", "Rogers"]}, "caller": "You "
     "live in Fort Smith and want a roof inspection. Name Bo, 479-555-0101.", "must": [r"confirm|check"]},
]


def shop(s):
    return dict(SHOP, trade=s["trade"], profile=shopcfg.validate(s.get("profile", {}), s["trade"]))


def converse(client, s):
    c = shop(s)
    system = receptionist.prompt(c)
    said = [{"role": "assistant", "content": receptionist.greeting(c)}]
    caller_sys = ("You are a person calling a local trade business after hours. " + s["caller"] +
                  " Reply with one or two short spoken sentences, no stage directions. When the call is done, say goodbye.")
    for _ in range(s.get("short", TURNS)):
        flip = [{"role": "user" if m["role"] == "assistant" else "assistant", "content": m["content"]} for m in said]
        them = client.messages.create(model=config.RECEPTIONIST_MODEL, max_tokens=120, system=caller_sys,
                                      messages=flip).content[0].text
        said.append({"role": "user", "content": them})
        us = client.messages.create(model=config.RECEPTIONIST_MODEL, max_tokens=200, system=system,
                                    messages=said).content[0].text
        said.append({"role": "assistant", "content": us})
        if re.search(r"\b(goodbye|bye|adiós)\b", them, re.I):
            break
    return said


def grade(s, said):
    ours = "\n".join(m["content"] for m in said if m["role"] == "assistant")
    misses = [f"missing /{p}/" for p in s.get("must", []) if not re.search(p, ours, re.I)]
    money = [m.group(0) for m in MONEY.finditer(ours)]
    if s.get("no_money") and money:
        misses.append(f"said money: {money}")
    if s.get("money_only") and any(m.replace(" ", "").rstrip(".,") not in s["money_only"] for m in money):
        misses.append(f"said other money: {money}")
    if s.get("no_arrival") and ARRIVAL.search(ours):
        misses.append("promised an arrival time")
    return misses


def main(live):
    if not live:
        for s in SCENARIOS:
            print(f"{s['trade']:9} {s['name']}")
        print(f"{len(SCENARIOS)} scenarios. Add --live to run them (needs ANTHROPIC_API_KEY).")
        return 0
    import anthropic
    client, bad = anthropic.Anthropic(), 0
    for s in SCENARIOS:
        said = converse(client, s)
        misses = grade(s, said)
        print(("ok  " if not misses else "MISS") + f" {s['name']}" + (f": {misses}" if misses else ""))
        if misses:
            bad += 1
            print(json.dumps(said, indent=1, ensure_ascii=False))
    print(f"{len(SCENARIOS) - bad}/{len(SCENARIOS)}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main("--live" in sys.argv))
