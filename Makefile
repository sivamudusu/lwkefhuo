.DEFAULT_GOAL := help

VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo unknown)
MONTH ?= 2026-01

.PHONY: help install ingest version dev-api dev-web run test lint format build docker-build docker-up docker-down clean distclean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install backend and frontend dependencies
	cd backend && uv sync --all-groups
	cd frontend && npm ci

ingest: ## Rebuild the January snapshot from Elexon (MONTH=2026-01)
	cd backend && uv run python -m reint.ingest --month $(MONTH)

version: ## Print the version a build would carry
	@echo $(VERSION)

dev-api: ## Run the FastAPI backend on :8000
	cd backend && APP_VERSION=$(VERSION) uv run uvicorn reint.api.app:app --app-dir src --reload --port 8000

dev-web: ## Run the Next.js frontend on :3000
	cd frontend && npm run dev

run: ## Run the API and web app together
	@trap 'kill 0' EXIT; \
	(cd backend && APP_VERSION=$(VERSION) uv run uvicorn reint.api.app:app --app-dir src --reload --port 8000) & \
	(cd frontend && npm run dev) & \
	wait

test: ## Run the backend test suite
	cd backend && uv run pytest

lint: ## Lint and type-check both applications
	cd backend && uv run ruff format --check . && uv run ruff check . && uv run ty check src
	cd frontend && npm run lint

format: ## Format backend code and fix frontend lint where possible
	cd backend && uv run ruff format . && uv run ruff check --fix .
	cd frontend && npx eslint . --fix

build: ## Type-check the API and build the web app
	cd backend && uv run ty check src
	cd frontend && npm run build

docker-build: ## Build both Docker images
	VERSION=$(VERSION) docker compose build

docker-up: ## Run the full stack with Docker Compose
	VERSION=$(VERSION) docker compose up --build

docker-down: ## Stop the Docker Compose stack
	docker compose down

clean: ## Remove build and test artifacts
	rm -rf backend/.pytest_cache backend/.ruff_cache backend/.ty_cache backend/**/__pycache__
	rm -rf frontend/.next frontend/out frontend/coverage
	find backend -name '*.pyc' -delete

distclean: clean ## Remove build artifacts and installed dependencies
	rm -rf backend/.venv frontend/node_modules
