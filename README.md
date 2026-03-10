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
| `TD_API_KEY` | API key for Bearer token auth |
| `GCAL_CREDENTIALS_JSON` | Google service account JSON (single line) |
| `GCAL_CALENDAR_ID` | Calendar to sync to (default: `primary`) |
| `OBSIDIAN_VAULT` | Obsidian vault name |
| `OBSIDIAN_INBOX` | Folder for new notes (e.g. `00-Inbox`) |

---

## Natural Language

Type naturally in the FAB — dates, times, priorities, projects and recurrence are all parsed automatically.

```
take out trash next monday
call dentist tuesday at 2:30pm #health urgent
finish report by friday
standup daily at 9am
pay rent end of month
review PR in 3 days
```

### Syntax

| Syntax | Effect |
|---|---|
| `#projectname` | Assign to project |
| `@label` | Add label |
| `next monday`, `tomorrow`, `in 3 days` | Due date |
| `at 3pm`, `at 14:30` | Due time |
| `urgent`, `high`, `low` | Priority |
| `every monday`, `daily`, `every 2 weeks` | Recurrence |
| `!notename` | Create new Obsidian note and link it |

---

## Features

- **NLP scheduling** — natural language → due date, time, priority, project, recurrence
- **Recurring tasks** — daily, weekly, monthly, interval; auto-reschedules on completion
- **Projects** — list and kanban views per project
- **Subtasks** — with their own due dates and priorities
- **Overdue view** — hidden until needed, grouped by date
- **To Review** — inbox triage with inline project/label assignment
- **Google Calendar sync** — auto-syncs tasks with due dates
- **Obsidian integration** — `!notename` in FAB creates note; detail panel links existing notes
- **PWA** — installable on iOS and Android, works offline
- **Tokyo Night** — dark and light theme

---

## Make Commands

```bash
make up          # start everything (builds if needed)
make pull        # pull latest image from ghcr.io and start
make down        # stop
make build       # force full rebuild, no cache
make restart     # restart app only (fast after frontend changes)
make logs        # tail app logs
make shell       # bash into app container
make db          # psql into postgres
make status      # show containers + auth status
make open        # open browser (macOS)
make sync-gcal   # trigger Google Calendar full sync
make reset       # ⚠ wipe everything including DB data
```

---

## CI

Every push to `main` builds and pushes a multi-arch image (`amd64` + `arm64`) to `ghcr.io/mvaldes14/task-manager:latest` via GitHub Actions.

---

## Stack

- **Backend** — Python 3.12 + Flask + PostgreSQL
- **Frontend** — Vanilla JS, single HTML file, Tokyo Night theme
- **Auth** — Session-based with PostgreSQL storage, optional API key
- **Deployment** — Docker Compose, data in `./data/postgres/`
