#!/usr/bin/env bash
# Local CI Pipeline — mirrors GitHub Actions workflows
# Usage:
#   ./scripts/local-ci.sh            — full quality gate (matches ci.yml)
#   ./scripts/local-ci.sh --pr       — PR gate only (matches pr-check.yml)
#   ./scripts/local-ci.sh --low-mem  — low-memory mode (TURBO_CONCURRENCY=1, heap cap, no build:release)
#   ./scripts/local-ci.sh --stage <name>  — run a single stage
#   ./scripts/local-ci.sh --list     — list available stages
#   ./scripts/local-ci.sh --help
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Colours ────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; DIM=''; RESET=''
fi

LOG_DIR="${REPO_ROOT}/.local-ci-logs"
mkdir -p "$LOG_DIR"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/${RUN_ID}.log"

# ── Helpers ─────────────────────────────────────────────────────────────────
_ts() { date '+%H:%M:%S'; }

_header() {
  echo ""
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════${RESET}"
  echo -e "${CYAN}${BOLD}  UWE Local CI — $1${RESET}"
  echo -e "${CYAN}${BOLD}  $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
  if [ "$LOW_MEM" = true ]; then
    echo -e "${YELLOW}${BOLD}  ⚠ low-mem: TURBO_CONCURRENCY=1 · heap ≤512 MB · no build:release${RESET}"
  fi
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════${RESET}"
}

_stage() {
  local name="$1"
  echo ""
  echo -e "${BOLD}▶ [$(_ts)] $name${RESET}" | tee -a "$LOG_FILE"
}

_ok() {
  echo -e "${GREEN}✔ [$(_ts)] $1${RESET}" | tee -a "$LOG_FILE"
}

_fail() {
  echo -e "${RED}✘ [$(_ts)] $1${RESET}" | tee -a "$LOG_FILE"
}

_skip() {
  echo -e "${DIM}⊘ [$(_ts)] $1 (skipped)${RESET}" | tee -a "$LOG_FILE"
}

_record_skip() {
  local label="$1"
  local reason="${2:-}"
  _skip "$label${reason:+ — $reason}"
  STAGE_RESULTS+=("${DIM}⊘${RESET} $label (skipped${reason:+: $reason})")
  STAGE_TIMES+=(0)
}

_info() {
  echo -e "${YELLOW}  $1${RESET}" | tee -a "$LOG_FILE"
}

STAGE_RESULTS=()
STAGE_TIMES=()
FAILED_STAGES=()

_run_stage() {
  local label="$1"
  shift
  local cmd="$*"

  _stage "$label"
  _info "$ $cmd"

  local t0
  t0="$(date +%s)"

  if eval "$cmd" >> "$LOG_FILE" 2>&1; then
    local t1
    t1="$(date +%s)"
    local elapsed=$((t1 - t0))
    _ok "$label passed (${elapsed}s)"
    STAGE_RESULTS+=("${GREEN}✔${RESET} $label (${elapsed}s)")
    STAGE_TIMES+=("$elapsed")
    return 0
  else
    local t1
    t1="$(date +%s)"
    local elapsed=$((t1 - t0))
    _fail "$label FAILED (${elapsed}s)"
    STAGE_RESULTS+=("${RED}✘${RESET} $label (${elapsed}s)")
    STAGE_TIMES+=("$elapsed")
    FAILED_STAGES+=("$label")
    _info "See log: $LOG_FILE"
    # Print last 30 lines of log for quick diagnosis
    echo ""
    echo -e "${DIM}── Last output ──────────────────────────────────────${RESET}"
    tail -30 "$LOG_FILE"
    echo -e "${DIM}────────────────────────────────────────────────────${RESET}"
    return 1
  fi
}

