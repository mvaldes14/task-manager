FROM python:3.12-slim

WORKDIR /app

RUN pip install flask gunicorn --no-cache-dir

COPY server.py .
COPY client/public/ ./client/public/

# Data directory — actual volume mount is defined in docker-compose.yml only
RUN mkdir -p /app/data

ENV DB_PATH=/app/data/taskflow.db

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--timeout", "120", "--preload", "server:app"]
