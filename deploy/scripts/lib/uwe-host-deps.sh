#!/usr/bin/env bash
# Dependency installation and repair for UWE Linux host setup.
# shellcheck shell=bash

UWE_PACKAGE_UPDATE_LOG="/tmp/uwe-package-update.log"
UWE_NODE_INSTALL_LOG="/tmp/uwe-node-install.log"

remove_stale_nodesource_artifacts() {
  rm -f /etc/apt/sources.list.d/nodesource.list
  rm -f /etc/apt/sources.list.d/nodesource.list.save
  rm -f /etc/apt/sources.list.d/nodesource.sources
  rm -f /etc/apt/keyrings/nodesource.gpg
  rm -f /usr/share/keyrings/nodesource.gpg
}

remove_stale_node_binaries() {
  log "Entferne alte Node/npm/pnpm/corepack-Binaries …"
  local bin
  for bin in node npm npx pnpm corepack yarn yarnpkg; do
    remove_path_if_present "/usr/local/bin/$bin"
  done

  remove_path_if_present "/usr/local/lib/node_modules/pnpm"
  remove_path_if_present "/usr/local/lib/node_modules/corepack"
  remove_path_if_present "/usr/local/lib/node_modules/npm"
  remove_path_if_present "/opt/pnpm"

  hash -r || true
}

remove_node_caches_and_workspace_modules() {
  log "Entferne Build-Caches und Workspace-node_modules …"

  remove_path_if_present "$UWE_HOME/node_modules"
  remove_path_if_present "$UWE_HOME/.pnpm-store"
  remove_path_if_present "$UWE_HOME/.turbo"
  remove_path_if_present "$UWE_HOME/.next"
  remove_path_if_present "$UWE_HOME/.cache/standalone-prisma-deps"

  find "$UWE_HOME" \
    -path '*/.git/*' -prune -o \
    -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true

  remove_path_if_present "/root/.local/share/pnpm"
  remove_path_if_present "/root/.cache/node/corepack"
  remove_path_if_present "/root/.npm"
  remove_path_if_present "$UWE_HOME/.local/share/pnpm"
  remove_path_if_present "$UWE_HOME/.cache/node/corepack"
  remove_path_if_present "$UWE_HOME/.npm"

  if [[ -d /home ]]; then
    find /home -mindepth 2 -maxdepth 4 \
      \( -path '*/.local/share/pnpm' -o -path '*/.cache/node/corepack' -o -path '*/.npm' \) \
      -prune -exec rm -rf {} + 2>/dev/null || true
  fi
}

diagnose_node_install_failure() {
  local reason="${1:-Node.js installation failed}"
  echo ""
  echo "========================================"
  echo " Node.js Installation Diagnosis"
  echo "========================================"
  fail "$reason"
  echo ""
  echo "--- /etc/os-release ---"
  cat /etc/os-release 2>/dev/null || true
  echo ""
  echo "--- Architektur ---"
  host_architecture || true
  echo ""
  if [[ "$UWE_PACKAGE_FAMILY" == "apt" ]]; then
    echo "--- apt-cache policy nodejs ---"
    apt-cache policy nodejs 2>/dev/null || true
    echo ""
    echo "--- /etc/apt/sources.list.d/ ---"
    ls -la /etc/apt/sources.list.d/ 2>/dev/null || true
    echo ""
    if [[ -f /etc/apt/sources.list.d/nodesource.sources ]]; then
      echo "--- nodesource.sources ---"
      cat /etc/apt/sources.list.d/nodesource.sources 2>/dev/null || true
      echo ""
    fi
  else
    echo "--- DNF Node.js Pakete ---"
    dnf list --installed 'nodejs*' 2>/dev/null || true
    dnf info nodejs22 nodejs22-bin nodejs22-npm-bin 2>/dev/null || true
    echo ""
  fi
  echo "--- Paketmanager (letzte Zeilen) ---"
  tail -n 30 "$UWE_PACKAGE_UPDATE_LOG" 2>/dev/null || true
  echo ""
  echo "--- Paketquelle Erreichbarkeit ---"
  if [[ "$UWE_PACKAGE_FAMILY" == "apt" ]]; then
    curl -fsSI --max-time 15 "https://deb.nodesource.com/node_${NODE_MAJOR}.x/dists/nodistro/InRelease" 2>&1 || true
    curl -fsSI --max-time 15 "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" 2>&1 || true
  else
    getent hosts "$(host_dependency_dns_name)" 2>&1 || true
  fi
  echo ""
  echo "--- Empfehlung ---"
  echo "  1. Internet/DNS prüfen (github.com, $(host_dependency_dns_name), registry.npmjs.org)"
  echo "  2. $(host_package_manager_name) manuell testen"
  echo "  3. Erneut ausführen: sudo bash $UWE_HOME/deploy/scripts/setup-uwe-host.sh --repair"
  echo "  4. Unterstützte Plattform verwenden: Debian/Ubuntu oder Fedora auf x86_64/aarch64"
  echo "========================================"
  echo ""

  if declare -F uwe_ai_diagnostics_offer >/dev/null 2>&1; then
    uwe_ai_diagnostics_offer "node_install" "$reason"
  fi

  exit 1
}

