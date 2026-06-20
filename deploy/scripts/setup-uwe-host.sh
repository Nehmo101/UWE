#!/usr/bin/env bash
# Idempotent Linux production host setup for UWE (systemd + /etc/uwe/uwe.env).
#
# Usage:
#   sudo bash ./deploy/scripts/setup-uwe-host.sh              # safe update/repair (default)
#   sudo bash ./deploy/scripts/setup-uwe-host.sh --quick      # fast update after git pull
#   sudo bash ./deploy/scripts/setup-uwe-host.sh --repair     # rebuild deps + rewrite systemd
#   sudo bash ./deploy/scripts/setup-uwe-host.sh --healthcheck
#   sudo bash ./deploy/scripts/setup-uwe-host.sh --fresh      # destructive reset (requires confirmation)
#
# Official paths:
#   Repo:    /opt/uwe
#   Env:     /etc/uwe/uwe.env
#   Data:    /var/lib/uwe
#   Logs:    /var/log/uwe
#   Backups: /var/backups/uwe
#   Service: uwe.service
set -euo pipefail

readonly SERVICE_USER="uwe"
readonly SERVICE_GROUP="uwe"
readonly UWE_ENV_DIR="/etc/uwe"
readonly UWE_ENV_FILE="/etc/uwe/uwe.env"
readonly UWE_DATA_DIR="/var/lib/uwe"
readonly UWE_LOG_DIR="/var/log/uwe"
readonly UWE_BACKUP_DIR="/var/backups/uwe"
readonly DEFAULT_UWE_HOME="/opt/uwe"
readonly STUDIO_PORT="3000"
readonly PORTAL_PORT="3001"
readonly SYSTEMD_UNIT="uwe.service"
readonly LEGACY_SYSTEMD_UNIT="uwe-host.service"
readonly DATABASE_WORKSPACE_FILTER="@uwe/database"
readonly NODE_MAJOR="22"
readonly DEFAULT_PNPM_VERSION="10.12.1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE="default"

log() {
  echo "==> $*"
}

warn() {
  echo "WARN: $*" >&2
}

die() {
  echo "FEHLER: $*" >&2
  exit 1
}

usage() {
  cat <<EOF
UWE Linux Production Host Setup

Usage: sudo bash $0 [MODE]

Modes (mutually exclusive):
  (default)           Safe, idempotent update/repair — no data or secrets deleted
  --quick             Fast update: git check, pnpm install, prisma, build, restart
  --repair            Thorough repair: validate/reinstall Node/pnpm, clean node_modules, rewrite systemd
  --fresh             Destructive full reset — requires typing DELETE-UWE to confirm
  --wipe-and-reinstall  Alias for --fresh
  --healthcheck       Read-only status checks (no changes)
  -h, --help          Show this help

Official production paths:
  Repository:  /opt/uwe
  Environment: /etc/uwe/uwe.env
  Data:        /var/lib/uwe
  Logs:        /var/log/uwe
  Backups:     /var/backups/uwe
  Service:     uwe.service

After git pull:
  cd /opt/uwe && git pull && sudo bash ./deploy/scripts/setup-uwe-host.sh --quick
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --quick)
        MODE="quick"
        ;;
      --repair)
        MODE="repair"
        ;;
      --fresh | --wipe-and-reinstall)
        MODE="fresh"
        ;;
      --healthcheck)
        MODE="healthcheck"
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        die "Unbekanntes Argument: $1 (siehe --help)"
        ;;
    esac
    shift
  done
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Dieses Script muss als root ausgeführt werden: sudo bash $0"
  fi
}

detect_uwe_home() {
  if [[ -n "${UWE_HOME:-}" && -f "${UWE_HOME}/package.json" ]]; then
    printf '%s\n' "$UWE_HOME"
    return 0
  fi

  local candidate
  candidate="$(cd "$SCRIPT_DIR/../.." && pwd)"
  if [[ -f "$candidate/package.json" ]]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  if [[ -f "$DEFAULT_UWE_HOME/package.json" ]]; then
    printf '%s\n' "$DEFAULT_UWE_HOME"
    return 0
  fi

  die "UWE-Repository nicht gefunden. Erwartet unter $DEFAULT_UWE_HOME oder neben deploy/scripts/."
}

