# Doit — Project Guide for Claude

## Project Overview

Self-hosted task manager (PWA). Flask backend + React 19 frontend, served as a single Docker container. The backend serves the compiled frontend from `client/dist/`.

---

## Repository Layout

```
/
├── server/                         # Python 3.12 + Flask backend
│   ├── main.py                     # Entry point: blueprint registration, OTel setup, auth middleware, SPA fallback
│   ├── lib/
│   │   ├── db.py                   # DB init, schema migrations, row helpers, get_settings/save_settings
│   │   ├── gcal.py                 # Google Calendar integration (service account)
│   │   └── nlp.py                  # Natural language parser (dateparser + python-dateutil RRULE)
│   └── routes/
│       ├── auth.py                 # Session auth, login/logout, Bearer token check
│       ├── tasks.py                # CRUD for tasks + subtasks endpoints
│       ├── projects.py             # CRUD for projects
│       ├── settings.py             # Single-row app settings (GET + PATCH /api/settings)
│       ├── gcal.py                 # /api/gcal/status + /api/gcal/sync
│       ├── ics.py                  # ICS calendar import (URL or file upload), list, delete
│       └── otlp.py                 # Proxy for frontend OTLP/HTTP traces → backend gRPC
│
├── client/                         # React 19 + Vite + Tailwind CSS frontend
│   └── src/
│       ├── main.jsx                # App entry, OTel init from DB settings at runtime
│       ├── App.jsx                 # Top-level layout, view routing, data loading
│       ├── utils.js                # formatDate, isOverdue, isToday, recurrenceLabel, getLinkLabel/Style
│       ├── api/
│       │   └── index.js            # All fetch wrappers — single source of truth for API calls
│       ├── context/
│       │   └── AppContext.jsx      # Global reducer state (tasks, projects, settings, UI), PWA badge, notification timers
│       ├── hooks/
│       │   ├── useTasks.js         # loadAll, loadSettings, createTask, updateTask, deleteTask, toggleTask
│       │   ├── useKeyboardShortcuts.js
│       │   ├── usePullToRefresh.js
│       │   └── useInlineAutocomplete.js
│       └── components/
│           ├── tasks/
│           │   ├── TaskDetail.jsx  # Right-panel task editor (title, status, due date, recurrence, tags, links, subtasks)
│           │   ├── TaskList.jsx    # List view with grouping/sorting
│           │   ├── TaskCard.jsx    # Card used in list + kanban
│           │   └── KanbanBoard.jsx # Board view with drag-and-drop
│           ├── layout/
│           │   ├── Sidebar.jsx     # Nav sidebar (desktop); settings button
│           │   └── TabBar.jsx      # Bottom nav (mobile)
│           └── settings/
│               └── SettingsModal.jsx  # Tabbed modal: Calendars, Integrations (Obsidian+OTel), Notifications
│
├── requirements.txt                # Python deps (at repo root, not inside server/)
├── Dockerfile                      # Single image: builds client, runs gunicorn
├── docker-compose.yml
└── Makefile                        # make up/down/build/logs/shell/db/pull/reset
```

---

## Key Patterns

### Backend
- All routes are Flask Blueprints registered in `main.py`
- DB access is synchronous psycopg2; connection opened per-request via `lib/db.py` helpers
- Settings are a single JSONB row in the `settings` table; use `get_settings()` / `save_settings(data)`
- Adding a new route: create `server/routes/foo.py` with `bp = Blueprint(...)`, add endpoint, import and `app.register_blueprint(foo_bp)` in `main.py`

### Frontend
- All API calls go through `client/src/api/index.js` — add new calls there
- Global state lives in `AppContext` (reducer pattern); dispatch actions like `UPDATE_TASK`, `SET_SETTINGS`
- Task mutations use `useTasks` hook — `updateTask(id, data)` dispatches `UPDATE_TASK` and shows toast on error
- `TaskDetail.jsx` is the main task editor; fields save independently via `updateTask` with only their changed field as an override

### State update after subtask mutations
- Subtask API endpoints return only the subtask row, NOT the full task
- After any subtask create/update/delete, re-fetch the full task: `api.getTask(taskId)` then dispatch `UPDATE_TASK`

---

## Database Schema (key tables)

```sql
tasks       — id, title, description, status, due_date, due_time, project_id, tags (JSONB),
              links (JSONB), recurrence, recurrence_end, parent_task_id, created_at, position
subtasks    — id, task_id (FK→tasks), title, completed, position, due_date, due_time, labels (JSONB)
projects    — id, name, color, icon, position
settings    — id=1, data JSONB   (single row)
ics_calendars — id, name, url, color, raw_ics
sessions    — id, user_id, expires_at
```

`parent_task_id` on `tasks` is used for recurring task clones only — do not repurpose it.

---

## Environment Variables

| Variable | Where used |
|---|---|
| `POSTGRES_PASSWORD` | db + app |
| `TD_USERNAME` / `TD_PASSWORD` / `TD_API_KEY` | auth |
| `GCAL_CREDENTIALS_JSON` / `GCAL_CALENDAR_ID` | gcal.py |
| `OBSIDIAN_VAULT` / `OBSIDIAN_INBOX` | startup defaults (overridden by settings table) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME` | backend OTel |
| `VITE_OTEL_ENDPOINT` / `VITE_OTEL_SERVICE_NAME` | frontend OTel (also settable via Settings UI) |

---

## Notes

### Subtask linked tasks
`subtasks.linked_task_id` (nullable FK → tasks) marks a subtask as a reference to an existing task. When set:
- Backend enriches the subtask with `linked_task_title` and `linked_task_status` via LEFT JOIN
- Completing the subtask also sets the linked task's status to `done`
- Frontend renders linked subtasks with a status dot and clickable title that opens the linked task

### Field save pattern in TaskDetail
Each field saves independently — no shared dirty state. Text areas (title, notes) save on `onBlur` only if value changed. All other fields (status, due date, project, tags, recurrence) call `updateTask` immediately on change. The `POST /subtasks` endpoint returns the full parent task so one dispatch updates everything.
