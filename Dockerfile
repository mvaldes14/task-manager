# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app/client-react
COPY client-react/package*.json ./
RUN npm ci
COPY client-react/ .
RUN npm run build

# ── Stage 2: Python backend ───────────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app
RUN pip install flask gunicorn psycopg2-binary icalendar \
    google-api-python-client google-auth-httplib2 google-auth-oauthlib \
    --no-cache-dir
COPY server.py .
COPY lib/ ./lib/
COPY routes/ ./routes/
COPY --from=frontend /app/client/dist ./client/dist
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--timeout", "120", "--preload", "server:app"]
