#!/usr/bin/env python3
"""TD Server — slim entry point, delegates to route blueprints."""

import os, time as _time
from flask import Flask, request, jsonify, redirect, send_from_directory

from lib.db   import init_db, DATABASE_URL
from lib.gcal import _get_gcal_service  # triggers init at startup

from routes.auth     import bp as auth_bp,     is_authenticated, TD_PASSWORD, _PUBLIC_PATHS, _purge_expired_sessions
from routes.projects import bp as projects_bp
from routes.tasks    import bp as tasks_bp
from routes.gcal     import bp as gcal_bp
from routes.ics      import bp as ics_bp

# ── OpenTelemetry ─────────────────────────────────────────────────────────────

OTEL_ENDPOINT = os.environ.get('OTEL_EXPORTER_OTLP_ENDPOINT', '').strip()

if OTEL_ENDPOINT:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.flask import FlaskInstrumentor
    from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor

    resource = Resource.create({'service.name': os.environ.get('OTEL_SERVICE_NAME', 'doit')})
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=OTEL_ENDPOINT)))
    trace.set_tracer_provider(provider)
    Psycopg2Instrumentor().instrument()
    print(f'[otel] tracing enabled -> {OTEL_ENDPOINT}', flush=True)
else:
    print('[otel] OTEL_EXPORTER_OTLP_ENDPOINT not set, tracing disabled', flush=True)

# ── App setup ─────────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder='client/dist')

if OTEL_ENDPOINT:
    FlaskInstrumentor().instrument_app(app)

app.register_blueprint(auth_bp)
app.register_blueprint(projects_bp)
app.register_blueprint(tasks_bp)
app.register_blueprint(gcal_bp)
app.register_blueprint(ics_bp)

# ── Auth middleware ────────────────────────────────────────────────────────────

_last_purge = [0.0]

@app.before_request
def require_auth():
    path = request.path
    if (request.method == 'OPTIONS'
            or path in _PUBLIC_PATHS
            or path.startswith('/assets/')
            or path.startswith('/icons/')):
        return None
    if not TD_PASSWORD:
        return None
    if not is_authenticated():
        if path.startswith('/api/'):
            return jsonify({'error': 'Unauthorized'}), 401
        return redirect(f'/login?next={path}')
    now = _time.time()
    if now - _last_purge[0] > 3600:
        _purge_expired_sessions()
        _last_purge[0] = now

# ── Static / SPA fallback ────────────────────────────────────────────────────

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin']  = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    return response


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    dist = app.static_folder
    full = os.path.join(dist, path)
    if path and os.path.exists(full):
        mimetype = None
        if path.endswith('.webmanifest'):
            mimetype = 'application/manifest+json'
        return send_from_directory(dist, path, mimetype=mimetype)
    return send_from_directory(dist, 'index.html')

# ── Startup ───────────────────────────────────────────────────────────────────

OBSIDIAN_VAULT = os.environ.get('OBSIDIAN_VAULT', '').strip()
OBSIDIAN_INBOX = os.environ.get('OBSIDIAN_INBOX', '').strip().strip('/')

print(f"[startup] DATABASE_URL = {DATABASE_URL}", flush=True)
if OBSIDIAN_VAULT:
    print(f"[startup] Obsidian vault: {OBSIDIAN_VAULT}" +
          (f" inbox: {OBSIDIAN_INBOX}" if OBSIDIAN_INBOX else ""), flush=True)

init_db()

if __name__ == '__main__':
    import socket
    try:    ip = socket.gethostbyname(socket.gethostname())
    except: ip = '127.0.0.1'
    print(f"\n{'='*50}\n  TD running!\n  Local:   http://localhost:5000\n  Network: http://{ip}:5000\n{'='*50}\n")
    app.run(host='0.0.0.0', port=5000, debug=False)
