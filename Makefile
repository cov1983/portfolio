# Single entry points for humans, agents and CI (docs/workflow-guide.md §4.0.2). CI calls these
# targets, so a green `make verify` locally means a green `lint` and `test` job.

.DEFAULT_GOAL := help
.PHONY: help setup browsers format format-check lint typecheck agent-docs shellcheck test-shell test coverage-ratchet test-e2e perf verify build dev preview ice-texture invite

PNPM ?= pnpm
# Headed Firefox (playwright.config.ts) needs a display: a virtual one where xvfb-run exists.
XVFB_RUN := $(shell command -v xvfb-run >/dev/null 2>&1 && echo 'xvfb-run -a')
# Every shell script in the repo: hooks, their test runner and its --prove stubs, the pre-commit
# hook, the gates and their tests.
SHELL_FILES := .claude/hooks/*.sh .claude/hooks/tests/run.sh .claude/hooks/tests/prove/*.sh .githooks/pre-commit scripts/*.sh

help:
	@echo "Targets:"
	@echo "  make setup         install dependencies, point git at .githooks, then make browsers"
	@echo "  make browsers      Playwright browsers with their OS packages (sudo on a host); CI runs this too"
	@echo "  make verify        format check + lint + typecheck + agent docs + shellcheck + shell tests + unit, model and build tests; must pass before any commit"
	@echo "  make format        rewrite files with Prettier"
	@echo "  make format-check  fail on unformatted files"
	@echo "  make lint          ESLint, warnings are errors"
	@echo "  make typecheck     tsc --noEmit for src (browser), src/intake/server (Node, no DOM) and the config files"
	@echo "  make agent-docs    CLAUDE.md and AGENTS.md identical and at most 150 lines, as CI's lint job checks"
	@echo "  make shellcheck    shellcheck over every shell script (hooks, pre-commit, gates); needs the shellcheck binary"
	@echo "  make test-shell    hook smoke tests (.claude/hooks/tests) and the spec-freeze gate test"
	@echo "  make test          Vitest projects unit, model and build, with coverage against the thresholds in vitest.config.ts"
	@echo "  make coverage-ratchet  make test with COVERAGE_RATCHET=1: raises the thresholds to the measured coverage"
	@echo "  make test-e2e      build, then Playwright in Chromium, Firefox and WebKit against dist/"
	@echo "  make perf          build, then the Lighthouse performance budget (perf/budget.json) against dist/"
	@echo "  make build         production build to dist/ (node build/build.ts: client build, SSR build, the two pre-rendered documents)"
	@echo "  make dev           Vite dev server on every interface, so VS Code port forwarding reaches it"
	@echo "  make preview       serve dist/ as production would"
	@echo "  make ice-texture   src/world/scene/ice.webp from the local photo crop (assets/ice/SOURCE.md)"
	@echo "  make invite        the Owner's host only: prompts for a Client's name and e-mail, prints an Invite link; DAYS=, ORIGIN= (docs/runbooks/invite.md)"

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
	$(PNPM) exec tsc --noEmit -p tsconfig.server.json

# The same commands as the lint job's step in .github/workflows/ci.yml: AGENTS.md is a byte-for-byte
# copy of CLAUDE.md, and CLAUDE.md stays within 150 lines (T6 #53: verify had passed a 151-line file).
agent-docs:
	cmp CLAUDE.md AGENTS.md
	@lines=$$(wc -l < CLAUDE.md); \
	if [ "$$lines" -gt 150 ]; then echo "CLAUDE.md has $$lines lines; the limit is 150"; exit 1; fi

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

verify: format-check lint typecheck agent-docs shellcheck test-shell test

# ADR 0010: the client build, the SSR build and both pre-rendered documents; vercel.json runs the same.
build:
	node build/build.ts

# --host: Vite alone binds ::1 only and VS Code port forwarding dials 127.0.0.1, so the forwarded port is dead.
dev:
	$(PNPM) exec vite --host

preview:
	$(PNPM) exec vite preview

# The World's ice texture from the Owner's local crop, which is not committed (assets/ice/SOURCE.md).
ice-texture:
	node scripts/ice-texture.ts

# The Owner's command (ADR 0019, docs/runbooks/invite.md): INVITE_SECRET from the environment, the name and
# e-mail from prompts (never arguments, never shell history), DAYS= and ORIGIN= from the command line, which make
# passes to the recipe's environment. The agent never runs it with a real secret. scripts/invite.ts needs Node 24's
# type stripping: an older or missing node cannot even load it, so the check is plain JavaScript and reads only an
# exit status. Every line it prints is a constant: no version found, no DAYS or ORIGIN value, and the devcontainer
# command passes the secret by name (-e INVITE_SECRET), never by value.
invite:
	@node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' >/dev/null 2>&1 || { \
	  echo 'make invite needs Node 24 (.nvmrc), which this host does not run. No link was printed.' >&2; \
	  echo 'Run it in the devcontainer image instead, from the repository root, adding the same DAYS= and ORIGIN=:' >&2; \
	  echo '  docker build -t portfolio-dev .devcontainer' >&2; \
	  echo '  docker run --rm -it --network none -e INVITE_SECRET -v "$$PWD:/repo:ro" -w /repo portfolio-dev make invite' >&2; \
	  exit 1; \
	}
	@node scripts/invite.ts
