"""Settings routes — single-row app configuration backed by DB."""

import os
from flask import Blueprint, jsonify, request
from lib.db import get_settings, save_settings
from lib.gcal import is_enabled as gcal_is_enabled

bp = Blueprint('settings', __name__)

# Keys whose defaults come from env vars (DB value takes precedence if set)
_ENV_DEFAULTS = {
    'obsidian_vault': lambda: os.environ.get('OBSIDIAN_VAULT', '').strip() or None,
    'obsidian_inbox': lambda: os.environ.get('OBSIDIAN_INBOX', '').strip().strip('/') or None,
}

def get_full_settings() -> dict:
    """Merge DB settings with env var defaults."""
    data = get_settings()
    for key, fn in _ENV_DEFAULTS.items():
        if not data.get(key):
            val = fn()
            if val:
                data[key] = val
    data['gcal_enabled'] = gcal_is_enabled()
    return data


@bp.route('/api/settings', methods=['GET'])
def read_settings():
    return jsonify(get_full_settings())


@bp.route('/api/settings', methods=['PATCH'])
def update_settings():
    data = request.get_json() or {}
    # Strip read-only keys
    for key in ('gcal_enabled',):
        data.pop(key, None)
    saved = save_settings(data)
    # Re-merge with env defaults and computed fields before returning
    for key, fn in _ENV_DEFAULTS.items():
        if not saved.get(key):
            val = fn()
            if val:
                saved[key] = val
    saved['gcal_enabled'] = gcal_is_enabled()
    return jsonify(saved)
