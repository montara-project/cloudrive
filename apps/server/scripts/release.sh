#!/usr/bin/env bash
#
# release.sh — release apps/server using semantic versioning.
#
# The script determines the next version (vMAJOR.MINOR.PATCH) from
# conventional commits, writes it to apps/server/VERSION, creates the release
# commit `chore: release version vX.Y.Z`, tags that commit (vX.Y.Z), and
# pushes both. The pushed tag triggers .github/workflows/server-release.yaml,
# which builds the API image from apps/server/deploy/Dockerfile and pushes it
# to ghcr.io/<owner>/<repo>/api.
#
# Usage:
#   bash scripts/release.sh [options]
#
# Options:
#   --dry-run            Preview the next version; nothing is written, committed or pushed
#   --type=TYPE          Force the bump: major | minor | patch
#                        (default: auto-detected from conventional commits)
#   --no-push            Create the commit and tag locally but skip git push
#   -h, --help           Show this help
#
# Via make (from apps/server):
#   make release                     # auto bump + release commit + tag + push
#   make release ARGS="--dry-run"    # preview
#   make release ARGS="--type=minor --no-push"
#
# Bump rules (conventional commits since the previous v* tag):
#   feat!:/fix!:/BREAKING CHANGE: -> major
#   feat:                         -> minor
#   everything else               -> patch

set -euo pipefail

TAG_GLOB="v*"
VERSION_FILE_REL="apps/server/VERSION"
REMOTE="${RELEASE_REMOTE:-origin}"

# --- output helpers ------------------------------------------------------

if [[ -t 1 ]]; then
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_CYAN=$'\033[36m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
  C_RED=""; C_GREEN=""; C_CYAN=""; C_DIM=""; C_OFF=""
fi

info() { printf '%s\n' "${C_CYAN}${*}${C_OFF}"; }
ok()   { printf '%s\n' "${C_GREEN}${*}${C_OFF}"; }
dim()  { printf '%s\n' "${C_DIM}${*}${C_OFF}"; }
die()  { printf '%s\n' "${C_RED}error: ${*}${C_OFF}" >&2; exit 1; }

usage() { sed -n 's/^# \?//p' "$0" | head -n 30; }

# --- parse arguments -----------------------------------------------------

DRY_RUN=false
PUSH=true
BUMP_TYPE=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --no-push) PUSH=false ;;
    --type=*)  BUMP_TYPE="${arg#--type=}" ;;
    -h|--help) usage; exit 0 ;;
    *)         usage >&2; die "unknown option: $arg" ;;
  esac
done

