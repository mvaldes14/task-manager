"""Settings routes — single-row app configuration backed by DB."""

import os
from flask import Blueprint, jsonify, request
from lib.db import get_settings, save_settings
import re
from lib.gcal import is_enabled as gcal_is_enabled

bp = Blueprint('settings', __name__)
_TASK_KEY_PREFIX_RE = re.compile(r'^[A-Z][A-Z0-9]{1,5}$')

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
    data.setdefault('reminder_enabled', False)
    data.setdefault('reminder_minutes_before', 30)
    data.setdefault('reminder_allday_time', '08:00')
    data.setdefault('reminder_timezone', 'America/Chicago')
    data.setdefault('task_key_prefix', 'DO')
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
    if 'task_key_prefix' in data:
        prefix = str(data.get('task_key_prefix') or '').strip().upper()
        if not _TASK_KEY_PREFIX_RE.match(prefix):
            return jsonify({'error': 'task_key_prefix must be 2-6 letters/digits starting with a letter'}), 400
        data['task_key_prefix'] = prefix
    saved = save_settings(data)
    # Re-merge with env defaults and computed fields before returning
    for key, fn in _ENV_DEFAULTS.items():
        if not saved.get(key):
            val = fn()
            if val:
                saved[key] = val
    saved['gcal_enabled'] = gcal_is_enabled()
    saved.setdefault('task_key_prefix', 'DO')
    return jsonify(saved)
