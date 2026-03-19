#!/usr/bin/env python3
"""Doit Server — slim entry point, delegates to route blueprints."""

import logging, os, time as _time
from flask import Flask, request, jsonify, redirect, send_from_directory, g

from lib.db   import init_db, DATABASE_URL

from routes.auth      import bp as auth_bp, init_auth, is_authenticated, get_current_user_id, is_auth_required, _PUBLIC_PATHS, _purge_expired_sessions
from routes.projects  import bp as projects_bp
from routes.tasks     import bp as tasks_bp
from routes.gcal      import bp as gcal_bp
from routes.ics       import bp as ics_bp
from routes.settings  import bp as settings_bp
from routes.otlp      import bp as otlp_bp
from routes.dashboard import bp as dashboard_bp
from routes.users     import bp as users_bp

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s — %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)

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

    service_name = os.environ.get('OTEL_SERVICE_NAME', 'doit')
    resource = Resource.create({'service.name': service_name})
    provider = TracerProvider(resource=resource)

    # Default to insecure (no TLS) unless OTEL_EXPORTER_OTLP_INSECURE=false
    use_insecure = os.environ.get('OTEL_EXPORTER_OTLP_INSECURE', 'true').lower() != 'false'
    exporter = OTLPSpanExporter(endpoint=OTEL_ENDPOINT, insecure=use_insecure)
    provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)
    Psycopg2Instrumentor().instrument()
    logger.info('[otel] ✓ OpenTelemetry enabled')
    logger.info('[otel]   - Service: %s', service_name)
    logger.info('[otel]   - Endpoint: %s', OTEL_ENDPOINT)
    logger.info('[otel]   - TLS: %s', 'disabled' if use_insecure else 'enabled')
    logger.info('[otel]   - Instrumented: psycopg2')
else:
    logger.info('[otel] OpenTelemetry disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)')

# ── App setup ─────────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder='client/dist')

if OTEL_ENDPOINT:
    FlaskInstrumentor().instrument_app(app)
    logger.info('[otel]   - Instrumented: Flask')

app.register_blueprint(auth_bp)
app.register_blueprint(projects_bp)
app.register_blueprint(tasks_bp)
app.register_blueprint(gcal_bp)
app.register_blueprint(ics_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(otlp_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(users_bp)

# ── Auth middleware ────────────────────────────────────────────────────────────

_last_purge = [0.0]

@app.before_request
def require_auth():
    path = request.path
    # Always public: OPTIONS, static assets, known public paths, and avatar images
    if (request.method == 'OPTIONS'
            or path in _PUBLIC_PATHS
            or path.startswith('/assets/')
            or path.startswith('/icons/')):
        return None
    # Avatar GET endpoint is public so <img> tags work without auth headers
    if request.method == 'GET' and path.startswith('/api/users/') and path.endswith('/avatar'):
        return None
    if not is_auth_required():
        g.user_id = None
        return None
    uid = get_current_user_id() if is_authenticated() else None
    if uid is None:
        if path.startswith('/api/'):
            return jsonify({'error': 'Unauthorized'}), 401
        return redirect(f'/login?next={path}')
    g.user_id = uid
    now = _time.time()
    if now - _last_purge[0] > 3600:
        _purge_expired_sessions()
        _last_purge[0] = now

# ── Static / SPA fallback ────────────────────────────────────────────────────

# CORS_ORIGIN controls the Access-Control-Allow-Origin header.
# Defaults to '*', which works for API key auth. If you need cookie-based
# cross-origin auth, set this to the specific frontend origin instead.
CORS_ORIGIN = os.environ.get('CORS_ORIGIN', '*').strip()

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin']  = CORS_ORIGIN
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

logger.info('[startup] DATABASE_URL = %s', DATABASE_URL)
if OBSIDIAN_VAULT:
    logger.info('[startup] Obsidian vault: %s%s', OBSIDIAN_VAULT,
                f' inbox: {OBSIDIAN_INBOX}' if OBSIDIAN_INBOX else '')

init_db()
init_auth()
logger.info('[startup] auth required: %s', is_auth_required())

if __name__ == '__main__':
    import socket
    try:    ip = socket.gethostbyname(socket.gethostname())
    except: ip = '127.0.0.1'
    logger.info('\n%s\n  TD running!\n  Local:   http://localhost:5000\n  Network: http://%s:5000\n%s',
                '='*50, ip, '='*50)
    app.run(host='0.0.0.0', port=5000, debug=False)
