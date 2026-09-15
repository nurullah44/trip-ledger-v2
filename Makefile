# Trip Ledger — day-to-day commands.
#
#   make install   # once
#   make dev       # frontend on :8080 and API on :8000 together
#
# `make help` lists everything.

SHELL := bash
.DEFAULT_GOAL := help

FRONTEND := frontend
BACKEND := backend

.PHONY: help install dev run frontend backend test test-frontend test-backend lint build check spec clean

help: ## List the targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install frontend and backend dependencies
	cd $(FRONTEND) && npm install
	cd $(BACKEND) && uv sync

dev: ## Run the API and the frontend together (Ctrl-C stops both)
	@$(MAKE) -j2 backend frontend

run: dev ## Alias for `make dev`

frontend: ## Vite dev server on http://localhost:8080
	cd $(FRONTEND) && npm run dev

backend: ## FastAPI dev server on http://localhost:8000 (interactive docs at http://localhost:8000/docs)
	cd $(BACKEND) && uv run uvicorn app.main:app --reload --host 0.0.0.0

test: test-frontend test-backend ## Run both test suites

test-frontend: ## Frontend tests (vitest)
	cd $(FRONTEND) && npx vitest run

test-backend: ## Backend tests (pytest)
	cd $(BACKEND) && uv run pytest

lint: ## Lint the frontend (eslint)
	cd $(FRONTEND) && npm run lint

build: ## Type-check and build the frontend
	cd $(FRONTEND) && npm run build

check: lint test ## Lint plus both test suites

spec: ## Validate openapi.yaml (downloads the Redocly CLI on first run)
	npx --yes @redocly/cli@latest lint openapi.yaml

clean: ## Remove build output and caches
	rm -rf $(FRONTEND)/dist $(FRONTEND)/.output $(FRONTEND)/.tanstack $(FRONTEND)/.wrangler
	rm -rf $(BACKEND)/.pytest_cache
	find $(BACKEND) -path $(BACKEND)/.venv -prune -o -name __pycache__ -type d -exec rm -rf {} +
