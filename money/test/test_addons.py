"""Offline test: agency add-on drafts follow the rules, and bad drafts are refused (no network, no database)."""
import datetime as dt, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / "agency" / "api"))
import addons as a

c = {"id": 1, "business_name": "Ozark Pipe Co", "phone": "479-273-0100", "trade": "plumbing", "addons": ["care_plus"]}
good = {"rating": 5, "reviewer": "Dana K", "text": "Fixed our leak fast."}
bad = {"rating": 2, "reviewer": "Sam", "text": "Showed up late twice."}

r = a.draft_reply(c, good)
assert r["by"] == "template" and r["reply"].startswith("Hi Dana,") and "479-273-0100" in r["reply"] and "!" not in r["reply"]
r = a.draft_reply(c, bad)
assert "479-273-0100" in r["reply"] and "sorry" in r["reply"] and not a.reply_preflight(r["reply"], bad, c)

# a Claude draft that breaks a rule is dropped for the template; a good one is used
assert a.draft_reply(c, good, write=lambda c_, r_: "Thanks Dana! Enjoy 20% off next time.")["by"] == "template"
assert a.draft_reply(c, good, write=lambda c_, r_: (_ for _ in ()).throw(RuntimeError("api down")))["by"] == "template"
nice = "Hi Dana, thank you for the review. We are glad the leak is fixed."
assert a.draft_reply(c, good, write=lambda c_, r_: nice) == {"reply": nice, "by": "claude"}

pf = lambda t, rv=bad: a.reply_preflight(t, rv, c)
assert pf("We are sorry. Call 479-273-0100.") == []
assert any("phone" in x for x in pf("We are sorry to hear that."))                         # low rating, no phone
assert any("offers" in x for x in pf("Sorry. Here is a free visit. 479-273-0100"))
assert any("number 3" in x for x in pf("We arrived 3 times, call 479-273-0100."))
assert any("argue" in x for x in pf("That is not true. 479-273-0100"))
assert any("over 70" in x for x in pf("word " * 80 + "479-273-0100"))
assert pf("") == ["empty reply"] and any("placeholder" in x for x in pf("Hi {{name}} 479-273-0100"))

for trade in ("plumbing", "hvac", "roofing"):
    for month in range(1, 13):
        p = a.draft_post(dict(c, trade=trade), dt.date(2026, month, 5))["post"]
        assert a.post_preflight(p, dict(c, trade=trade)) == [] and "Ozark Pipe Co" in p, (trade, month)
assert "frozen" in a.draft_post(dict(c, trade="hvac"), dt.date(2026, 7, 4))["post"]
assert a.season(dt.date(2026, 12, 25)) == "winter" and a.season(dt.date(2026, 10, 25)) == "fall"
assert a.TIPS.keys() == {(t, s) for t in ("hvac", "plumbing", "roofing") for s in ("winter", "spring", "summer", "fall")}

for t in a.TIPS.values():   # every tip is clean on its own (no claims, no numbers, no exclamation)
    assert not a.CLAIMS.search(t) and "!" not in t and not any(ch.isdigit() for ch in t), t

for fn, arg in ((a.draft_reply, good), (a.draft_post, None)):   # shop without the add-on is refused
    try:
        fn(dict(c, addons=["google_posts" if fn is a.draft_reply else "review_replies"]), *( [arg] if arg else []))
        raise SystemExit("allowed without the add-on")
    except a.AddonError:
        pass
try:
    a.draft_reply(c, {"rating": 9, "text": ""}); raise SystemExit("bad rating allowed")
except a.AddonError:
    pass
assert a.monthly_summary([c, dict(c, addons=["review_replies"]), dict(c, addons=None)]) == {"care_plus": (1, 7900), "review_replies": (1, 4900)}
assert a.ADDONS["care_plus"]["monthly_cents"] < a.ADDONS["review_replies"]["monthly_cents"] + a.ADDONS["google_posts"]["monthly_cents"]
assert all(x["status"] == "proposed" for x in a.ADDONS.values())
print("addons ok")
