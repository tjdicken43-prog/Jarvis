# agency-api on Render: Microsoft's Playwright image already has Chromium and the system libraries it needs,
# so the flaw finder gets a real phone-size browser. Build context is the repo root (render.yaml dockerContext).
FROM mcr.microsoft.com/playwright/python:v1.64.1-noble

WORKDIR /app
COPY money/agency/api/requirements.txt money/agency/api/requirements.txt
RUN pip install --no-cache-dir --break-system-packages -r money/agency/api/requirements.txt
COPY money/agency/api money/agency/api
COPY money/sites/trade_build.py money/sites/trade_build.py
COPY money/sites/golden/one-call-hvac/libre-franklin-latin-wght-normal.woff2 money/sites/golden/one-call-hvac/

ENV PYTHONUNBUFFERED=1 PORT=10000
CMD ["sh", "-c", "exec uvicorn main:app --app-dir money/agency/api --host 0.0.0.0 --port ${PORT}"]
