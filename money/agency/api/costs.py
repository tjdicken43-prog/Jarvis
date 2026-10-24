"""What each client really costs us a month, so the margin is measured, not guessed (TJ, 2026-10-24).

Per paying client: receptionist minutes (Vapi's own cost per call, or an estimate when it sent none), a share of
the Render bill, Claude calls tied to that client, and Stripe's card fee. Cold-email costs (Claude drafts) are per
lead, so they show as their own line, not spread over clients.
"""
import psycopg

import billing
import config

# Claude list prices in cents per million tokens (input, output), checked 2026-10-24
MODEL_CENTS_PER_MTOK = {
    "claude-haiku-5-5": (10, 50),
    "claude-sonnet-5-5": (200, 1000),
    "claude-opus-5-5": (400, 2000),
}


def ai_cents(model, input_tokens, output_tokens):
    i, o = MODEL_CENTS_PER_MTOK.get(model, MODEL_CENTS_PER_MTOK["claude-opus-5-5"])  # unknown model: assume the dear one
    return (input_tokens * i + output_tokens * o) / 1_000_000


def log_ai(step, model, usage, prospect_id=None, client_id=None):
    """One row per Claude call. Own connection, like events.log: logging never breaks the step."""
    inp = sum(getattr(usage, k, 0) or 0 for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
    out = getattr(usage, "output_tokens", 0) or 0
    try:
        with psycopg.connect(config.DATABASE_URL, autocommit=True) as c:
            c.execute("""INSERT INTO ai_usage (step, model, input_tokens, output_tokens, cost_cents, prospect_id, client_id)
                         VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                      (step, model, inp, out, ai_cents(model, inp, out), prospect_id, client_id))
    except psycopg.Error:
        pass


def stripe_fee_cents(c):
    """Card fee per month: on the monthly charge, or on the yearly one spread over 12."""
    p = billing.price_cents(c["plan"], c["billing"], bool(c.get("founding_no")))
    fee = p * config.STRIPE_FEE_PCT / 100 + config.STRIPE_FEE_CENTS
    return round(fee / 12) if c["billing"] == "annual" else round(fee)


CALLS = """
SELECT client_id, coalesce(sum(cost_cents), 0)::int AS vapi_cents, count(*) FILTER (WHERE cost_cents IS NULL)::int AS no_cost,
  coalesce(sum(ceil(seconds / 60.0)) FILTER (WHERE cost_cents IS NULL), 0)::int AS no_cost_minutes
FROM receptionist_calls WHERE started_at >= %s AND started_at < %s GROUP BY client_id
"""


def month(conn, label=None):
    label, start, end = billing.month_bounds(label)
    used = billing.usage(conn, start, end)
    calls = {r["client_id"]: r for r in conn.execute(CALLS, (start, end))}
    ai = {r["client_id"]: float(r["cents"]) for r in conn.execute(
        """SELECT client_id, sum(cost_cents) AS cents FROM ai_usage WHERE client_id IS NOT NULL AND at >= %s AND at < %s
           GROUP BY client_id""", (start, end))}
    clients = conn.execute("""SELECT id, business_name, plan, billing, included_minutes, founding_no FROM clients
                              WHERE status IN ('active','past_due') ORDER BY business_name""").fetchall()
    hosting = round(config.HOSTING_CENTS_MONTH / len(clients)) if clients else 0
    lines = []
    for c in clients:
        founding = bool(c["founding_no"])
        _, over_cents = billing.overage(used.get(c["id"], {}).get("minutes", 0), c["included_minutes"], founding)
        revenue = billing.monthly_value_cents(c["plan"], c["billing"], founding) + over_cents
        k = calls.get(c["id"], {})
        receptionist = k.get("vapi_cents", 0) + round(k.get("no_cost_minutes", 0) * config.VAPI_EST_CENTS_PER_MIN)
        claude = round(ai.get(c["id"], 0))
        fee = stripe_fee_cents(c) + (round(over_cents * config.STRIPE_FEE_PCT / 100) if over_cents else 0)
        cost = receptionist + hosting + claude + fee
        lines.append({"client_id": c["id"], "business_name": c["business_name"], "founding_no": c["founding_no"],
                      "minutes": used.get(c["id"], {}).get("minutes", 0), "revenue_cents": revenue,
                      "receptionist_cents": receptionist, "hosting_cents": hosting, "claude_cents": claude,
                      "stripe_cents": fee, "cost_cents": cost, "margin_cents": revenue - cost,
                      "margin_pct": round(100 * (revenue - cost) / revenue) if revenue else None,
                      "estimated": bool(k.get("no_cost"))})
    drafts = conn.execute("""SELECT count(*)::int AS n, coalesce(sum(cost_cents), 0) AS cents FROM ai_usage
                             WHERE client_id IS NULL AND at >= %s AND at < %s""", (start, end)).fetchone()
    revenue = sum(x["revenue_cents"] for x in lines)
    cost = sum(x["cost_cents"] for x in lines)
    return {"month": label, "lines": lines,
            "totals": {"revenue_cents": revenue, "cost_cents": cost, "margin_cents": revenue - cost,
                       "margin_pct": round(100 * (revenue - cost) / revenue) if revenue else None},
            "hosting_cents_month": config.HOSTING_CENTS_MONTH,
            "outreach": {"claude_calls": drafts["n"], "claude_cents": round(float(drafts["cents"]), 2),
                         "per_call_cents": round(float(drafts["cents"]) / drafts["n"], 3) if drafts["n"] else None}}
