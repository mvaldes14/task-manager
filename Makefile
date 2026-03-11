.PHONY: help up down build restart logs shell db status open clean reset

APP  = task-manager-app-1
DB   = task-manager-db-1
PORT = 5000

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make \033[36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ── Core ─────────────────────────────────────

up: ## Start all services (build if needed)
	docker compose up -d --build
	@echo "\n✓ TD running → http://localhost:$(PORT)\n"

down: ## Stop all services
	docker compose down

pull: ## Pull latest pre-built image from ghcr.io and start
	TD_IMAGE=ghcr.io/mvaldes14/task-manager:latest docker compose pull app
	TD_IMAGE=ghcr.io/mvaldes14/task-manager:latest docker compose up -d
	@echo "\n✓ TD running → http://localhost:$(PORT)\n"

build: ## Force rebuild without cache
	docker compose build --no-cache
	docker compose up -d
	@echo "\n✓ Rebuilt → http://localhost:$(PORT)\n"

restart: ## Restart app only (no rebuild)
	docker compose restart app
	@echo "✓ App restarted"

# ── Dev ──────────────────────────────────────

logs: ## Tail app logs
	docker compose logs -f app

logs-db: ## Tail db logs
	docker compose logs -f db

shell: ## Open shell inside app container
	docker exec -it $(APP) /bin/bash

db: ## Open psql inside db container
	docker exec -it $(DB) psql -U td -d td

status: ## Show running containers and port
	@docker compose ps
	@echo ""
	@curl -s http://localhost:$(PORT)/auth/status | python3 -m json.tool 2>/dev/null || echo "App not reachable"

open: ## Open app in browser (macOS)
	open http://localhost:$(PORT)

# ── Data ─────────────────────────────────────

export: ## Export all tasks to JSON
	@curl -s http://localhost:$(PORT)/api/export | python3 -m json.tool

sync-gcal: ## Trigger a full Google Calendar sync
	@curl -s -X POST http://localhost:$(PORT)/api/gcal/sync | python3 -m json.tool

# ── Cleanup ───────────────────────────────────

clean: ## Stop and remove containers + images
	docker compose down --rmi local

reset: ## ⚠ Nuke everything including DB data
	@echo "This will delete ALL data. Press Ctrl-C to cancel, Enter to continue."
	@read confirm
	docker compose down -v
	rm -rf ./data
	@echo "✓ Reset complete"

# ─── Frontend dev ───────────────────────────────────────────────
dev-frontend: ## Run Vite dev server (proxies API to localhost:5001)
	cd client-react && npm run dev

build-frontend: ## Build React app into client/dist
	cd client-react && npm run build

install-frontend: ## Install frontend dependencies
	cd client-react && npm install
