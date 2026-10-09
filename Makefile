# Single entry points for humans, agents and CI (docs/workflow-guide.md §4.0.2). CI calls these
# targets, so a green `make verify` locally means a green `lint` and `test` job.

.DEFAULT_GOAL := help
.PHONY: help setup format format-check lint typecheck test coverage-ratchet test-e2e verify build dev preview

PNPM ?= pnpm
# Headed Firefox (playwright.config.ts) needs a display: a virtual one where xvfb-run exists.
XVFB_RUN := $(shell command -v xvfb-run >/dev/null 2>&1 && echo 'xvfb-run -a')

help:
	@echo "Targets:"
	@echo "  make setup         install dependencies from the lockfile and the Playwright browsers"
	@echo "  make verify        format check + lint + typecheck + unit tests; must pass before any commit"
	@echo "  make format        rewrite files with Prettier"
	@echo "  make format-check  fail on unformatted files"
	@echo "  make lint          ESLint, warnings are errors"
	@echo "  make typecheck     tsc --noEmit for src and for the config files"
	@echo "  make test          Vitest with coverage against the thresholds in vitest.config.ts"
	@echo "  make coverage-ratchet  make test with COVERAGE_RATCHET=1: raises the thresholds to the measured coverage"
	@echo "  make test-e2e      build, then Playwright in Chromium, Firefox and WebKit against dist/"
	@echo "  make build         production build to dist/"
	@echo "  make dev           Vite dev server"
	@echo "  make preview       serve dist/ as production would"

setup:
	$(PNPM) install --frozen-lockfile
	$(PNPM) exec playwright install --with-deps

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

coverage-ratchet:
	COVERAGE_RATCHET=1 $(MAKE) test

test-e2e: build
	$(XVFB_RUN) $(PNPM) exec playwright test

verify: format-check lint typecheck test

build:
	$(PNPM) exec vite build

dev:
	$(PNPM) exec vite

preview:
	$(PNPM) exec vite preview
