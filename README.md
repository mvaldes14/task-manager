# ⚡ TaskFlow

A Todoist replacement that runs locally, works on phone & web, and understands natural language.

## Quick Start (Docker)

```bash
docker compose up -d
```

Open http://localhost:5000. Data persists in a Docker volume automatically.

**On your phone:** find your machine's local IP and open `http://192.168.1.x:5000`.
- **iPhone:** Safari → Share → "Add to Home Screen"
- **Android:** Chrome menu → "Add to Home Screen"

```bash
docker compose down              # stop
docker compose logs -f           # view logs
docker compose up -d --build     # rebuild after updates
```

---

## Manual Setup (no Docker)

```bash
pip install flask
python3 server.py
```

---

## Natural Language Examples
- `take out the trash next monday`
- `call dentist tuesday at 2:30pm #health urgent`
- `finish report by friday`
- `buy groceries tomorrow #errands`
- `pay rent end of month`
- `review PR in 3 days`

## File Structure
```
taskflow/
├── Dockerfile
├── docker-compose.yml
├── server.py
└── client/
    ├── index.html
    ├── manifest.json
    └── sw.js
```
