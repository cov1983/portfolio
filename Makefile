# Single entry points for humans, agents and CI (docs/workflow-guide.md §4.0.2). CI calls these
# targets, so a green `make verify` locally means a green `lint` and `test` job.

.DEFAULT_GOAL := help
.PHONY: help setup format format-check lint typecheck test verify build dev preview

PNPM ?= pnpm

help:
	@echo "Targets:"
	@echo "  make setup         install dependencies from the lockfile"
	@echo "  make verify        format check + lint + typecheck + unit tests; must pass before any commit"
	@echo "  make format        rewrite files with Prettier"
	@echo "  make format-check  fail on unformatted files"
	@echo "  make lint          ESLint, warnings are errors"
	@echo "  make typecheck     tsc --noEmit for src and for the config files"
	@echo "  make test          Vitest with coverage (ratchet thresholds in vitest.config.ts)"
	@echo "  make build         production build to dist/"
	@echo "  make dev           Vite dev server"
	@echo "  make preview       serve dist/ as production would"

setup:
	$(PNPM) install --frozen-lockfile

format:
	$(PNPM) exec prettier --write .

format-check:
	$(PNPM) exec prettier --check .

lint:
	$(PNPM) exec eslint . --max-warnings 0

typecheck:
	$(PNPM) exec tsc --noEmit -p tsconfig.json
	$(PNPM) exec tsc --noEmit -p tsconfig.node.json

test:
	$(PNPM) exec vitest run --coverage

verify: format-check lint typecheck test

build:
	$(PNPM) exec vite build

dev:
	$(PNPM) exec vite

preview:
	$(PNPM) exec vite preview