require_command() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    die "$cmd nicht gefunden. $hint"
  fi
}

get_required_pnpm_version() {
  local version=""
  if [[ -f "$UWE_HOME/package.json" ]]; then
    version="$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"pnpm@\([^"]*\)".*/\1/p' "$UWE_HOME/package.json" | head -n 1 || true)"
  fi

  if [[ -z "$version" ]]; then
    version="$DEFAULT_PNPM_VERSION"
  fi

  printf '%s\n' "$version"
}

remove_path_if_present() {
  local target="$1"
  if [[ -e "$target" || -L "$target" ]]; then
    rm -rf "$target"
  fi
}

remove_stale_node_binaries() {
  log "Entferne alte Node/npm/pnpm/corepack-Binaries und Shims …"
  local bin path
  for bin in node npm npx pnpm corepack yarn yarnpkg; do
    for path in "/usr/local/bin/$bin" "/usr/bin/$bin" "/bin/$bin"; do
      remove_path_if_present "$path"
    done
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

reset_system_dependencies() {
  local pnpm_version
  pnpm_version="$(get_required_pnpm_version)"

  log "Setze Host-Abhängigkeiten zurück: Node.js ${NODE_MAJOR}.x, pnpm ${pnpm_version}, Build-Tools …"

  export DEBIAN_FRONTEND=noninteractive

  if command -v systemctl >/dev/null 2>&1; then
    systemctl stop "$SYSTEMD_UNIT" >/dev/null 2>&1 || true
    systemctl stop "$LEGACY_SYSTEMD_UNIT" >/dev/null 2>&1 || true
  fi

  apt-get update
  apt-get install -y curl ca-certificates gnupg lsb-release apt-transport-https

  apt-get remove -y nodejs npm pnpm yarn yarnpkg corepack libnode-dev 2>/dev/null || true
  apt-get purge -y nodejs npm pnpm yarn yarnpkg corepack libnode-dev 2>/dev/null || true
  apt-get autoremove -y || true

  remove_stale_node_binaries
  remove_node_caches_and_workspace_modules

  rm -f /etc/apt/sources.list.d/nodesource.list /etc/apt/sources.list.d/nodesource.list.save
  rm -f /etc/apt/keyrings/nodesource.gpg /usr/share/keyrings/nodesource.gpg

  log "Installiere Node.js ${NODE_MAJOR}.x über NodeSource …"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs

  hash -r || true

  require_command node "Node.js ${NODE_MAJOR}.x Installation fehlgeschlagen."
  require_command npm "npm wurde mit Node.js nicht installiert."

  local installed_node_major
  installed_node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$installed_node_major" != "$NODE_MAJOR" ]]; then
    echo "Gefundene node-Binaries:" >&2
    type -a node >&2 || true
    die "Falsche Node.js-Version aktiv: $(node -v). Erwartet: v${NODE_MAJOR}.x"
  fi

  if ! command -v corepack >/dev/null 2>&1; then
    log "Corepack fehlt — installiere Corepack global über npm …"
    npm install -g corepack
    hash -r || true
  fi

  require_command corepack "Corepack konnte nicht installiert werden."

  log "Aktiviere Corepack und pnpm ${pnpm_version} …"
  corepack enable
  corepack prepare "pnpm@${pnpm_version}" --activate
  hash -r || true

  require_command pnpm "pnpm ${pnpm_version} konnte nicht aktiviert werden."

  local installed_pnpm_version
  installed_pnpm_version="$(pnpm -v)"
  if [[ "$installed_pnpm_version" != "$pnpm_version" ]]; then
    die "Falsche pnpm-Version aktiv: ${installed_pnpm_version}. Erwartet: ${pnpm_version}"
  fi

  apt-get install -y git curl ca-certificates gnupg iproute2 openssl sqlite3 build-essential python3

  log "Dependency-Reset abgeschlossen: node $(node -v), npm $(npm -v), pnpm $(pnpm -v)."
}

check_prerequisites() {
  require_command git "Git installieren: sudo apt install git"
  require_command curl "curl installieren: sudo apt install curl"
  require_command ss "ss installieren (Paket iproute2): sudo apt install iproute2"

  if ! command -v node >/dev/null 2>&1; then
    die "Node.js ${NODE_MAJOR}.x fehlt. Ausführen: sudo bash $0 --repair"
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    die "pnpm fehlt. Ausführen: sudo bash $0 --repair"
  fi

  local node_major required_pnpm_version pnpm_version
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$node_major" -lt 20 ]]; then
    die "Node.js zu alt: $(node -v). Mindestens v20, empfohlen v${NODE_MAJOR}.x — siehe: sudo bash $0 --repair"
  fi

  required_pnpm_version="$(get_required_pnpm_version)"
  pnpm_version="$(pnpm -v)"
  if [[ "$pnpm_version" != "$required_pnpm_version" ]]; then
    warn "pnpm-Version ${pnpm_version} weicht ab (erwartet ${required_pnpm_version}). Reparieren: sudo bash $0 --repair"
  fi
}

git_safety_check() {
  if [[ ! -d "$UWE_HOME/.git" ]]; then
    warn "Kein Git-Repository unter $UWE_HOME — überspringe Git-Prüfung."
    return 0
  fi

  log "Git-Status prüfen …"
  local branch dirty
  branch="$(git -C "$UWE_HOME" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
  dirty="$(git -C "$UWE_HOME" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

  if [[ "$dirty" != "0" ]]; then
    warn "Uncommitted changes in $UWE_HOME (Branch: $branch, $dirty Datei(en))."
    warn "Für reproduzierbare Deployments: git stash oder commit vor dem Update."
  else
    log "Git-Working-Tree sauber (Branch: $branch)."
  fi
}

migrate_legacy_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 0
  fi

  if systemctl list-unit-files "$LEGACY_SYSTEMD_UNIT" >/dev/null 2>&1; then
    if systemctl is-active --quiet "$LEGACY_SYSTEMD_UNIT" 2>/dev/null; then
      log "Stoppe veralteten Dienst $LEGACY_SYSTEMD_UNIT …"
      systemctl stop "$LEGACY_SYSTEMD_UNIT" || true
    fi
    if systemctl is-enabled --quiet "$LEGACY_SYSTEMD_UNIT" 2>/dev/null; then
      log "Deaktiviere veralteten Dienst $LEGACY_SYSTEMD_UNIT …"
      systemctl disable "$LEGACY_SYSTEMD_UNIT" || true
    fi
    if [[ -f "/etc/systemd/system/$LEGACY_SYSTEMD_UNIT" ]]; then
      log "Entferne veraltete Unit-Datei $LEGACY_SYSTEMD_UNIT …"
      rm -f "/etc/systemd/system/$LEGACY_SYSTEMD_UNIT"
      systemctl daemon-reload || true
    fi
  fi
}

ensure_service_user() {
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    log "Service-User $SERVICE_USER existiert bereits."
    return 0
  fi

  log "Lege Service-User $SERVICE_USER an …"
  useradd --system --home "$UWE_HOME" --shell /usr/sbin/nologin "$SERVICE_USER"
}

ensure_directories() {
  log "Erstelle Verzeichnisse und setze Rechte …"
  install -d -m 750 -o root -g "$SERVICE_GROUP" "$UWE_ENV_DIR"
  install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$UWE_DATA_DIR"/{uploads,exports}
  install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$UWE_LOG_DIR"
  install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$UWE_BACKUP_DIR"
}

upsert_env_var_if_missing() {
  local key="$1"
  local value="$2"
  local file="$3"

  if grep -q "^${key}=" "$file" 2>/dev/null; then
    return 0
  fi
  printf '%s=%s\n' "$key" "$value" >>"$file"
}

upsert_env_var() {
  local key="$1"
  local value="$2"
  local file="$3"

  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

create_minimal_env() {
  cat >"$UWE_ENV_FILE" <<EOF
# UWE production environment — generated by setup-uwe-host.sh
# Replace CHANGE_ME secrets before exposing UWE beyond your LAN.
NODE_ENV=production
PORT=${STUDIO_PORT}
HOST=0.0.0.0
HOSTNAME=0.0.0.0
DATABASE_URL=file:${UWE_DATA_DIR}/uwe.db
UWE_HOME=${UWE_HOME}
UWE_ENV=${UWE_ENV_FILE}
UWE_DATA_DIR=${UWE_DATA_DIR}
UWE_UPLOADS_DIR=${UWE_DATA_DIR}/uploads
UWE_EXPORT_DIR=${UWE_DATA_DIR}/exports
UWE_BACKUP_DIR=${UWE_BACKUP_DIR}
STUDIO_PORT=${STUDIO_PORT}
PORTAL_PORT=${PORTAL_PORT}
RUN_DB_SEED=false
AUTH_SECRET=CHANGE_ME_generate_with_openssl_rand_base64_32
EOF
}

ensure_secret_var() {
  local key="$1"
  local generator="$2"
  local file="$3"
  local force="${4:-0}"

  local current=""
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    current="$(grep "^${key}=" "$file" | head -n 1 | cut -d= -f2-)"
  fi

  if [[ "$force" -eq 1 ]] || [[ -z "$current" ]] || [[ "$current" == CHANGE_ME* ]]; then
    local value
    value="$(eval "$generator")"
    upsert_env_var "$key" "$value" "$file"
    log "Secret $key ergänzt oder erneuert."
  fi
}

ensure_env_file() {
  local force_recreate="${1:-0}"

  if [[ "$force_recreate" -eq 1 ]]; then
    log "Erzeuge $UWE_ENV_FILE neu (--fresh) …"
    create_minimal_env
  elif [[ ! -f "$UWE_ENV_FILE" ]]; then
    log "Erzeuge $UWE_ENV_FILE …"
    if [[ -f "$UWE_HOME/.env.production.example" ]]; then
      install -m 640 -o root -g "$SERVICE_GROUP" "$UWE_HOME/.env.production.example" "$UWE_ENV_FILE"
    elif [[ -f "$UWE_HOME/.env.example" ]]; then
      install -m 640 -o root -g "$SERVICE_GROUP" "$UWE_HOME/.env.example" "$UWE_ENV_FILE"
    else
      create_minimal_env
    fi
  else
    log "$UWE_ENV_FILE existiert bereits — behalte vorhandene Werte bei."
  fi

  # Pflichtvariablen nur ergänzen, wenn sie fehlen (kein Überschreiben bei normalen Läufen)
  upsert_env_var_if_missing NODE_ENV production "$UWE_ENV_FILE"
  upsert_env_var_if_missing PORT "$STUDIO_PORT" "$UWE_ENV_FILE"
  upsert_env_var_if_missing HOST "0.0.0.0" "$UWE_ENV_FILE"
  upsert_env_var_if_missing HOSTNAME "0.0.0.0" "$UWE_ENV_FILE"
  upsert_env_var_if_missing DATABASE_URL "file:${UWE_DATA_DIR}/uwe.db" "$UWE_ENV_FILE"
  upsert_env_var_if_missing UWE_HOME "$UWE_HOME" "$UWE_ENV_FILE"
  upsert_env_var_if_missing UWE_ENV "$UWE_ENV_FILE" "$UWE_ENV_FILE"
  upsert_env_var_if_missing UWE_DATA_DIR "$UWE_DATA_DIR" "$UWE_ENV_FILE"
  upsert_env_var_if_missing UWE_UPLOADS_DIR "${UWE_DATA_DIR}/uploads" "$UWE_ENV_FILE"
  upsert_env_var_if_missing UWE_EXPORT_DIR "${UWE_DATA_DIR}/exports" "$UWE_ENV_FILE"
  upsert_env_var_if_missing UWE_BACKUP_DIR "$UWE_BACKUP_DIR" "$UWE_ENV_FILE"
  upsert_env_var_if_missing STUDIO_PORT "$STUDIO_PORT" "$UWE_ENV_FILE"
  upsert_env_var_if_missing PORTAL_PORT "$PORTAL_PORT" "$UWE_ENV_FILE"
  upsert_env_var_if_missing RUN_DB_SEED false "$UWE_ENV_FILE"

  # Secrets nur erzeugen wenn fehlend oder Platzhalter (--fresh erzwingt Neu)
  ensure_secret_var AUTH_SECRET "openssl rand -base64 32" "$UWE_ENV_FILE" "$force_recreate"
  ensure_secret_var UWE_SETUP_TOKEN "openssl rand -hex 32" "$UWE_ENV_FILE" "$force_recreate"
  ensure_secret_var STUDIO_API_TOKEN "openssl rand -base64 32" "$UWE_ENV_FILE" "$force_recreate"

  chown root:"$SERVICE_GROUP" "$UWE_ENV_FILE"
  chmod 640 "$UWE_ENV_FILE"
  chown root:"$SERVICE_GROUP" "$UWE_ENV_DIR"
  chmod 750 "$UWE_ENV_DIR"
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

run_as_uwe() {
  local cmd="$1"
  sudo -u "$SERVICE_USER" bash -lc "
    set -euo pipefail
    export PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:'\"\\${PATH:-}\"
    cd '$UWE_HOME'
    if [[ -f '$UWE_ENV_FILE' ]]; then
      set -a
      # shellcheck disable=SC1090
      source '$UWE_ENV_FILE'
      set +a
    fi
    $cmd
  "
}

install_dependencies() {
  log "Installiere npm-Abhängigkeiten (pnpm install) …"
  run_as_uwe "corepack prepare 'pnpm@$(get_required_pnpm_version)' --activate >/dev/null 2>&1 || true; pnpm install --frozen-lockfile --prod=false"
}

run_prisma_generate() {
  local schema="$1"
  log "Generiere Prisma Client ($schema) …"
  run_as_uwe "pnpm --filter '$DATABASE_WORKSPACE_FILTER' exec prisma generate --schema '$schema'"
}

run_migrations() {
  local schema="$1"
  local migrations_dir
  migrations_dir="$(dirname "$schema")/migrations"

  if [[ ! -d "$migrations_dir" ]] || [[ -z "$(find "$migrations_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -n 1 || true)" ]]; then
    warn "Keine Prisma-Migrationen unter $migrations_dir gefunden — überspringe prisma migrate deploy."
    return 0
  fi

  log "Wende Datenbank-Migrationen an (prisma migrate deploy) …"
  run_as_uwe "pnpm --filter '$DATABASE_WORKSPACE_FILTER' exec prisma migrate deploy --schema '$schema'"
}

run_build() {
  log "Baue UWE (pnpm build) …"
  run_as_uwe "pnpm build"
}

ensure_start_script() {
  local start_script="$UWE_HOME/deploy/scripts/start-uwe.sh"
  if [[ ! -f "$start_script" ]]; then
    die "Start-Script fehlt: $start_script"
  fi
  chmod +x "$start_script" "$UWE_HOME/deploy/scripts/uwe-backup.sh" 2>/dev/null || true
}

write_systemd_unit() {
  local unit_path="/etc/systemd/system/$SYSTEMD_UNIT"
  log "Schreibe systemd Unit nach $unit_path …"

  cat >"$unit_path" <<EOF
[Unit]
Description=UWE — Universeller Welten-Editor (Studio + Portal)
Documentation=file://${UWE_HOME}/docs/UWE_HOST_LINUX_STARTUP.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${UWE_HOME}
Environment=UWE_HOME=${UWE_HOME}
Environment=UWE_ENV=${UWE_ENV_FILE}
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=HOSTNAME=0.0.0.0
Environment=PORT=${STUDIO_PORT}
EnvironmentFile=-${UWE_ENV_FILE}

ExecStart=${UWE_HOME}/deploy/scripts/start-uwe.sh

Restart=on-failure
RestartSec=10
TimeoutStopSec=30

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${UWE_DATA_DIR} ${UWE_BACKUP_DIR} ${UWE_LOG_DIR}
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictRealtime=true
LockPersonality=true
MemoryDenyWriteExecute=false

StandardOutput=journal
StandardError=journal
SyslogIdentifier=uwe

[Install]
WantedBy=multi-user.target
EOF
}

configure_firewall() {
  if ! command -v ufw >/dev/null 2>&1; then
    return 0
  fi

  if ufw status 2>/dev/null | grep -qi 'Status: active'; then
    log "UFW ist aktiv — erlaube Port ${STUDIO_PORT}/tcp und ${PORTAL_PORT}/tcp …"
    ufw allow "${STUDIO_PORT}/tcp" >/dev/null 2>&1 || ufw allow "${STUDIO_PORT}/tcp"
    ufw allow "${PORTAL_PORT}/tcp" >/dev/null 2>&1 || ufw allow "${PORTAL_PORT}/tcp"
  else
    log "UFW ist nicht aktiv — überspringe Firewall-Regel."
  fi
}

service_active() {
  systemctl is-active --quiet "$SYSTEMD_UNIT" 2>/dev/null
}

listening_on_all_interfaces() {
  local port="$1"
  ss -tulpn 2>/dev/null | grep -E ":${port}\b" | grep -qE '0\.0\.0\.0|\*'
}

get_lan_ip() {
  local ip=""
  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [[ -z "$ip" ]] && command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") print $(i+1); exit}')"
  fi
  if [[ -z "$ip" ]]; then
    ip="<LAN-IP>"
  fi
  printf '%s\n' "$ip"
}

http_status_code() {
  local url="$1"
  curl -sS --max-time 8 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "000"
}

http_reachable() {
  local url="$1"
  local code
  code="$(http_status_code "$url")"
  [[ "$code" =~ ^[23] ]]
}

confirm_fresh_reset() {
  echo ""
  echo "========================================"
  echo " WARNUNG: Destruktiver Reset (--fresh)"
  echo "========================================"
  echo " Dies löscht:"
  echo "   - $UWE_DATA_DIR (Datenbank, Uploads, Exports)"
  echo "   - $UWE_ENV_FILE (Konfiguration und Secrets)"
  echo "   - Build-Artefakte im Repository"
  echo ""
  echo " Vor dem Löschen wird ein Backup nach"
  echo " $UWE_BACKUP_DIR/<timestamp>/ angelegt, soweit möglich."
  echo ""
  echo " Zum Fortfahren eingeben: DELETE-UWE"
  echo " (Abbruch mit Strg+C oder leerer Eingabe)"
  echo "========================================"
  echo -n "Bestätigung: "
  local answer
  read -r answer
  if [[ "$answer" != "DELETE-UWE" ]]; then
    die "Abgebrochen — Bestätigung nicht korrekt."
  fi
}

backup_before_fresh() {
  local timestamp backup_dir
  timestamp="$(date +%Y%m%d-%H%M%S)"
  backup_dir="${UWE_BACKUP_DIR}/${timestamp}-pre-fresh"

  log "Erstelle Backup vor Reset nach $backup_dir …"
  install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$backup_dir"

  if [[ -f "$UWE_ENV_FILE" ]]; then
    cp -a "$UWE_ENV_FILE" "$backup_dir/uwe.env" 2>/dev/null || warn "Env-Backup fehlgeschlagen."
  fi

  if [[ -d "$UWE_DATA_DIR" ]]; then
    if command -v tar >/dev/null 2>&1; then
      tar -czf "$backup_dir/uwe-data.tar.gz" -C "$(dirname "$UWE_DATA_DIR")" "$(basename "$UWE_DATA_DIR")" 2>/dev/null \
        || warn "Daten-Backup fehlgeschlagen."
    else
      cp -a "$UWE_DATA_DIR" "$backup_dir/data" 2>/dev/null || warn "Daten-Backup fehlgeschlagen."
    fi
  fi

  log "Backup abgeschlossen: $backup_dir"
}

run_fresh_wipe() {
  log "Stoppe Dienste …"
  systemctl stop "$SYSTEMD_UNIT" >/dev/null 2>&1 || true
  systemctl stop "$LEGACY_SYSTEMD_UNIT" >/dev/null 2>&1 || true

  log "Entferne Produktionsdaten …"
  remove_path_if_present "$UWE_DATA_DIR"
  remove_path_if_present "$UWE_ENV_FILE"
  remove_node_caches_and_workspace_modules
}

run_healthcheck() {
  local lan_ip
  lan_ip="$(get_lan_ip)"

  echo ""
  echo "========================================"
  echo " UWE Healthcheck (read-only)"
  echo "========================================"
  echo ""

  log "systemctl status $SYSTEMD_UNIT"
  systemctl status "$SYSTEMD_UNIT" --no-pager || true
  echo ""

  log "Lauschende Ports (ss -ltnp)"
  ss -ltnp 2>/dev/null | grep -E ":${STUDIO_PORT}|:${PORTAL_PORT}" || warn "Kein Prozess auf Port ${STUDIO_PORT}/${PORTAL_PORT}."
  echo ""

  local url code
  for url in \
    "http://127.0.0.1:${STUDIO_PORT}/" \
    "http://127.0.0.1:${STUDIO_PORT}/setup" \
    "http://127.0.0.1:${STUDIO_PORT}/api/health"; do
    code="$(http_status_code "$url")"
    echo "curl -i $url  →  HTTP $code"
    curl -i --max-time 8 "$url" 2>/dev/null | head -n 15 || true
    echo ""
  done

  echo "hostname -I:"
  hostname -I 2>/dev/null || true
  echo ""

  echo "Lokale URLs:"
  echo "  Studio:  http://127.0.0.1:${STUDIO_PORT}/"
  echo "  Setup:   http://127.0.0.1:${STUDIO_PORT}/setup"
  echo "  Portal:  http://127.0.0.1:${PORTAL_PORT}/"
  echo ""
  echo "LAN URLs:"
  echo "  Studio:  http://${lan_ip}:${STUDIO_PORT}/"
  echo "  Setup:   http://${lan_ip}:${STUDIO_PORT}/setup"
  echo "  Portal:  http://${lan_ip}:${PORTAL_PORT}/"
  echo "========================================"
}

print_diagnostics() {
  echo ""
  log "Diagnose"
  echo ""
  systemctl status "$SYSTEMD_UNIT" --no-pager || true
  echo ""
  ss -tulpn | grep -E ":${STUDIO_PORT}|:${PORTAL_PORT}" || warn "Kein Prozess lauscht auf Port ${STUDIO_PORT}/${PORTAL_PORT}."
  echo ""
  log "HTTP-Test"
  curl -i --max-time 8 "http://127.0.0.1:${STUDIO_PORT}/" 2>/dev/null | head -n 20 || \
    warn "HTTP-Test fehlgeschlagen — siehe journalctl -u ${SYSTEMD_UNIT} -n 50"
}

print_summary() {
  local active="nein"
  local bind_mode="unbekannt"
  local lan_ip reachable_url

  if service_active; then
    active="ja"
  fi

  if ss -tulpn 2>/dev/null | grep -E ":${STUDIO_PORT}\b" | grep -q '127.0.0.1'; then
    if listening_on_all_interfaces "$STUDIO_PORT"; then
      bind_mode="0.0.0.0:${STUDIO_PORT} (und ggf. 127.0.0.1)"
    else
      bind_mode="nur 127.0.0.1:${STUDIO_PORT} — LAN-Zugriff blockiert!"
    fi
  elif listening_on_all_interfaces "$STUDIO_PORT"; then
    bind_mode="0.0.0.0:${STUDIO_PORT}"
  elif ss -tulpn 2>/dev/null | grep -q ":${STUDIO_PORT}"; then
    bind_mode="Port ${STUDIO_PORT} (Adresse prüfen mit: ss -tulpn | grep ${STUDIO_PORT})"
  else
    bind_mode="Port ${STUDIO_PORT} nicht aktiv"
  fi

  lan_ip="$(get_lan_ip)"
  reachable_url="nicht erreichbar"
  if url="$(check_reachability)"; then
    reachable_url="$url"
  fi

  echo ""
  echo "========================================"
  echo " UWE Host Setup — Zusammenfassung"
  echo "========================================"
  echo " Modus:               $MODE"
  echo " Service aktiv:       $active"
  echo " Lauscht auf:         $bind_mode"
  echo " HTTP erreichbar:     $reachable_url"
  echo " Lokale Studio-URL:   http://127.0.0.1:${STUDIO_PORT}/"
  echo " LAN Studio-URL:      http://${lan_ip}:${STUDIO_PORT}/"
  echo " Setup (lokal):       http://127.0.0.1:${STUDIO_PORT}/setup"
  echo " Setup (LAN):         http://${lan_ip}:${STUDIO_PORT}/setup"
  echo " Portal (LAN):        http://${lan_ip}:${PORTAL_PORT}/"
  echo " Env-Datei:           $UWE_ENV_FILE"
  echo " Repository:          $UWE_HOME"
  echo " Node.js:             $(node -v 2>/dev/null || echo unbekannt)"
  echo " pnpm:                $(pnpm -v 2>/dev/null || echo unbekannt)"
  echo ""
  echo " Nächste Schritte:"
  echo "  1. Erstes Setup: http://127.0.0.1:${STUDIO_PORT}/setup"
  echo "     (Setup-Token aus UWE_SETUP_TOKEN in $UWE_ENV_FILE)"
  echo "  2. Healthcheck:  sudo bash $0 --healthcheck"
  echo "  3. Quick-Update: sudo bash $0 --quick"
  echo "========================================"
}

check_reachability() {
  local urls=(
    "http://127.0.0.1:${STUDIO_PORT}/"
    "http://127.0.0.1:${STUDIO_PORT}/api/health"
  )
  local url
  for url in "${urls[@]}"; do
    if http_reachable "$url"; then
      printf '%s\n' "$url"
      return 0
    fi
  done
  return 1
}

start_or_restart_service() {
  log "systemd neu laden und Service starten …"
  systemctl daemon-reload
  systemctl enable "$SYSTEMD_UNIT"
  systemctl restart "$SYSTEMD_UNIT"
}

run_deploy_steps() {
  local schema
  schema="$(find_prisma_schema)"

  install_dependencies
  run_prisma_generate "$schema"
  run_migrations "$schema"
  run_build
  ensure_start_script
}

main() {
  parse_args "$@"
  require_root
  UWE_HOME="$(detect_uwe_home)"
  export UWE_HOME

  if [[ "$MODE" == "healthcheck" ]]; then
    run_healthcheck
    exit 0
  fi

  log "UWE Host Setup — Modus: $MODE — Repository: $UWE_HOME"

  migrate_legacy_service

  case "$MODE" in
    fresh)
      confirm_fresh_reset
      backup_before_fresh
      run_fresh_wipe
      reset_system_dependencies
      ;;
    repair)
      reset_system_dependencies
      remove_node_caches_and_workspace_modules
      ;;
    quick)
      check_prerequisites
      git_safety_check
      ;;
    default)
      check_prerequisites
      git_safety_check
      ;;
  esac

  ensure_service_user
  ensure_directories

  if [[ "$MODE" == "fresh" ]]; then
    ensure_env_file 1
  else
    ensure_env_file 0
  fi

  chown -R "$SERVICE_USER:$SERVICE_GROUP" "$UWE_HOME"

  run_deploy_steps

  if [[ ! -f "/etc/systemd/system/$SYSTEMD_UNIT" ]]; then
    write_systemd_unit
  elif [[ "$MODE" == "repair" || "$MODE" == "fresh" || "$MODE" == "default" ]]; then
    write_systemd_unit
  fi

  start_or_restart_service
  configure_firewall
  sleep 2
  print_diagnostics
  print_summary

  if [[ "$MODE" == "quick" ]]; then
    run_healthcheck
  fi
}

main "$@"
