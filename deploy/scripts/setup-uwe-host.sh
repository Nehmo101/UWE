#!/usr/bin/env bash
# Idempotent one-shot setup for UWE on a Linux host (systemd + LAN bind).
# Usage: sudo bash ./deploy/scripts/setup-uwe-host.sh
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
readonly SYSTEMD_UNIT="uwe.service"
readonly DATABASE_WORKSPACE_FILTER="@uwe/database"
readonly NODE_MAJOR="22"
readonly DEFAULT_PNPM_VERSION="10.12.1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
  log "Entferne alte pnpm/Corepack-Caches und Workspace-node_modules …"

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

  log "Setze Host-Abhängigkeiten hart zurück: Node.js ${NODE_MAJOR}.x, pnpm ${pnpm_version}, Build-Tools …"

  export DEBIAN_FRONTEND=noninteractive

  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "$SYSTEMD_UNIT" >/dev/null 2>&1; then
    systemctl stop "$SYSTEMD_UNIT" >/dev/null 2>&1 || true
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
  require_command node "Node.js ${NODE_MAJOR}.x installieren."
  require_command npm "npm installieren."
  require_command corepack "Corepack installieren."
  require_command pnpm "pnpm installieren."
  require_command curl "curl installieren: sudo apt install curl"
  require_command ss "ss installieren (Paket iproute2): sudo apt install iproute2"

  local node_major pnpm_version required_pnpm_version
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$node_major" != "$NODE_MAJOR" ]]; then
    die "Falsche Node.js-Version aktiv: $(node -v). Erwartet: v${NODE_MAJOR}.x"
  fi

  required_pnpm_version="$(get_required_pnpm_version)"
  pnpm_version="$(pnpm -v)"
  if [[ "$pnpm_version" != "$required_pnpm_version" ]]; then
    die "Falsche pnpm-Version aktiv: ${pnpm_version}. Erwartet: ${required_pnpm_version}"
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
PORTAL_PORT=3001
RUN_DB_SEED=false
AUTH_SECRET=CHANGE_ME_generate_with_openssl_rand_base64_32
EOF
}

ensure_env_file() {
  if [[ ! -f "$UWE_ENV_FILE" ]]; then
    log "Erzeuge $UWE_ENV_FILE …"
    if [[ -f "$UWE_HOME/.env.production.example" ]]; then
      install -m 640 -o root -g "$SERVICE_GROUP" "$UWE_HOME/.env.production.example" "$UWE_ENV_FILE"
    elif [[ -f "$UWE_HOME/.env.example" ]]; then
      install -m 640 -o root -g "$SERVICE_GROUP" "$UWE_HOME/.env.example" "$UWE_ENV_FILE"
    else
      create_minimal_env
    fi
  else
    log "$UWE_ENV_FILE existiert bereits — behalte vorhandene Secrets bei."
  fi

  upsert_env_var NODE_ENV production "$UWE_ENV_FILE"
  upsert_env_var PORT "$STUDIO_PORT" "$UWE_ENV_FILE"
  upsert_env_var HOST "0.0.0.0" "$UWE_ENV_FILE"
  upsert_env_var HOSTNAME "0.0.0.0" "$UWE_ENV_FILE"
  upsert_env_var DATABASE_URL "file:${UWE_DATA_DIR}/uwe.db" "$UWE_ENV_FILE"
  upsert_env_var UWE_HOME "$UWE_HOME" "$UWE_ENV_FILE"
  upsert_env_var UWE_ENV "$UWE_ENV_FILE" "$UWE_ENV_FILE"

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
  log "Installiere npm-Abhängigkeiten (pnpm install inkl. Build-/Dev-Tools) …"
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
Documentation=file://${UWE_HOME}/docs/deployment-hardening.md
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
    log "UFW ist aktiv — erlaube Port ${STUDIO_PORT}/tcp …"
    ufw allow "${STUDIO_PORT}/tcp" >/dev/null || ufw allow "${STUDIO_PORT}/tcp"
  else
    log "UFW ist nicht aktiv — überspringe Firewall-Regel."
  fi
}

