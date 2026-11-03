# Doit — Task Manager

![Logo](https://s3.mvaldes.dev/doit-logo.png)

Self-hosted, multi-user task manager for desktop and mobile. Runs as an installable PWA, understands natural-language task input, and integrates with calendars, notifications, automation webhooks, and OpenTelemetry.

Desktop
<img width="2862" height="1728" alt="image" src="https://github.com/user-attachments/assets/337d9144-498e-4a28-b96e-a17d5a3974da" />

<img width="2868" height="1732" alt="image" src="https://github.com/user-attachments/assets/19bdbf8b-9d77-428d-8af4-49a4d9b02d30" />

<img width="2850" height="1714" alt="image" src="https://github.com/user-attachments/assets/d2b4b060-eeae-4b2c-95cf-66c37d4fbd90" />

Mobile

<img width="652" height="1588" alt="image" src="https://github.com/user-attachments/assets/3cf0f79f-e4ad-4111-9818-40becbd7fa33" />

---

## Features

### Task management

- **Natural-language capture** — extracts dates, times, projects, tags, assignees, priorities, recurrence, and inline links
- **Four statuses** — To do, In progress, Blocked, and Done
- **Priorities** — low, medium, and high; Today view promotes highest-priority work into a focus card
- **Three display modes** — grouped List, drag-and-drop Kanban, and desktop Table with sortable/resizable columns
- **Search** — global or current-view search by title, description, or task key
- **Bulk actions** — multi-select tasks, move them to another project, or mark them complete
- **Drag and drop** — reorder Kanban cards, change status, reschedule calendar items, or drop a task onto a sidebar project
- **Mobile gestures** — swipe to complete/reschedule/delete, long-press to select, pull to refresh, and swipe sheets closed
- **Recurring tasks** — RFC 5545 RRULE storage with next occurrence created on completion
- **Subtasks** — editable checklist items or links to existing tasks; completing a linked subtask completes its task
- **Links** — colored link pills for GitHub, Obsidian, and arbitrary URLs; `!<url>` extracts links during quick capture
- **Safe deletion** — task deletion is soft by default, with Undo in UI and restore API; permanent purge remains available
- **Stable task keys** — immutable sequence IDs such as `DO-142`; API accepts UUID, formatted key, or bare sequence number

### Projects and planning

- **Projects and subprojects** — one nesting level, roll-up parent views, descriptions, deadlines, progress, sharing, and archiving
- **Project customization** — colors and 50 Lucide icons; drag to reorder
- **Upcoming and Overdue views** — 7/14-day planning plus past-due grouping and quick rescheduling
- **Calendar** — month, week, and day layouts with drag-to-reschedule on desktop
- **Dashboard** — 7/30/90-day stats, trends, heatmap, status breakdown, project progress, top tags, streaks, and at-risk project deadlines

### Integrations and platform

- **Multi-user** — admin-managed users, assignments, avatars, password changes, private tasks, and shared projects
- **Google Calendar** — automatic task event sync plus manual full sync
- **ICS calendars** — import by URL or `.ics` upload
- **Notifications** — ntfy or Gotify reminders for timed tasks, all-day tasks, and project deadlines
- **Bot webhook** — assigning a task to reserved Bot user sends JSON to configured automation endpoint
- **AI results** — external clients can store model-agnostic markdown results against tasks
- **OpenTelemetry** — Flask/psycopg2 backend tracing and browser fetch/document-load tracing
- **PWA** — installable on iOS, Android, and macOS; share-target capture and New Task/Today app shortcuts
- **Responsive UI** — mobile tab bar/drawer, collapsible desktop sidebar, keyboard shortcuts, and persisted preferences
- **Theme modes** — Auto/system, Light, and Dark

---

## Quick Start

```bash
cp .env.example .env   # edit credentials
make up                # build and start
```

Open [http://localhost:3000](http://localhost:3000).

### Pull pre-built image (no build required)

```bash
make pull   # pulls ghcr.io/mvaldes14/task-manager:latest
```

### Install on phone

1. Open `http://<your-ip>:3000` in Safari (iOS) or Chrome (Android)
2. Share → **Add to Home Screen**

---

## Configuration

Copy `.env.example` to `.env` and set:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Database password (default: `td`) |
| `TD_USERNAME` | Login username |
| `TD_PASSWORD` | Login password (leave blank to disable auth) |
| `TD_API_KEY` | API key for Bearer token auth (automations) |
| `GCAL_CREDENTIALS_JSON` | Google service account JSON (single line) |
| `GCAL_CALENDAR_ID` | Calendar to sync to (default: `primary`) |
| `OBSIDIAN_VAULT` | Vault name used to build `obsidian://` links from `![[Note]]` quick-capture syntax |
| `OBSIDIAN_INBOX` | Default vault folder for Obsidian links |

Runtime settings managed in **Settings** include frontend OTLP endpoint, Bot webhook URL, notification provider/token, reminder timing/timezone, and task-key prefix. Backend tracing uses `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, and optional `OTEL_EXPORTER_OTLP_INSECURE` container environment variables.

---

## Natural Language

Type naturally in the task input — dates, times, projects, tags, and recurrence are all parsed automatically.

```
take out trash next monday
call dentist tuesday at 2:30pm #health
finish report by friday @urgent
standup daily at 9am
pay rent end of month
review PR in 3 days !https://github.com/org/repo/pull/42
meeting every monday and friday at 10am
fix flaky test p1 +alice
```

### Syntax

| Syntax | Effect |
|---|---|
| `#projectname` | Assign to project |
| `@label` | Add tag |
| `+username` | Assign task to a user |
| `p1` / `p2` / `p3` | Priority (high / medium / low) |
| `!<url>` | Strip URL from title and attach it as a link chip (auto-labeled) |
| `next monday`, `tomorrow`, `in 3 days` | Due date |
| `at 3pm`, `noon`, `EOD`, `morning` | Due time |
| `every monday`, `daily`, `every 2 weeks` | Recurrence (stored as RRULE) |

### Recurrence Patterns

| Input | RRULE |
|---|---|
| `daily` / `every day` | `RRULE:FREQ=DAILY` |
| `every weekday` | `RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` |
| `every weekend` | `RRULE:FREQ=WEEKLY;BYDAY=SA,SU` |
| `every monday` | `RRULE:FREQ=WEEKLY;BYDAY=MO` |
| `every monday and friday` | `RRULE:FREQ=WEEKLY;BYDAY=MO,FR` |
| `every 2 weeks` | `RRULE:FREQ=WEEKLY;INTERVAL=2` |
| `monthly` | `RRULE:FREQ=MONTHLY` |
| `end of month` | `RRULE:FREQ=MONTHLY;BYMONTHDAY=-1` |
| `first monday of the month` | `RRULE:FREQ=MONTHLY;BYDAY=+1MO` |
| `yearly` / `annually` | `RRULE:FREQ=YEARLY` |

---

## Views & Modes

| View | Description |
|---|---|
| **Inbox** | Unassigned tasks |
| **Today** | Priority focus view with focus task, supporting work, completed-only filter, and overdue rows |
| **Upcoming** | Tasks due in next 7 or 14 days |
| **All Tasks** | All visible tasks |
| **Overdue** | Past-due tasks grouped by date with quick rescheduling |
| **Calendar** | Month, week, or day calendar |
| **Dashboard** | Productivity metrics and at-risk projects |
| **Projects** | Project scope; parent projects roll up direct subproject tasks |

Task views support these display modes:

| Mode | Description |
|---|---|
| List | Group by status or tags, collapse groups, filter completed tasks, and sort |
| Board | Four-column Kanban with drag-to-reorder/status changes |
| Table | Desktop-only sortable table with persisted resizable columns and selection mode |

---

## Keyboard Shortcuts

Desktop only.

| Key | Action |
|---|---|
| `q` | Add new task |
| `/` | Search tasks |
| `d` | Go to Dashboard |
| `i` | Go to Inbox |
| `t` | Go to Today |
| `a` | Go to All Tasks |
| `o` | Go to Overdue |
| `c` | Go to Calendar |
| `l` | List view |
| `k` | Kanban view |
| `b` | Table view |
| `s` | Toggle sidebar collapse |
| `?` | Show shortcuts |
| `Esc` | Close active overlay or clear selection |

---

## Make Commands

```bash
make up          # start everything (builds if needed)
make pull        # pull latest image from ghcr.io and start
make down        # stop
make build       # force full rebuild, no cache
make restart     # restart app only
make logs        # tail app logs
make logs-db     # tail PostgreSQL logs
make shell       # bash into app container
make db          # psql into postgres
make status      # show containers + auth status
make open        # open browser (macOS)
make export      # export tasks as JSON
make sync-gcal   # trigger Google Calendar full sync
make clean       # remove containers and local images
make reset       # wipe everything including DB data
```

---

## API Reference

All endpoints require either a session cookie (browser login) or a `Bearer` token:

```
Authorization: Bearer <TD_API_KEY>
```

A full machine-readable spec is available at [`openapi.yaml`](openapi.yaml).

---

### NLP

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/nlp/parse` | Parse natural language into task fields |

> If running locally baseurl is localhost:3000, otherwise it is your custom domain.

```bash
curl -X POST http://baseurl/api/nlp/parse \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "call dentist 2026-03-18 at 2pm #health @calls"}'
```

**Response:**
```json
{
  "title": "call dentist",
  "due_date": "2026-03-18",
  "due_time": "14:00",
  "project_name": "health",
  "labels": ["calls"],
  "assigned_to_username": null,
  "priority": null,
  "links": [],
  "recurrence": null,
  "nlp_summary": "#health · due Wed Mar 18 · at 2:00pm · @calls"
}
```

---

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | List visible tasks; supports project, status, priority, tags, assignee, due-date, search, limit, and offset filters |
| `GET` | `/api/tasks/today` | Open tasks due today |
| `GET` | `/api/tasks/upcoming` | Open tasks due within 7 days |
| `GET` | `/api/tasks/overdue` | Open past-due tasks |
| `GET` | `/api/tasks/search?q=<query>` | Type-ahead search for linking tasks |
| `GET` | `/api/tasks/<id>` | Get task by UUID, task key (`DO-142`), or sequence (`142`) |
| `POST` | `/api/tasks` | Create task; set `skip_nlp: true` for deterministic API writes |
| `PATCH` | `/api/tasks/<id>` | Update task fields |
| `PATCH` | `/api/tasks/bulk` | Move or change status for up to 200 tasks |
| `POST` | `/api/tasks/<id>/restore` | Restore soft-deleted task |
| `DELETE` | `/api/tasks/<id>` | Soft-delete task; add `?purge=true` for permanent deletion |

**Task fields:**

| Field | Type | Description |
|---|---|---|
| `title` | string | Task title |
| `description` | string | Notes / body |
| `status` | `todo\|doing\|blocked\|done` | Current status |
| `priority` | `low\|medium\|high` | Task priority |
| `due_date` | `YYYY-MM-DD` | Due date |
| `due_time` | `HH:MM` | Due time (triggers timed GCal event) |
| `project_id` | string | Project ID (default: `inbox`) |
| `assigned_to` | string | User ID; assigning reserved Bot user triggers configured webhook |
| `tags` | string[] | Array of tag strings |
| `links` | `{url, label}[]` | Array of link objects |
| `recurrence` | string | RFC 5545 RRULE e.g. `RRULE:FREQ=WEEKLY;BYDAY=MO` |
| `recurrence_end` | `YYYY-MM-DD` | Stop date for recurrence |

```bash
# Create a task
curl -X POST http://baseurl/api/tasks \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy groceries", "due_date": "2026-03-15", "tags": ["errands"]}'

# Update status
curl -X PATCH http://baseurl/api/tasks/<id> \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'

# Parse NLP + create in one shot (requires jq)
curl -s -X POST http://baseurl/api/nlp/parse \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "standup tomorrow at 9am #work"}' \
  | curl -X POST http://baseurl/api/tasks \
    -H "Authorization: Bearer $TD_API_KEY" \
    -H "Content-Type: application/json" \
    -d @-
```

---

### Subtasks

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/tasks/<id>/subtasks` | Add checklist item (`title`) or task reference (`linked_task_id`) |
| `PATCH` | `/api/tasks/<id>/subtasks/<sid>` | Rename or complete a subtask |
| `DELETE` | `/api/tasks/<id>/subtasks/<sid>` | Delete subtask |

Subtask titles are stored verbatim and do not run through NLP. Passing `linked_task_id` references an existing task; completing linked subtask marks referenced task done. `POST` returns full parent task; `PATCH` returns changed subtask row.

---

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List user-visible projects ordered by sidebar position |
| `POST` | `/api/projects` | Create root project or one-level subproject |
| `PATCH` | `/api/projects/<id>` | Update metadata, sharing, hierarchy, deadline, or archive state |
| `POST` | `/api/projects/reorder` | Persist depth-first sidebar order — body: `{"order": ["<pid1>", "<pid2>", ...]}` |
| `DELETE` | `/api/projects/<id>` | Delete project; tasks move to Inbox and children become roots |

**Project fields:**

| Field | Type | Description |
|---|---|---|
| `name` | string | Project name |
| `color` | string | Hex color e.g. `#7aa2f7` |
| `icon` | string | Lucide icon storage key |
| `parent_id` | string/null | Root parent ID; nesting is limited to one level |
| `description` | string | Project notes/summary |
| `due_date` | `YYYY-MM-DD` | Project deadline used by reminders and at-risk dashboard |
| `shared` | boolean | Make project tasks visible to all users |
| `archived` | boolean | Write-only convenience flag; archived projects/tasks are hidden from active views and stats |

50 icon keys are available; see [`client/src/components/shared/ProjectIcon.jsx`](client/src/components/shared/ProjectIcon.jsx) for registry.

---

### Google Calendar

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/gcal/status` | Check if GCal is connected |
| `POST` | `/api/gcal/sync` | Trigger a full sync of all tasks with due dates |

---

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats?days=30` | Productivity stats (7/30/90d), project progress, tags, streaks, and at-risk project deadlines |

### Users

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List all users (id, username, display_name, is_admin, has_avatar) |
| `GET` | `/api/users/me` | Current user profile |
| `PATCH` | `/api/users/me` | Update display name or change password (`current_password` + `new_password`) |
| `POST` | `/api/users/me/avatar` | Upload avatar image (multipart/form-data `file`); resized to 50×50 JPEG |
| `GET` | `/api/users/<id>/avatar` | Serve user avatar as JPEG |
| `POST` | `/api/users` | Create user — admin only (`username`, `password`, optional `display_name`) |

### Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings` | Get calendar state, Obsidian defaults, frontend OTel, Bot webhook, notifications/reminders, and task-key prefix |
| `PATCH` | `/api/settings` | Update mutable settings; `task_key_prefix` must be 2–6 letters/digits starting with a letter |

---

### Bot webhook

Doit seeds reserved, non-login **Bot** user. Configure `ai_webhook_url` in Settings, then assign task to Bot. Doit sends:

```json
{
  "event": "task.assigned_to_bot",
  "task": {
    "id": "<uuid>",
    "seq": 142,
    "key": "DO-142"
  }
}
```

Payload also includes full task fields. Webhook fires on creation assigned to Bot, or when assignment changes from another user to Bot.

---

### AI Results

Store and retrieve AI-generated content attached to a task. The backend is model-agnostic — any external client can write results; the frontend reads them.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks/<id>/ai` | Get stored AI result for a task |
| `PUT` | `/api/tasks/<id>/ai` | Store (upsert) AI result for a task |

**PUT body:**

| Field | Type | Description |
|---|---|---|
| `content` | string | AI-generated text (required) |
| `model` | string | Model identifier e.g. `claude-sonnet-4-6` (optional) |

```bash
# Store an AI result
curl -X PUT http://baseurl/api/tasks/<id>/ai \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Break this into: 1) research, 2) draft, 3) review", "model": "claude-sonnet-4-6"}'

# Retrieve it
curl http://baseurl/api/tasks/<id>/ai \
  -H "Authorization: Bearer $TD_API_KEY"
```

**GET response:**
```json
{
  "content": "Break this into: 1) research, 2) draft, 3) review",
  "model": "claude-sonnet-4-6",
  "created_at": "2026-04-24T10:00:00",
  "updated_at": "2026-04-24T10:05:00"
}
```

Tasks with a stored result have `has_ai_result: true` in their task object.

---

## Automation Examples

### iOS Shortcut — quick capture

Add tasks from anywhere on your phone via the iOS Shortcuts app:

```
POST baseurl/api/tasks
Headers:
  Authorization: Bearer <TD_API_KEY>
Body:
  title: Shortcut input
```

### Shell alias — add task from terminal

```bash
td() {
  curl -s -X POST http://baseurl/api/nlp/parse \
    -H "Authorization: Bearer $TD_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$*\"}" \
  | curl -s -X POST http://baseurl/api/tasks \
    -H "Authorization: Bearer $TD_API_KEY" \
    -H "Content-Type: application/json" \
    -d @-
  echo "Added: $*"
}

# Usage:
td buy milk tomorrow #errands
td standup daily at 9am #work
```

### Query overdue tasks

```bash
curl -s http://baseurl/api/tasks/overdue \
  -H "Authorization: Bearer $TD_API_KEY" \
  | jq '[.[] | {id, title, due_date, status}]'
```

---

## Stack

- **Backend** — Python 3.12 + Flask + PostgreSQL
- **Frontend** — React 19 + Vite + Tailwind CSS
- **NLP** — `dateparser` + `python-dateutil` (RRULE)
- **AI** — model-agnostic result storage per task; any client writes via `PUT /api/tasks/<id>/ai`
- **Observability** — OpenTelemetry SDK (backend: Flask + psycopg2; frontend: fetch + document-load); opt-in via env vars or Settings UI
- **Theme** — Tailwind CSS with system/light/dark modes
- **Auth** — PostgreSQL-backed sessions plus optional Bearer API key
- **Deployment** — Docker Compose; data persisted in `./data/postgres/`

---

## CI / Deployment

Every push to `main` runs reusable GitHub Actions workflow and publishes multi-arch images (`amd64` + `arm64`) to `ghcr.io/mvaldes14/task-manager`, tagged `latest` plus timestamped build tag.
