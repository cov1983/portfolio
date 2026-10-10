# Single entry points for humans, agents and CI (docs/workflow-guide.md §4.0.2). CI calls these
# targets, so a green `make verify` locally means a green `lint` and `test` job.

.DEFAULT_GOAL := help
.PHONY: help setup browsers format format-check lint typecheck shellcheck test-shell test coverage-ratchet test-e2e perf verify build dev preview

PNPM ?= pnpm
# Headed Firefox (playwright.config.ts) needs a display: a virtual one where xvfb-run exists.
XVFB_RUN := $(shell command -v xvfb-run >/dev/null 2>&1 && echo 'xvfb-run -a')
# Every shell script in the repo: hooks, their test runner, the pre-commit hook, the gates and their tests.
SHELL_FILES := .claude/hooks/*.sh .claude/hooks/tests/run.sh .githooks/pre-commit scripts/*.sh

help:
	@echo "Targets:"
	@echo "  make setup         install dependencies, point git at .githooks, then make browsers"
	@echo "  make browsers      Playwright browsers with their OS packages (sudo on a host); CI runs this too"
	@echo "  make verify        format check + lint + typecheck + shellcheck + shell tests + unit and model tests; must pass before any commit"
	@echo "  make format        rewrite files with Prettier"
	@echo "  make format-check  fail on unformatted files"
	@echo "  make lint          ESLint, warnings are errors"
	@echo "  make typecheck     tsc --noEmit for src and for the config files"
	@echo "  make shellcheck    shellcheck over every shell script (hooks, pre-commit, gates); needs the shellcheck binary"
	@echo "  make test-shell    hook smoke tests (.claude/hooks/tests) and the spec-freeze gate test"
	@echo "  make test          Vitest projects unit and model, with coverage against the thresholds in vitest.config.ts"
	@echo "  make coverage-ratchet  make test with COVERAGE_RATCHET=1: raises the thresholds to the measured coverage"
	@echo "  make test-e2e      build, then Playwright in Chromium, Firefox and WebKit against dist/"
	@echo "  make perf          build, then the Lighthouse performance budget (perf/budget.json) against dist/"
	@echo "  make build         production build to dist/"
	@echo "  make dev           Vite dev server on every interface, so VS Code port forwarding reaches it"
	@echo "  make preview       serve dist/ as production would"

setup:
	$(PNPM) install --frozen-lockfile
	git config core.hooksPath .githooks
	$(MAKE) browsers

browsers:
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

# Fails loudly without the binary: a silent skip would make a green verify mean less than a green lint job.
shellcheck:
	@command -v shellcheck >/dev/null 2>&1 || { echo "shellcheck is not installed: install it or run make through the devcontainer (.devcontainer/)" >&2; exit 1; }
	shellcheck $(SHELL_FILES)

test-shell:
	.claude/hooks/tests/run.sh
	scripts/spec-freeze.test.sh

test:
	$(PNPM) exec vitest run --coverage

coverage-ratchet:
	COVERAGE_RATCHET=1 $(MAKE) test

test-e2e: build
	$(XVFB_RUN) $(PNPM) exec playwright test

# Needs a Chrome or Chromium: set CHROME_PATH where none is installed system-wide, and CHROME_NO_SANDBOX=1
# inside a container (scripts/perf-budget.ts).
perf: build
	node scripts/perf-budget.ts

verify: format-check lint typecheck shellcheck test-shell test

build:
	$(PNPM) exec vite build

# --host: Vite alone binds ::1 only and VS Code port forwarding dials 127.0.0.1, so the forwarded port is dead.
dev:
	$(PNPM) exec vite --host

preview:
	$(PNPM) exec vite preview