_summary() {
  local total_end
  total_end="$(date +%s)"
  local total=$((total_end - TOTAL_START))

  echo ""
  echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  CI Summary — ${total}s total${RESET}"
  echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
  for r in "${STAGE_RESULTS[@]}"; do
    echo -e "  $r"
  done
  echo ""
  if [ ${#FAILED_STAGES[@]} -eq 0 ]; then
    echo -e "${GREEN}${BOLD}  ALL STAGES PASSED${RESET}"
    echo -e "${DIM}  Log: $LOG_FILE${RESET}"
    echo ""
    return 0
  else
    echo -e "${RED}${BOLD}  FAILED: ${FAILED_STAGES[*]}${RESET}"
    echo -e "${DIM}  Log: $LOG_FILE${RESET}"
    echo ""
    return 1
  fi
}

# ── Stage definitions ────────────────────────────────────────────────────────
stage_install()    { _run_stage "install"       "pnpm install --frozen-lockfile"; }
stage_db_gen()     { _run_stage "db:generate"   "pnpm --filter @uwe/database db:generate"; }
stage_lockfile()   { _run_stage "lockfile-sync" "git diff --exit-code pnpm-lock.yaml"; }
stage_lint()       { _run_stage "lint"           "pnpm lint"; }
stage_secret()     { _run_stage "secret:scan"   "node scripts/secret-scan.mjs"; }
stage_typecheck()  { _run_stage "typecheck"     "pnpm typecheck"; }
stage_test_ci()    { _run_stage "test:ci"       "pnpm test:ci"; }
stage_test()       { _run_stage "test"          "pnpm test"; }
stage_test_sec()   { _run_stage "test:security" "pnpm test:security"; }
stage_audit()      { _run_stage "audit:prod"    "pnpm audit:prod"; }
stage_build()      { _run_stage "build:release" "pnpm build:release"; }
stage_docs()       { _run_stage "docs:check"    "node scripts/docs-check.mjs"; }
stage_e2e()        { _run_stage "test:e2e"      "pnpm test:e2e"; }
stage_e2e_perf()   { _run_stage "test:e2e:perf" "pnpm test:e2e:perf"; }
stage_shellcheck() {
  _run_stage "shellcheck" \
    "shellcheck -S warning deploy/scripts/setup-uwe-host.sh deploy/scripts/lib/uwe-host-constants.sh deploy/scripts/start-uwe.sh 2>/dev/null || true"
}

ALL_STAGES=(install db:generate lockfile-sync lint secret:scan typecheck test:ci test test:security audit:prod build:release docs:check)

_list_stages() {
  echo ""
  echo -e "${BOLD}Available stages:${RESET}"
  echo "  install        — pnpm install --frozen-lockfile"
  echo "  db:generate    — Prisma client generation"
  echo "  lockfile-sync  — verify pnpm-lock.yaml is committed"
  echo "  lint           — ESLint (zero warnings)"
  echo "  secret:scan    — repository secret scan"
  echo "  typecheck      — TypeScript across all packages"
  echo "  test:ci        — unit + integration subset (PR gate)"
  echo "  test           — full unit + integration tests"
  echo "  test:security  — authz, leaks, route guards"
  echo "  audit:prod     — pnpm audit --prod --audit-level high"
  echo "  build:release  — production build (studio + portal)"
  echo "  docs:check     — required docs + markdown scan"
  echo "  e2e            — Playwright E2E (needs running server)"
  echo "  e2e:perf       — runtime budget measurements"
  echo ""
  echo -e "${BOLD}Modes:${RESET}"
  echo "  (default)   Full quality gate — matches ci.yml on main"
  echo "  --pr        PR gate only — matches pr-check.yml"
  echo "  --low-mem   Combine with --pr or --full: sets TURBO_CONCURRENCY=1,"
  echo "              caps Node.js heap to 512 MB, skips build:release"
  echo ""
}

# ── Pipeline modes ───────────────────────────────────────────────────────────
run_pr_gate() {
  _header "PR Gate (ci:light)"
  TOTAL_START="$(date +%s)"
  stage_install
  stage_db_gen
  stage_lockfile
  stage_lint
  stage_secret
  stage_typecheck
  stage_test_ci
  stage_docs
  _summary
}

run_full_gate() {
  _header "Full Quality Gate"
  TOTAL_START="$(date +%s)"
  stage_install
  stage_db_gen
  stage_lint
  stage_secret
  stage_typecheck
  stage_test
  stage_test_sec
  stage_audit
  if [ "$LOW_MEM" = true ]; then
    _record_skip "build:release" "use GitHub Actions on low-memory machines"
  else
    stage_build
  fi
  _summary
}

run_single_stage() {
  local name="$1"
  TOTAL_START="$(date +%s)"
  case "$name" in
    install)       stage_install ;;
    db:generate)   stage_db_gen ;;
    lockfile-sync) stage_lockfile ;;
    lint)          stage_lint ;;
    secret:scan)   stage_secret ;;
    typecheck)     stage_typecheck ;;
    test:ci)       stage_test_ci ;;
    test)          stage_test ;;
    test:security) stage_test_sec ;;
    audit:prod)    stage_audit ;;
    build:release) stage_build ;;
    docs:check)    stage_docs ;;
    e2e)           stage_e2e ;;
    e2e:perf)      stage_e2e_perf ;;
    shellcheck)    stage_shellcheck ;;
    *)
      echo -e "${RED}Unknown stage: $name${RESET}"
      _list_stages
      exit 1
      ;;
  esac
  _summary
}

# ── Argument parsing ─────────────────────────────────────────────────────────
MODE="full"
SINGLE_STAGE=""
LOW_MEM=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)       MODE="pr" ;;
    --full)     MODE="full" ;;
    --low-mem)  LOW_MEM=true ;;
    --stage)    MODE="single"; SINGLE_STAGE="${2:-}"; shift ;;
    --list)     _list_stages; exit 0 ;;
    --help|-h)
      echo "Usage: ./scripts/local-ci.sh [--pr] [--full] [--low-mem] [--stage <name>] [--list]"
      echo ""
      _list_stages
      exit 0
      ;;
    *) echo -e "${RED}Unknown option: $1${RESET}"; exit 1 ;;
  esac
  shift
done

if [ "$LOW_MEM" = true ]; then
  export TURBO_CONCURRENCY=1
  export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=512"
fi

# ── Main ─────────────────────────────────────────────────────────────────────
echo "" | tee "$LOG_FILE"
echo "UWE Local CI — run $RUN_ID" >> "$LOG_FILE"
echo "Mode: $MODE${SINGLE_STAGE:+ ($SINGLE_STAGE)}" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

case "$MODE" in
  pr)     run_pr_gate ;;
  full)   run_full_gate ;;
  single) run_single_stage "$SINGLE_STAGE" ;;
esac