service_active() {
  systemctl is-active --quiet "$SYSTEMD_UNIT" 2>/dev/null
}

listening_on_all_interfaces() {
  ss -tulpn 2>/dev/null | grep -E ":${STUDIO_PORT}\b" | grep -qE '0\.0\.0\.0|\*'
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

http_reachable() {
  local url="$1"
  local code
  code="$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "000")"
  [[ "$code" =~ ^[23] ]]
}

check_reachability() {
  local urls=(
    "http://127.0.0.1:${STUDIO_PORT}/studio"
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

print_diagnostics() {
  echo ""
  log "Diagnose"
  echo ""
  systemctl status "$SYSTEMD_UNIT" --no-pager || true
  echo ""
  ss -tulpn | grep ":${STUDIO_PORT}" || warn "Kein Prozess lauscht auf Port ${STUDIO_PORT}."
  echo ""
  log "HTTP-Test (Studio)"
  curl -i --max-time 8 "http://127.0.0.1:${STUDIO_PORT}/studio" 2>/dev/null || \
    curl -i --max-time 8 "http://127.0.0.1:${STUDIO_PORT}/" 2>/dev/null || \
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
    if listening_on_all_interfaces; then
      bind_mode="0.0.0.0:${STUDIO_PORT} (und ggf. 127.0.0.1)"
    else
      bind_mode="nur 127.0.0.1:${STUDIO_PORT}"
    fi
  elif listening_on_all_interfaces; then
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
  echo " Service aktiv:        $active"
  echo " Lauscht auf:          $bind_mode"
  echo " HTTP erreichbar:      $reachable_url"
  echo " Lokale Studio-URL:    http://127.0.0.1:${STUDIO_PORT}/studio"
  echo " LAN Studio-URL:       http://${lan_ip}:${STUDIO_PORT}/studio"
  echo " Portal (LAN):         http://${lan_ip}:3001"
  echo " Env-Datei:            $UWE_ENV_FILE"
  echo " Repository:           $UWE_HOME"
  echo " Node.js:              $(node -v 2>/dev/null || echo unbekannt)"
  echo " pnpm:                 $(pnpm -v 2>/dev/null || echo unbekannt)"
  echo ""
  echo " Nächste manuelle Schritte:"
  echo "  1. Secrets in $UWE_ENV_FILE setzen:"
  echo "       AUTH_SECRET=\$(openssl rand -base64 32)"
  echo "       UWE_SETUP_TOKEN=\$(openssl rand -hex 32)"
  echo "       STUDIO_API_TOKEN=\$(openssl rand -base64 32)   # empfohlen"
  echo "     Danach: sudo systemctl restart uwe.service"
  echo "  2. Erstes Setup im Browser: http://127.0.0.1:${STUDIO_PORT}/setup"
  echo "     (Setup-Token aus UWE_SETUP_TOKEN eingeben, Owner anlegen)"
  echo "  3. Optional: Cloudflare Tunnel + Access für Internet-Zugriff"
  echo "  4. RTX-Agent nur im Heimnetz — niemals öffentlich freigeben"
  echo ""
  echo " Nach Git-Pull neu deployen:"
  echo "   cd $UWE_HOME && git pull && sudo bash ./deploy/scripts/setup-uwe-host.sh"
  echo "========================================"
}

main() {
  require_root
  UWE_HOME="$(detect_uwe_home)"
  export UWE_HOME

  log "UWE Host Setup — Repository: $UWE_HOME"
  reset_system_dependencies
  check_prerequisites
  ensure_service_user
  ensure_directories
  chown -R "$SERVICE_USER:$SERVICE_GROUP" "$UWE_HOME"
  ensure_env_file

  local schema
  schema="$(find_prisma_schema)"

  install_dependencies
  run_prisma_generate "$schema"
  run_migrations "$schema"
  run_build
  ensure_start_script
  write_systemd_unit

  log "systemd neu laden und Service starten …"
  systemctl daemon-reload
  systemctl enable "$SYSTEMD_UNIT"
  systemctl restart "$SYSTEMD_UNIT"

  configure_firewall
  sleep 2
  print_diagnostics
  print_summary
}

main "$@"
