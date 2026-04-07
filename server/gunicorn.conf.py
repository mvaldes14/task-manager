"""Gunicorn configuration for doit server."""

bind    = '0.0.0.0:5000'
workers = 1
timeout = 120
preload_app = True


def post_fork(server, worker):
    """Start the reminder scheduler inside the worker process.

    Must be done here (not at module level) because threads do not survive
    fork(). With preload_app=True the module loads in the master process; the
    scheduler must be started after the fork so its thread runs in the worker.
    """
    from lib.notifications import start_scheduler
    start_scheduler()