install_node_from_nodesource() {
  local nodesource_gpg="/etc/apt/keyrings/nodesource.gpg"
  local nodesource_repo="/etc/apt/sources.list.d/nodesource.sources"
  local gpg_url="https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key"
  local repo_url="https://deb.nodesource.com/node_${NODE_MAJOR}.x"

  export DEBIAN_FRONTEND=noninteractive

  log "Installiere Node.js ${NODE_MAJOR}.x über NodeSource (systemweit, /usr/bin/node) …"

  remove_stale_nodesource_artifacts
  mkdir -p /etc/apt/keyrings

  if ! curl -fsSL --max-time 30 "$gpg_url" | gpg --dearmor -o "$nodesource_gpg" 2>"$UWE_NODE_INSTALL_LOG"; then
    diagnose_node_install_failure "NodeSource GPG-Key konnte nicht geladen werden"
  fi

  cat >"$nodesource_repo" <<EOF
Types: deb
URIs: ${repo_url}
Suites: nodistro
Components: main
Signed-By: ${nodesource_gpg}
EOF

  if ! apt-get update 2>&1 | tee "$UWE_PACKAGE_UPDATE_LOG"; then
    diagnose_node_install_failure "apt-get update nach NodeSource-Repo fehlgeschlagen"
  fi

  if ! apt-get install -y nodejs 2>&1 | tee -a "$UWE_NODE_INSTALL_LOG"; then
    diagnose_node_install_failure "apt-get install nodejs fehlgeschlagen"
  fi

  hash -r || true
  validate_node_installation
}

install_node_from_fedora() {
  log "Installiere Node.js ${NODE_MAJOR}.x aus den Fedora-Paketen …"

  if ! dnf install -y --allowerasing \
    nodejs22 nodejs22-npm nodejs22-bin nodejs22-npm-bin \
    2>&1 | tee "$UWE_NODE_INSTALL_LOG"; then
    diagnose_node_install_failure "Fedora-Pakete für Node.js ${NODE_MAJOR}.x konnten nicht installiert werden"
  fi

  hash -r || true
  validate_node_installation
}

validate_node_installation() {
  export_system_path
  local node_bin npm_bin major

  node_bin="$(find_node_binary)"
  if [[ -z "$node_bin" ]]; then
    diagnose_node_install_failure "Node.js nach Installation nicht im PATH"
  fi

  if [[ ! -x "/usr/bin/node" ]]; then
    diagnose_node_install_failure "Node.js installiert, aber /usr/bin/node fehlt"
  fi

  major="$("$node_bin" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
  if [[ "$major" != "$NODE_MAJOR" ]]; then
    echo "Gefundene node-Binaries:" >&2
    type -a node >&2 || true
    diagnose_node_install_failure "Falsche Node.js-Version: $("$node_bin" --version). Erwartet: v${NODE_MAJOR}.x"
  fi

  npm_bin="$(command -v npm || true)"
  if [[ -z "$npm_bin" ]]; then
    diagnose_node_install_failure "npm fehlt nach Node.js-Installation"
  fi

  ok "Node.js: $("$node_bin" --version) ($node_bin)"
  ok "npm: $(npm --version) ($npm_bin)"
}

node_needs_install_or_repair() {
  export_system_path
  local node_bin
  node_bin="$(find_node_binary)"
  ! node_version_ok "$node_bin"
}

