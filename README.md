# Doit — Task Manager

![Logo](https://s3.mvaldes.dev/doit-logo.png)

A self-hosted task manager that runs as a PWA on phone and web. Understands natural language, syncs with Google Calendar, and links to Obsidian notes.

![Dark Mode](https://s3.mvaldes.dev/doit.png)

![Light Mode](https://s3.mvaldes.dev/doit2.png)

---

## Features

- **Dashboard** — productivity overview with stat cards, completion trend chart, activity heatmap, status donut, project progress bars, top tags, and streak / completion-rate insights; filterable by 7 / 30 / 90-day window
- **Multi-user** — admin can create users; each user has a display name, bcrypt password, and optional avatar (stored in DB, served as JPEG); role-based admin flag
- **Shared projects** — mark a project as shared so all users can see its tasks; per-project toggle in the project editor
- **NLP scheduling** — natural language → due date, time, project, tags, recurrence
- **2 views** — List, Kanban board
- **Group & sort** — group by Status or Tags; sort by Status, Due Date, Project, Title, or Created
- **Drag and drop** — Kanban: drag cards between columns; Calendar: drag tasks to reschedule
- **Pull to refresh** — pull down on mobile to reload
- **Recurring tasks** — RFC 5545 RRULE format; auto-reschedules on completion
- **Projects** — custom icon (25 lucide icons) and color
- **Subtasks** — nested tasks with completion tracking
- **Links** — attach URLs per task (Obsidian, GitHub, or any URL), auto-labeled
- **Overdue view** — past-due tasks grouped by date
- **Google Calendar sync** — tasks with due dates sync automatically; done tasks shown in linked calendar
- **ICS calendar import** — import external calendars via URL or `.ics` file upload (managed in Settings)
- **Obsidian integration** — `!notename` creates a note; detail panel links existing notes
- **Push notifications** — ntfy or Gotify support for due-date reminders (configured in Settings)
- **Settings modal** — Account tab (avatar, display name, password change), Calendars, Integrations (Obsidian, OTel), and Notifications
- **OpenTelemetry** — backend (Flask + psycopg2) and frontend (fetch + document-load) tracing; opt-in via env vars or Settings UI
- **PWA** — installable on iOS, Android, and macOS
- **Collapsible sidebar** — full sidebar or slim icon rail (desktop); persisted preference
- **Keyboard shortcuts** — full shortcut set on desktop (press `?` to see them)
- **Theme** — toggle in sidebar

---

## Quick Start

```bash
cp .env.example .env   # edit credentials
make up                # build and start
```

Open [http://localhost:5001](http://localhost:5001).

### Pull pre-built image (no build required)

```bash
make pull   # pulls ghcr.io/mvaldes14/doit:latest
```

### Install on phone

1. Open `http://<your-ip>:5000` in Safari (iOS) or Chrome (Android)
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
| `OBSIDIAN_VAULT` | Obsidian vault name (can also be set in Settings UI) |
| `OBSIDIAN_INBOX` | Folder for new notes (e.g. `00-Inbox`) (can also be set in Settings UI) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Backend gRPC OTLP endpoint (e.g. `http://signoz:4317`) |
| `OTEL_SERVICE_NAME` | Backend service name (default: `doit`) |
| `VITE_OTEL_ENDPOINT` | Frontend HTTP OTLP endpoint (e.g. `http://signoz:4318`); can also be set in Settings UI |
| `VITE_OTEL_SERVICE_NAME` | Frontend service name (default: `doit-web`) |

---

## Natural Language

Type naturally in the task input — dates, times, projects, tags, and recurrence are all parsed automatically.

```
take out trash next monday
call dentist tuesday at 2:30pm #health
finish report by friday @urgent
standup daily at 9am
pay rent end of month
review PR in 3 days
meeting every monday and friday at 10am
```

### Syntax

| Syntax | Effect |
|---|---|
| `#projectname` | Assign to project |
| `@label` | Add tag |
| `next monday`, `tomorrow`, `in 3 days` | Due date |
| `at 3pm`, `noon`, `EOD`, `morning` | Due time |
| `every monday`, `daily`, `every 2 weeks` | Recurrence (stored as RRULE) |
| `!notename` | Create new Obsidian note and link it |

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
| **Today** | Tasks due today |
| **All Tasks** | Everything |
| **Overdue** | Past-due tasks grouped by date |
| **Calendar** | Monthly calendar view |
| **Projects** | Tasks scoped to a project |

Each list view supports 3 display modes:

| Mode | Description |
|---|---|
| List | Grouped by status or tags; show/hide done; sortable |
| Board | Kanban with drag-to-reorder between columns |

---

## Keyboard Shortcuts

Desktop only.

| Key | Action |
|---|---|
| `q` | Add new task |
| `i` | Go to Inbox |
| `t` | Go to Today |
| `o` | Go to Overdue |
| `c` | Go to Calendar |
| `l` | List view |
| `k` | Kanban view |
| `s` | Toggle sidebar collapse |
| `?` | Show shortcuts |
| `Esc` | Close modal |

---

## Make Commands

```bash
make up          # start everything (builds if needed)
make pull        # pull latest image from ghcr.io and start
make down        # stop
make build       # force full rebuild, no cache
make restart     # restart app only
make logs        # tail app logs
make shell       # bash into app container
make db          # psql into postgres
make status      # show containers + auth status
make open        # open browser (macOS)
make sync-gcal   # trigger Google Calendar full sync
make reset       # wipe everything including DB data
```

---

## API Reference

All endpoints require either a session cookie (browser login) or a `Bearer` token:

```
Authorization: Bearer <TD_API_KEY>
```

---

### NLP

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/nlp/parse` | Parse natural language into task fields |

> If running locally baseurl is localhost:5001, otherwise it is your custom domain.

```bash
curl -X POST http://baseurl/api/nlp/parse \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "call dentist tuesday at 2pm #health"}'
```

**Response:**
```json
{
  "title": "call dentist",
  "due_date": "2026-03-18",
  "due_time": "14:00",
  "project_id": "health",
  "tags": [],
  "recurrence": null
}
```

---

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | List all tasks |
| `GET` | `/api/tasks?project_id=<id>` | Filter by project |
| `GET` | `/api/tasks?status=todo\|doing\|done` | Filter by status |
| `GET` | `/api/tasks?search=<query>` | Full-text search title + description |
| `GET` | `/api/tasks/today` | Tasks due today |
| `GET` | `/api/tasks/overdue` | Past-due tasks |
| `GET` | `/api/tasks/<id>` | Get single task |
| `POST` | `/api/tasks` | Create task |
| `PATCH` | `/api/tasks/<id>` | Update task fields |
| `DELETE` | `/api/tasks/<id>` | Delete task |

**Task fields:**

| Field | Type | Description |
|---|---|---|
| `title` | string | Task title |
| `description` | string | Notes / body |
| `status` | `todo\|doing\|done` | Current status |
| `due_date` | `YYYY-MM-DD` | Due date |
| `due_time` | `HH:MM` | Due time (triggers timed GCal event) |
| `project_id` | string | Project ID (default: `inbox`) |
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
| `POST` | `/api/tasks/<id>/subtasks` | Add subtask |
| `PATCH` | `/api/tasks/<id>/subtasks/<sid>` | Update subtask (`completed`, `title`) |
| `DELETE` | `/api/tasks/<id>/subtasks/<sid>` | Delete subtask |

---

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects (includes task counts) |
| `POST` | `/api/projects` | Create project |
| `PATCH` | `/api/projects/<id>` | Update project |
| `DELETE` | `/api/projects/<id>` | Delete project (tasks moved to inbox) |

**Project fields:**

| Field | Type | Description |
|---|---|---|
| `name` | string | Project name |
| `color` | string | Hex color e.g. `#7aa2f7` |
| `icon` | string | Lucide icon name e.g. `rocket`, `briefcase` |

Available icons: `folder`, `home`, `briefcase`, `target`, `flask`, `book`, `palette`, `bulb`, `cart`, `dumbbell`, `music`, `plane`, `monitor`, `leaf`, `rocket`, `heart`, `star`, `zap`, `globe`, `code`, `camera`, `coffee`, `wrench`, `shield`, `smile`

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
| `GET` | `/api/dashboard/stats?days=30` | Productivity stats (7/30/90d); includes counts, completion trend, activity heatmap, status breakdown, project progress, top tags, streak insights |

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
| `GET` | `/api/settings` | Returns current settings (`gcal_enabled`, `obsidian_vault`, `obsidian_inbox`, `otel_frontend_endpoint`, `notification_type`, `notification_url`, `username`) |
| `PATCH` | `/api/settings` | Update settings fields |

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
- **NLP** — `dateparser` + `python-dateutil` (RRULE) — no external AI API
- **Observability** — OpenTelemetry SDK (backend: Flask + psycopg2; frontend: fetch + document-load); opt-in via env vars or Settings UI
- **Theme** — TailwindCSS dark/light
- **Auth** — Session-based with PostgreSQL storage; optional Bearer API key
- **Deployment** — Docker Compose; data persisted in `./data/postgres/`

---

## CI / Deployment

Every push to `main` builds and pushes a multi-arch image (`amd64` + `arm64`) to `ghcr.io/mvaldes14/doit:latest` via GitHub Actions.

Development happens on `dev` — merge to `main` to trigger a release.
