# Development container: the same toolchain `make verify` uses in CI (docs/workflow-guide.md §4.0.2).
# Node 24 LTS + pnpm (corepack), make, jq, gitleaks. Playwright browsers come from `make setup` so the
# browser build always matches the @playwright/test version in package.json.
FROM mcr.microsoft.com/devcontainers/typescript-node:5-24-bookworm@sha256:570427e760c3b6cc1ff6c50e0971103cc27abcfb5134066a39db639389150946

ARG GITLEAKS_VERSION=8.30.1
ARG GITLEAKS_SHA256_X64=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
ARG GITLEAKS_SHA256_ARM64=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends make jq \
  && rm -r /var/lib/apt/lists/*

RUN set -eu; \
  case "$(dpkg --print-architecture)" in \
    amd64) arch=x64; sum="$GITLEAKS_SHA256_X64" ;; \
    arm64) arch=arm64; sum="$GITLEAKS_SHA256_ARM64" ;; \
    *) echo "unsupported architecture" >&2; exit 1 ;; \
  esac; \
  curl -fsSL -o /tmp/gitleaks.tgz \
    "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${arch}.tar.gz"; \
  echo "${sum}  /tmp/gitleaks.tgz" | sha256sum -c -; \
  tar -xzf /tmp/gitleaks.tgz -C /usr/local/bin gitleaks; \
  rm /tmp/gitleaks.tgz; \
  gitleaks version

RUN corepack enable
