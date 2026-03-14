# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ── Stage 2: Python backend ───────────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app
RUN pip install flask gunicorn psycopg2-binary icalendar \
    google-api-python-client google-auth-httplib2 google-auth-oauthlib \
    opentelemetry-sdk opentelemetry-exporter-otlp-proto-grpc \
    opentelemetry-instrumentation-flask opentelemetry-instrumentation-psycopg2 \
    --no-cache-dir
COPY server/main.py .
COPY server/lib/ ./lib/
COPY server/routes/ ./routes/
COPY --from=frontend /app/client/dist ./client/dist
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--timeout", "120", "--preload", "server:app"]