ensure_nodejs() {
  local force="${1:-0}"

  if [[ "$force" -eq 0 ]] && ! node_needs_install_or_repair; then
    validate_node_installation
    return 0
  fi

  ensure_base_system_packages

  if command -v systemctl >/dev/null 2>&1; then
    systemctl stop "$SYSTEMD_UNIT" >/dev/null 2>&1 || true
    systemctl stop "$LEGACY_SYSTEMD_UNIT" >/dev/null 2>&1 || true
  fi

  if [[ "$force" -eq 1 ]]; then
    remove_managed_node_packages
    remove_stale_node_binaries
  fi

  case "$UWE_PACKAGE_FAMILY" in
    apt) install_node_from_nodesource ;;
    dnf) install_node_from_fedora ;;
    *) die "Node.js-Installation für ${UWE_OS_PRETTY_NAME} wird nicht unterstützt." ;;
  esac
}

ensure_pnpm() {
  local force="${1:-0}"
  local required version pnpm_bin

  export_system_path
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  required="$(get_required_pnpm_version)"

  if [[ "$force" -eq 0 ]]; then
    pnpm_bin="$(find_pnpm_binary)"
    if [[ -n "$pnpm_bin" ]]; then
      version="$("$pnpm_bin" --version 2>/dev/null || true)"
      if [[ "$version" == "$required" ]]; then
        ok "pnpm: $version ($pnpm_bin)"
        return 0
      fi
    fi
  fi

  log "Richte pnpm ${required} ein …"

  if ! command -v corepack >/dev/null 2>&1; then
    log "Corepack fehlt — installiere global über npm …"
    npm install -g corepack
    hash -r || true
  fi

  if command -v corepack >/dev/null 2>&1; then
    log "corepack enable + prepare pnpm@${required} …"
    corepack enable || true
    corepack prepare "pnpm@${required}" --activate || true
    hash -r || true
  fi

  pnpm_bin="$(find_pnpm_binary)"
  if [[ -z "$pnpm_bin" ]]; then
    log "Corepack fehlgeschlagen — installiere pnpm global über npm …"
    npm install -g "pnpm@${required}"
    hash -r || true
  fi

  pnpm_bin="$(find_pnpm_binary)"
  if [[ -z "$pnpm_bin" ]]; then
    die "pnpm ${required} konnte nicht installiert werden."
  fi

  version="$("$pnpm_bin" --version 2>/dev/null || true)"
  if [[ "$version" != "$required" ]]; then
    warn "pnpm-Version ${version} weicht ab (erwartet ${required}) — versuche erneute Aktivierung"
    corepack prepare "pnpm@${required}" --activate 2>/dev/null || npm install -g "pnpm@${required}"
    hash -r || true
    version="$("$pnpm_bin" --version 2>/dev/null || true)"
  fi

  ok "pnpm: $version ($pnpm_bin)"
}

ensure_system_dependencies() {
  local force_node="${1:-0}"
  local force_pnpm="${2:-0}"

  ensure_base_system_packages
  ensure_nodejs "$force_node"
  ensure_pnpm "$force_pnpm"
}

reset_system_dependencies() {
  log "Gründlicher Dependency-Repair: Node.js ${NODE_MAJOR}.x + pnpm …"
  ensure_system_dependencies 1 1
}

validate_node_binary() {
  export_system_path
  local node_bin pnpm_bin
  node_bin="$(find_node_binary)"

  if [[ -z "$node_bin" || ! -x "$node_bin" ]]; then
    die "Node.js nicht gefunden. Ausführen: sudo bash $UWE_HOME/deploy/scripts/setup-uwe-host.sh --repair"
  fi

  pnpm_bin="$(find_pnpm_binary)"
  if [[ -z "$pnpm_bin" || ! -x "$pnpm_bin" ]]; then
    die "pnpm nicht gefunden. Ausführen: sudo bash $UWE_HOME/deploy/scripts/setup-uwe-host.sh --repair"
  fi

  ok "Node.js: $("$node_bin" --version) ($node_bin)"
  ok "pnpm: $("$pnpm_bin" --version) ($pnpm_bin)"

  if [[ ! -x "/usr/bin/node" ]]; then
    warn "Node.js liegt nicht unter /usr/bin/node — systemd PATH kann Probleme verursachen. --repair ausführen."
  fi
}

