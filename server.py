#!/usr/bin/env python3
"""TD Server — Flask + PostgreSQL backend."""

import os
from urllib.parse import quote

from flask import Flask, request, jsonify, redirect, send_from_directory

from lib.db import init_db
from lib.nlp import parse_natural_language
from lib.gcal import is_enabled as gcal_is_enabled

from routes.auth    import bp as auth_bp,    is_authenticated, _PUBLIC_PATHS, TD_PASSWORD, API_KEY
from routes.projects import bp as projects_bp
from routes.tasks    import bp as tasks_bp
from routes.gcal     import bp as gcal_bp
from routes.ics      import bp as ics_bp

app = Flask(__name__, static_folder='client/dist')

# ── Register blueprints ────────────────────────────────────────
app.register_blueprint(auth_bp)
app.register_blueprint(projects_bp)
app.register_blueprint(tasks_bp)
app.register_blueprint(gcal_bp)
app.register_blueprint(ics_bp)

# ── Middleware ─────────────────────────────────────────────────
@app.before_request
def auth_middleware():
    path = request.path
    if path in _PUBLIC_PATHS or path.startswith('/icons/') or request.method == 'OPTIONS':
        return None
    if not TD_PASSWORD:
        if path.startswith('/api/') and API_KEY:
            auth = request.headers.get('Authorization', '')
            xkey = request.headers.get('X-API-Key', '')
            if not ((auth.startswith('Bearer ') and auth[7:] == API_KEY) or xkey == API_KEY):
                return jsonify({'error': 'Unauthorized'}), 401
        return None
    if not is_authenticated():
        if path.startswith('/api/'):
            return jsonify({'error': 'Unauthorized'}), 401
        return redirect(f'/login?next={quote(request.full_path.rstrip("?"))}')


@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin']  = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    return response


# ── Static / PWA routes ────────────────────────────────────────
@app.route('/share-target')
def share_target():
    from urllib.parse import urlencode
    params = {f'share_{k}': v for k in ('title', 'text', 'url')
              if (v := request.args.get(k, '').strip())}
    qs = urlencode(params)
    return redirect(f'/?{qs}' if qs else '/')


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


# ── NLP parse endpoint ─────────────────────────────────────────
@app.route('/api/nlp/parse', methods=['POST', 'OPTIONS'])
def nlp_parse():
    if request.method == 'OPTIONS': return '', 204
    data = request.get_json() or {}
    result = parse_natural_language(data.get('text', ''))
    return jsonify(result)


# ── Bootstrap ──────────────────────────────────────────────────
init_db()

if __name__ == '__main__':
    import socket
    try: ip = socket.gethostbyname(socket.gethostname())
    except: ip = '127.0.0.1'
    print(f"\n{'='*50}\n  TD running!\n  Local:   http://localhost:5000\n  Network: http://{ip}:5000\n{'='*50}\n")
    app.run(host='0.0.0.0', port=5000, debug=False)
