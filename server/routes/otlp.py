"""OTLP proxy — forwards browser traces to the collector over plain HTTP.

The browser can't POST to an HTTP endpoint from an HTTPS page (mixed content),
so the frontend sends traces here and the server proxies them internally.
"""

import logging
import urllib.request
import urllib.error
from flask import Blueprint, request, Response
from lib.db import get_settings

bp = Blueprint('otlp', __name__)
logger = logging.getLogger(__name__)


@bp.route('/api/otlp/v1/traces', methods=['POST'])
def proxy_traces():
    settings = get_settings()
    endpoint = (settings.get('otel_frontend_endpoint') or '').strip()
    if not endpoint:
        return '', 204

    url = endpoint.rstrip('/') + '/v1/traces'
    body = request.get_data()
    content_type = request.content_type or 'application/x-protobuf'

    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Content-Type', content_type)

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return Response(
                resp.read(),
                status=resp.status,
                content_type=resp.headers.get('Content-Type', 'application/json'),
            )
    except urllib.error.HTTPError as e:
        return Response(e.read(), status=e.code)
    except Exception:
        logger.debug('[otlp] proxy failed, dropping traces', exc_info=True)
        return '', 204