needs_pnpm_install() {
  if [[ ! -d "$UWE_HOME/node_modules" ]]; then
    return 0
  fi

  if [[ ! -f "$UWE_HOME/node_modules/.modules.yaml" ]]; then
    return 0
  fi

  if [[ -f "$UWE_HOME/pnpm-lock.yaml" && "$UWE_HOME/pnpm-lock.yaml" -nt "$UWE_HOME/node_modules/.modules.yaml" ]]; then
    return 0
  fi

  if [[ -f "$UWE_HOME/package.json" && "$UWE_HOME/package.json" -nt "$UWE_HOME/node_modules/.modules.yaml" ]]; then
    return 0
  fi

  return 1
}

install_dependencies() {
  local quick="${1:-0}"

  if [[ "$quick" -eq 1 ]] && ! needs_pnpm_install; then
    log "pnpm install übersprungen (Lockfile unverändert, node_modules vorhanden)."
    return 0
  fi

  log "Installiere npm-Abhängigkeiten (pnpm install) …"
  run_as_uwe "corepack prepare 'pnpm@$(get_required_pnpm_version)' --activate >/dev/null 2>&1 || true; pnpm install --frozen-lockfile --prod=false"
}

run_prisma_generate() {
  log "Generiere Prisma Client (pnpm --filter $DATABASE_WORKSPACE_FILTER db:generate) …"
  run_as_uwe "pnpm --filter '$DATABASE_WORKSPACE_FILTER' db:generate"
}

migration_status_output() {
  run_as_uwe "pnpm --filter '$DATABASE_WORKSPACE_FILTER' exec prisma migrate status 2>&1" || true
}

migration_status_has_pending() {
  local output="$1"
  echo "$output" | grep -qE '(Following migration[s]? have not yet been applied|Database schema is not up to date|not yet been applied)'
}

# Migration names Prisma names as failed in a P3009 `migrate deploy` error, e.g.
#   The `20260703102143_briefing_job_type` migration started at ... failed
# Only backtick-quoted timestamped names appear in that error, so it is safe to
# pull every one of them.
deploy_failed_migration_names() {
  local output="$1"
  echo "$output" | grep -oE '`[0-9]{14}_[A-Za-z0-9_]+`' | tr -d '`' | sort -u
}

# Apply migrations, self-healing a blocking failed migration.
#
# A migration aborted mid-apply (e.g. on a host whose squashed baseline diverged
# from the granular migration chain) leaves a failed row in _prisma_migrations;
# every later `migrate deploy` then refuses with P3009. SQLite applies each
# migration in a transaction, so such a failure is fully rolled back and the
# schema is unchanged — mark the migration rolled-back so the corrected SQL
# re-applies, then deploy again.
deploy_migrations() {
  local output
  if output="$(run_as_uwe "pnpm --filter '$DATABASE_WORKSPACE_FILTER' db:deploy" 2>&1)"; then
    printf '%s\n' "$output"
    return 0
  fi
  printf '%s\n' "$output"

  if ! echo "$output" | grep -q 'P3009'; then
    return 1
  fi

  local failed name
  failed="$(deploy_failed_migration_names "$output")"
  if [[ -z "$failed" ]]; then
    return 1
  fi

  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    warn "Blockierende fehlgeschlagene Migration: $name — markiere als rolled-back und versuche db:deploy erneut."
    run_as_uwe "pnpm --filter '$DATABASE_WORKSPACE_FILTER' exec prisma migrate resolve --rolled-back '$name'"
  done <<< "$failed"

  log "db:deploy erneut anwenden nach Recovery …"
  run_as_uwe "pnpm --filter '$DATABASE_WORKSPACE_FILTER' db:deploy"
}

migration_status_is_current() {
  local output="$1"
  echo "$output" | grep -qiE '(Database schema is up to date|No pending migrations|All migrations have been applied)'
}

verify_migrations_applied() {
  local output
  output="$(migration_status_output)"

  if migration_status_has_pending "$output"; then
    die "Ausstehende Datenbank-Migrationen nach db:deploy — Setup abgebrochen. Prüfe DATABASE_URL in $UWE_ENV_FILE und führe manuell aus: pnpm --filter $DATABASE_WORKSPACE_FILTER db:deploy

$output"
  fi

  if migration_status_is_current "$output"; then
    ok "Datenbank-Schema ist aktuell."
    return 0
  fi

  warn "Migrations-Status konnte nicht eindeutig gelesen werden — bitte manuell prüfen:"
  echo "$output" | sed 's/^/  /'
}