if [[ -n "$BUMP_TYPE" && ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
  die "--type must be major, minor, or patch"
fi

# --- repository sanity ---------------------------------------------------

git rev-parse --is-inside-work-tree > /dev/null 2>&1 \
  || die "not inside a git repository"

VERSION_FILE="$(git rev-parse --show-toplevel)/${VERSION_FILE_REL}"

# Untracked files do not change the tagged commit, so only staged/unstaged
# changes to tracked files block a release.
if [[ "$DRY_RUN" == false && -n "$(git status --porcelain --untracked-files=no)" ]]; then
  git status --short --untracked-files=no >&2
  die "working tree is dirty; commit or stash before releasing"
fi

# --- resolve current version ---------------------------------------------

# git's version sort avoids depending on GNU sort -V (macOS/Alpine differ).
LATEST_TAG="$(git for-each-ref --sort=-v:refname --format='%(refname:short)' "refs/tags/${TAG_GLOB}" | head -n 1 || true)"

if [[ -z "$LATEST_TAG" ]]; then
  CURRENT="0.0.0"
  # Without a previous tag the bump reads the entire history.
  RANGE_ARGS=()
  info "no previous v* tag found — starting at 0.0.0"
else
  CURRENT="${LATEST_TAG#v}"
  RANGE_ARGS=("${LATEST_TAG}..HEAD")
fi

if [[ ! "$CURRENT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  die "cannot parse current version from tag '$LATEST_TAG'"
fi

MAJOR="${CURRENT%%.*}"
MINOR="${CURRENT#*.}"; MINOR="${MINOR%%.*}"
PATCH="${CURRENT##*.}"

# --- detect the bump from conventional commits ---------------------------

# ${arr[@]+"${arr[@]}"} expands to nothing when the array is empty without
# tripping `set -u` on bash 3.2 (the macOS default).
COMMITS="$(git log --format='%s%n%b' ${RANGE_ARGS[@]+"${RANGE_ARGS[@]}"} || true)"

# Auto mode has nothing to release without new commits; an explicit --type is
# a deliberate re-release and skips this guard.
if [[ -z "$BUMP_TYPE" && -z "$(git log --oneline ${RANGE_ARGS[@]+"${RANGE_ARGS[@]}"} 2> /dev/null)" ]]; then
  die "no commits to release since ${LATEST_TAG:-the beginning of history}"
fi

if [[ -z "$BUMP_TYPE" ]]; then
  BUMP_TYPE="patch"
  if grep -qiE '^([a-z]+)(\([^)]*\))?!:|^[[:space:]]*BREAKING[ -]CHANGE[:(]' <<< "$COMMITS"; then
    BUMP_TYPE="major"
  elif grep -qiE '^feat(\([^)]*\))?:' <<< "$COMMITS"; then
    BUMP_TYPE="minor"
  fi
fi

case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

VERSION="${MAJOR}.${MINOR}.${PATCH}"
NEW_TAG="v${VERSION}"
RELEASE_MESSAGE="chore: release version ${NEW_TAG}"

# --- release plan --------------------------------------------------------

info "current version : ${LATEST_TAG:-<none>} (${CURRENT})"
info "bump            : ${BUMP_TYPE}"
if [[ -f "$VERSION_FILE" ]]; then
  info "version file    : ${VERSION_FILE_REL} ($(cat "$VERSION_FILE" 2> /dev/null || true)) -> ${VERSION}"
else
  info "version file    : ${VERSION_FILE_REL} (new) -> ${VERSION}"
fi
info "release commit  : ${RELEASE_MESSAGE}"
info "tag             : ${NEW_TAG}"

if [[ "$DRY_RUN" == true ]]; then
  dim "dry run — no file change, no commit, no tag, nothing pushed"
  exit 0
fi

# Releasing moves the current branch; refuse from a detached HEAD.
git symbolic-ref -q HEAD > /dev/null 2>&1 \
  || die "detached HEAD — checkout a branch before releasing"

# --- write version file, commit, tag -------------------------------------

printf '%s\n' "$VERSION" > "$VERSION_FILE"
git add "$VERSION_FILE"
git commit -m "$RELEASE_MESSAGE" > /dev/null
ok "commit created: ${RELEASE_MESSAGE}"

git tag -a "$NEW_TAG" -m "release ${NEW_TAG}"
ok "tag created: ${NEW_TAG}"

# Best effort: report the image the CI workflow will produce.
REPO_SLUG=""
REMOTE_URL="$(git remote get-url "$REMOTE" 2> /dev/null || true)"
case "$REMOTE_URL" in
  git@github.com:*)       REPO_SLUG="${REMOTE_URL#git@github.com:}" ;;
  ssh://git@github.com/*) REPO_SLUG="${REMOTE_URL#ssh://git@github.com/}" ;;
  https://github.com/*)   REPO_SLUG="${REMOTE_URL#https://github.com/}" ;;
esac
REPO_SLUG="${REPO_SLUG%.git}"
# tr instead of ${var,,}: lowercase expansion needs bash 4+, macOS ships 3.2.
REPO_SLUG="$(printf '%s' "$REPO_SLUG" | tr '[:upper:]' '[:lower:]')"

if [[ -n "$REPO_SLUG" ]]; then
  dim "CI will build and push ghcr.io/${REPO_SLUG}/api:release-${NEW_TAG} (+ :latest)"
fi

# --- push ----------------------------------------------------------------

if [[ "$PUSH" == true ]]; then
  git push "$REMOTE" HEAD
  git push "$REMOTE" "$NEW_TAG"
  ok "release commit and tag pushed to $REMOTE — the GHCR workflow is triggered"
else
  dim "kept local (--no-push); push with: git push $REMOTE HEAD && git push $REMOTE $NEW_TAG"
fi
