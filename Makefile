# Single entry points for humans, agents and CI. All targets are stubs until the stack is
# chosen in Phase 1 and wired in Phase 0b (docs/workflow-guide.md §4.0.2).

.DEFAULT_GOAL := help
.PHONY: help setup verify test build dev prototype

NOT_CONFIGURED = echo "✗ make $@: not configured — stack not chosen yet (see docs/workflow-guide.md §4.0.2 Phase 0b)" >&2; exit 1

help:
	@echo "Targets (all stubs until Phase 0b):"
	@echo "  make setup    install toolchain and dependencies"
	@echo "  make verify   lint + typecheck + unit tests; must pass before any commit"
	@echo "  make test     full test suite"
	@echo "  make build    production build"
	@echo "  make dev      local dev server"
	@echo "  make prototype  run the throwaway Puck-feel prototype (prototype/puck-feel, branch-only)"

setup:
	@$(NOT_CONFIGURED)

verify:
	@$(NOT_CONFIGURED)

test:
	@$(NOT_CONFIGURED)

build:
	@$(NOT_CONFIGURED)

dev:
	@$(NOT_CONFIGURED)

# Throwaway: answers "which ice-friction preset?" (ADR 0003 → ADR 0005). Deleted with the branch.
prototype:
	pnpm --dir prototype/puck-feel install
	pnpm --dir prototype/puck-feel dev