run_migrations() {
  local schema="$1"
  local migrations_dir before
  migrations_dir="$(dirname "$schema")/migrations"

  if [[ ! -d "$migrations_dir" ]] || [[ -z "$(find "$migrations_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -n 1 || true)" ]]; then
    warn "Keine Prisma-Migrationen unter $migrations_dir — überspringe db:deploy."
    return 0
  fi

  before="$(migration_status_output)"
  if migration_status_has_pending "$before"; then
    warn "Ausstehende Migrationen erkannt — wende db:deploy an …"
    echo "$before" | sed 's/^/  /'
  else
    log "Prüfe Datenbank-Migrationen …"
    if migration_status_is_current "$before"; then
      ok "Keine ausstehenden Migrationen vor db:deploy."
    fi
  fi

  log "Wende Datenbank-Migrationen an (pnpm --filter $DATABASE_WORKSPACE_FILTER db:deploy) …"
  deploy_migrations
  verify_migrations_applied
}

run_build() {
  log "Baue UWE (pnpm build — inkl. Standalone-Prisma-Runtime) …"
  run_as_uwe "pnpm build"
}

find_prisma_schema() {
  local preferred="$UWE_HOME/packages/database/prisma/schema.prisma"
  if [[ -f "$preferred" ]]; then
    printf '%s\n' "$preferred"
    return 0
  fi

  local found
  found="$(find "$UWE_HOME" -path '*/node_modules/*' -prune -o -name 'schema.prisma' -print 2>/dev/null | head -n 1 || true)"
  if [[ -n "$found" && -f "$found" ]]; then
    warn "Bevorzugtes Schema nicht gefunden — verwende: $found"
    printf '%s\n' "$found"
    return 0
  fi

  die "Keine schema.prisma gefunden unter $UWE_HOME"
}

verify_standalone_runtime_deps() {
  local app="$1"
  local standalone_dir="$UWE_HOME/apps/$app/.next/standalone"
  local check_script="$UWE_HOME/scripts/check-standalone-prisma-deps.mjs"

  if [[ ! -d "$standalone_dir" ]]; then
    die "Standalone-Build fehlt für $app: $standalone_dir"
  fi

  if [[ ! -f "$check_script" ]]; then
    die "Standalone-Prüfskript fehlt: $check_script"
  fi

  log "Prüfe Standalone-Runtime-Dependencies für $app …"
  if ! run_as_uwe "node '$check_script' '$app'"; then
    die "Standalone-Runtime-Dependencies fehlen für $app. Build erneut ausführen oder --repair."
  fi
}

verify_service_node_access() {
  local node_bin

  node_bin="$(find_node_binary)"
  if [[ -z "$node_bin" || ! -x "$node_bin" ]]; then
    die "Node.js nicht gefunden. Ausführen: sudo bash $UWE_HOME/deploy/scripts/setup-uwe-host.sh --repair"
  fi

  log "Prüfe Node.js für Service-User $SERVICE_USER (systemd-PATH) …"
  if ! run_as_uwe_systemd_env "node_bin=\$(command -v node 2>/dev/null || true); if [[ -z \"\$node_bin\" && -x /usr/bin/node ]]; then node_bin=/usr/bin/node; fi; [[ -n \"\$node_bin\" && -x \"\$node_bin\" ]]"; then
    die "Node.js ist für $SERVICE_USER unter systemd-PATH nicht ausführbar. Ausführen: sudo bash $UWE_HOME/deploy/scripts/setup-uwe-host.sh --repair"
  fi

  ok "Node.js für $SERVICE_USER unter systemd-PATH verfügbar."
}

verify_all_standalone_runtime_deps() {
  verify_standalone_runtime_deps "studio"
  if [[ -d "$UWE_HOME/apps/portal/.next/standalone" ]]; then
    verify_standalone_runtime_deps "portal"
  else
    warn "Portal-Standalone fehlt — überspringe Portal-Runtime-Prüfung."
  fi
}

run_deploy_steps() {
  local quick="${1:-0}"
  local schema
  schema="$(find_prisma_schema)"

  validate_node_binary
  install_dependencies "$quick"
  run_prisma_generate
  run_migrations "$schema"
  run_build
  verify_all_standalone_runtime_deps
}
