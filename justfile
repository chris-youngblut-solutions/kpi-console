# justfile — universal verbs.
# Language overlays redefine fmt/lint/test/build with concrete commands.
# Conventions: every verb runnable from a clean clone after `just bootstrap`.

set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load := true
set allow-duplicate-recipes := true

# Show all recipes when invoked with no arguments.
default:
    @just --list

# One-time setup after clone. Language overlays extend this.
bootstrap:
    @echo "[bootstrap] installing pre-commit hooks"
    @command -v pre-commit >/dev/null 2>&1 || { echo "pre-commit not installed; pipx install pre-commit"; exit 1; }
    pre-commit install --install-hooks
    pre-commit install --hook-type commit-msg

# Auto-format. Overridden by language overlay.
fmt:
    @echo "[fmt] no language overlay loaded — nothing to do"

# Lint. Overridden by language overlay.
lint:
    @echo "[lint] no language overlay loaded — nothing to do"

# Tests. Overridden by language overlay.
test:
    @echo "[test] no language overlay loaded — nothing to do"

# Build release artifact. Overridden by language overlay.
build:
    @echo "[build] no language overlay loaded — nothing to do"

# The merge gate. Whatever fails here blocks PRs.
check: fmt lint test
    @echo "[check] OK"

# Run all pre-commit hooks against the entire repo (not just staged files).
pre-commit-all:
    pre-commit run --all-files

# --- Release verbs ---
# `just release {patch|minor|major}` bumps the version, tags, and pushes.
# CI takes over from the tag push: builds, signs (cosign), generates SBOM
# (syft), and (T2 only) generates SLSA provenance. See
# `.github/workflows/release.yml` for the orchestration. That workflow is added
# at T2 promotion (/shipit tier2 layer) — at T1 the tag pushes but nothing builds.

release bump:
    @bash -euo pipefail -c '\
        bump="{{ bump }}"; \
        case "$bump" in patch|minor|major) ;; *) echo "usage: just release {patch|minor|major}"; exit 2;; esac; \
        if [[ -n "$(git status --porcelain)" ]]; then echo "tree dirty; commit/stash first"; exit 1; fi; \
        if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then echo "release only from main"; exit 1; fi; \
        last=$(git tag --list "v*" --sort=-v:refname | head -n1); \
        if [[ -z "$last" ]]; then last="v0.0.0"; fi; \
        IFS=. read -r maj min pat <<< "${last#v}"; \
        case "$bump" in \
            patch) pat=$((pat+1));; \
            minor) min=$((min+1)); pat=0;; \
            major) maj=$((maj+1)); min=0; pat=0;; \
        esac; \
        new="v${maj}.${min}.${pat}"; \
        echo "[release] tagging $new (was $last)"; \
        git tag -s -a "$new" -m "Release $new"; \
        git push origin "$new"; \
        echo "[release] pushed $new — CI will build, sign, and publish"; \
    '
# TypeScript justfile overlay (pnpm + Biome OR eslint+prettier).
# /new-project picks one tool branch by writing one of:
#   FMT_TOOL := biome
#   FMT_TOOL := eslint

FMT_TOOL := "biome"

# Install dependencies (frozen against pnpm-lock.yaml).
sync:
    pnpm install --frozen-lockfile

# Auto-format + auto-fix.
fmt:
    @if [[ "{{ FMT_TOOL }}" == "biome" ]]; then \
        pnpm exec biome check --write .; \
    else \
        pnpm exec prettier --write .; \
        pnpm exec eslint --fix .; \
    fi

# Lint only (no autofix).
lint:
    @if [[ "{{ FMT_TOOL }}" == "biome" ]]; then \
        pnpm exec biome check .; \
    else \
        pnpm exec eslint --max-warnings=0 .; \
        pnpm exec prettier --check .; \
    fi

# Type check.
typecheck:
    pnpm exec tsc --noEmit

# Tests (vitest).
test:
    pnpm exec vitest run

# Build production artifact (per framework — Next/SvelteKit/Astro override
# this in webframework/<choice>/justfile.overlay).
build:
    pnpm run build

# Update lockfile.
update:
    pnpm update --interactive --latest
