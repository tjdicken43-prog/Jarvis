"""Apply schema.sql (safe to re-run). Render runs this before each deploy: python migrate.py"""
import pathlib

import db

with db.connect() as conn:
    conn.execute((pathlib.Path(__file__).parent / "schema.sql").read_text())
print("schema ok")
