FROM python:3.12-slim
WORKDIR /app
RUN pip install flask gunicorn psycopg2-binary google-api-python-client google-auth-httplib2 google-auth-oauthlib --no-cache-dir
COPY server.py .
COPY client/public/ ./client/public/
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--timeout", "120", "--preload", "server:app"]
