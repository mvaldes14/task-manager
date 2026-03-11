# TD — Task Manager

A self-hosted task manager that runs as a PWA on phone and web. Understands natural language, syncs with Google Calendar, and links to Obsidian notes.

## Quick Start

```bash
cp .env.example .env   # edit credentials
make up                # build and start
```

Open [http://localhost:5001](http://localhost:5001).

### Pull pre-built image (no build required)

```bash
make pull   # pulls ghcr.io/mvaldes14/task-manager:latest
```

### Install on phone

1. Open `http://<your-local-ip>:5001` in Safari (iOS) or Chrome (Android)
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
| `OBSIDIAN_VAULT` | Obsidian vault name |
| `OBSIDIAN_INBOX` | Folder for new notes (e.g. `00-Inbox`) |

---

## Natural Language

Type naturally in the FAB — dates, times, projects and recurrence are all parsed automatically.

```
take out trash next monday
call dentist tuesday at 2:30pm #health
finish report by friday
standup daily at 9am
pay rent end of month
review PR in 3 days
```

### Syntax

| Syntax | Effect |
|---|---|
| `#projectname` | Assign to project |
| `@label` | Add tag |
| `next monday`, `tomorrow`, `in 3 days` | Due date |
| `at 3pm`, `at 14:30` | Due time |
| `every monday`, `daily`, `every 2 weeks` | Recurrence |
| `!notename` | Create new Obsidian note and link it |

---

## Features

- **NLP scheduling** — natural language to due date, time, project, recurrence
- **3 views** — List, Kanban board, Calendar (toggle in header)
- **Drag and drop** — Kanban: drag cards between columns; Calendar: drag tasks to reschedule
- **Pull to refresh** — pull down on mobile to reload
- **Recurring tasks** — daily, weekly, monthly, interval; auto-reschedules on completion
- **Projects** — custom icon (25 lucide icons) and color
- **Subtasks** — nested tasks with completion tracking
- **Links** — attach URLs per task (Obsidian, GitHub, or any URL), auto-labeled
- **Overdue view** — past-due tasks grouped by date
- **Google Calendar sync** — tasks with due dates sync automatically; done tasks shown in graphite
- **Obsidian integration** — `!notename` creates a note; detail panel links existing notes
- **PWA** — installable on iOS and Android
- **Tokyo Night** — dark and light theme

---

## Views

| View | Description |
|---|---|
| **Inbox** | All tasks |
| **Today** | Tasks due today |
| **All Tasks** | Everything |
| **Overdue** | Past-due tasks grouped by date |
| **Project** | Tasks scoped to a project |

Each view supports 3 display modes via the toggle in the header:

| Mode | Description |
|---|---|
| List | Grouped by status with show/hide done + sort options |
| Board | Kanban with drag-to-reorder between columns |
| Calendar | Monthly calendar with drag-to-reschedule |

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

```bash
curl -X POST http://localhost:5001/api/nlp/parse \
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
| `GET` | `/api/tasks/upcoming` | Tasks due in the next 7 days |
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
| `recurrence` | string | e.g. `daily`, `weekly`, `every 2 weeks` |
| `recurrence_end` | `YYYY-MM-DD` | Stop date for recurrence |

```bash
# Create a task
curl -X POST http://localhost:5001/api/tasks \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy groceries", "due_date": "2026-03-15", "tags": ["errands"]}'

# Update status
curl -X PATCH http://localhost:5001/api/tasks/<id> \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'

# Mark done via NLP parse + create in one shot (jq required)
curl -s -X POST http://localhost:5001/api/nlp/parse \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "standup tomorrow at 9am #work"}' \
  | curl -X POST http://localhost:5001/api/tasks \
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

```bash
# Add a subtask
curl -X POST http://localhost:5001/api/tasks/<id>/subtasks \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Pick up milk"}'

# Mark subtask complete
curl -X PATCH http://localhost:5001/api/tasks/<id>/subtasks/<sid> \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

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
| `icon` | string | Lucide icon name e.g. `rocket`, `briefcase`, `folder` |

```bash
# Create a project
curl -X POST http://localhost:5001/api/projects \
  -H "Authorization: Bearer $TD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Work", "color": "#7aa2f7", "icon": "briefcase"}'
```

Available icons: `folder`, `home`, `briefcase`, `target`, `flask`, `book`, `palette`, `bulb`, `cart`, `dumbbell`, `music`, `plane`, `monitor`, `leaf`, `rocket`, `heart`, `star`, `zap`, `globe`, `code`, `camera`, `coffee`, `wrench`, `shield`, `smile`

---

### Google Calendar

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/gcal/status` | Check if GCal is connected |
| `POST` | `/api/gcal/sync` | Trigger a full sync of all tasks with due dates |

---

### Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings` | Returns `gcal_enabled`, `obsidian_vault`, `username` |

---

## Automation Examples

### iOS Shortcut — quick capture
Add tasks from anywhere on your phone using the iOS Shortcuts app:

```
POST /api/nlp/parse   → pipe result →   POST /api/tasks
Authorization: Bearer <TD_API_KEY>
```

### Shell alias — add task from terminal

```bash
td() {
  curl -s -X POST http://localhost:5001/api/nlp/parse \
    -H "Authorization: Bearer $TD_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$*\"}" \
  | curl -s -X POST http://localhost:5001/api/tasks \
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
curl -s http://localhost:5001/api/tasks/overdue \
  -H "Authorization: Bearer $TD_API_KEY" \
  | jq '[.[] | {id, title, due_date, status}]'
```

---

## Stack

- **Backend** — Python 3.12 + Flask + PostgreSQL
- **Frontend** — React + Vite + Tailwind CSS (Tokyo Night theme)
- **Auth** — Session-based with PostgreSQL storage, optional Bearer API key
- **Deployment** — Docker Compose, data persisted in `./data/postgres/`

---

## CI

Every push to `main` builds and pushes a multi-arch image (`amd64` + `arm64`) to `ghcr.io/mvaldes14/task-manager:latest` via GitHub Actions.
