#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
CONFIG_FILE="${PROJECT_ROOT}/install-config.txt"
ENV_FILE="${PROJECT_ROOT}/.env.local"
SUMMARY_FILE="${PROJECT_ROOT}/instance-summary.txt"
LOG_FILE="${PROJECT_ROOT}/install.log"
TOTAL_STEPS=15
STEP_INDEX=0
CURRENT_STEP=""
INSTANCE_PASSWORD="${KISTARO_INSTALL_PASSWORD:-}"

progress_percent() {
  local percent=$(( STEP_INDEX * 100 / TOTAL_STEPS ))

  if [[ "${percent}" -gt 99 ]]; then
    percent=99
  fi

  printf '%3d' "${percent}"
}

progress_prefix() {
  printf '[kistaro-installer] (%02d/%02d %s%%)' "${STEP_INDEX}" "${TOTAL_STEPS}" "$(progress_percent)"
}

log() {
  printf '\n[%s] %s\n' "kistaro-installer" "$1"
}

start_step() {
  STEP_INDEX=$(( STEP_INDEX + 1 ))
  CURRENT_STEP="$1"
  printf '\n%s %s ... ' "$(progress_prefix)" "${CURRENT_STEP}"
}

done_step() {
  printf 'erledigt\n'
}

fail_step() {
  local message="$1"

  printf 'Fehler\n'
  echo "[kistaro-installer] Fehler bei: ${message}"
  echo "[kistaro-installer] Details:"
  tail -n 80 "${LOG_FILE}" || true
}

run_quiet() {
  local message="$1"
  shift
  local spinner="|/-\\"
  local spinner_index=0
  local pid
  local frame

  start_step "${message}"

  (
    echo
    echo "== ${message} =="
    "$@"
  ) >>"${LOG_FILE}" 2>&1 &
  pid=$!

  while kill -0 "${pid}" >/dev/null 2>&1; do
    frame="${spinner:spinner_index:1}"
    spinner_index=$(( (spinner_index + 1) % ${#spinner} ))

    if [[ -t 1 ]]; then
      printf '\r%s %s ... %s' "$(progress_prefix)" "${message}" "${frame}"
    else
      printf '.'
    fi

    sleep 0.25
  done

  if wait "${pid}"; then
    if [[ -t 1 ]]; then
      printf '\r%s %s ... ' "$(progress_prefix)" "${message}"
    fi
    done_step
    return 0
  fi

  fail_step "${message}"
  exit 1
}

read_config_value() {
  local key="$1"

  if [[ ! -f "${CONFIG_FILE}" ]]; then
    return 0
  fi

  awk -F= -v search_key="${key}" '
    $0 !~ /^[[:space:]]*#/ && $1 == search_key {
      sub(/^[[:space:]]+/, "", $2)
      print substr($0, index($0, "=") + 1)
      exit
    }
  ' "${CONFIG_FILE}"
}

is_truthy() {
  local value="${1:-}"
  value="$(printf '%s' "${value}" | tr '[:upper:]' '[:lower:]')"
  [[ "${value}" == "1" || "${value}" == "true" || "${value}" == "yes" || "${value}" == "ja" ]]
}

validate_pg_identifier() {
  local value="$1"
  [[ "${value}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

sql_literal_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

ensure_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Bitte als root oder mit sudo ausführen."
    exit 1
  fi
}

ensure_supported_os() {
  if [[ ! -f /etc/os-release ]]; then
    echo "Konnte Betriebssystem nicht erkennen."
    exit 1
  fi

  # shellcheck disable=SC1091
  source /etc/os-release

  case "${ID:-}" in
    debian|ubuntu)
      ;;
    *)
      echo "Dieses Installationsskript unterstützt aktuell Debian und Ubuntu."
      exit 1
      ;;
  esac
}

generate_secret() {
  head -c 32 /dev/urandom 2>/dev/null | base64 | tr -d '=+/' | cut -c1-43 || true
}

prepare_config() {
  local app_port app_ip app_url app_secret

  app_port="3000"
  app_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  app_ip="${app_ip:-127.0.0.1}"
  app_url="http://${app_ip}:${app_port}"
  app_secret="$(generate_secret)"
  app_secret="${app_secret:-auto}"

  printf '\n[kistaro-installer] Willkommen bei Kistaro.\n'
  printf '[kistaro-installer] Dieses Passwort wird für App-Freigabe und lokale Datenbank verwendet.\n'
  printf '[kistaro-installer] Danach läuft die Installation ohne weitere Eingaben weiter.\n'

  if [[ -z "${INSTANCE_PASSWORD}" ]]; then
    printf '[kistaro-installer] Passwort für App und Datenbank: '
    IFS= read -r -s INSTANCE_PASSWORD
    printf '\n'
  fi

  if [[ -z "${INSTANCE_PASSWORD}" ]]; then
    echo "[kistaro-installer] Passwort darf nicht leer sein."
    exit 1
  fi

  start_step "Instanz-Konfiguration wird vorbereitet"
  cat > "${CONFIG_FILE}" <<EOF
# Kistaro Instanz-Konfiguration
# Automatisch vom Installer erzeugt. Für die Erstinstallation muss nichts
# manuell angepasst werden.
APP_NAME=Kistaro
APP_BASE_URL=${app_url}
APP_BIND_HOST=0.0.0.0
APP_PORT=${app_port}

POSTGRES_DB=kistaro
POSTGRES_USER=kistaro
POSTGRES_PASSWORD=${INSTANCE_PASSWORD}
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
DATABASE_URL=

INVENTORY_STORAGE_DIR=storage
INVENTORY_APP_PASSWORD=${INSTANCE_PASSWORD}
INVENTORY_APP_SECRET=${app_secret}
INVENTORY_UPDATE_REPOSITORY=NHUF/kistaro
INVENTORY_UPDATE_TOKEN=
INVENTORY_BACKUP_DIR=storage/backups

NODE_MAJOR=22
INSTALL_SYSTEM_SERVICE=true
SYSTEMD_SERVICE_NAME=kistaro
SYSTEMD_SERVICE_USER=root
AUTO_REBOOT_AFTER_INSTALL=false
EOF
  done_step
}

install_system_packages() {
  export DEBIAN_FRONTEND=noninteractive
  run_quiet "Paketlisten werden aktualisiert" apt-get update -qq
  run_quiet "System wird aktualisiert" apt-get upgrade -y -qq
  run_quiet "Grundpakete werden installiert" apt-get install -y -qq ca-certificates curl git build-essential postgresql postgresql-client rsync
}

install_node() {
  local configured_major
  configured_major="$(read_config_value "NODE_MAJOR")"
  configured_major="${configured_major:-22}"

  if command -v node >/dev/null 2>&1; then
    local installed_major
    installed_major="$(node -p 'process.versions.node.split(".")[0]')"

    if [[ "${installed_major}" == "${configured_major}" ]]; then
      start_step "Node.js ${configured_major} ist bereits vorhanden"
      done_step
      return
    fi
  fi

  run_quiet "Node.js ${configured_major} Quelle wird vorbereitet" bash -c "curl -fsSL 'https://deb.nodesource.com/setup_${configured_major}.x' | bash -"
  run_quiet "Node.js ${configured_major} wird installiert" apt-get install -y -qq nodejs
}

write_project_config() {
  run_quiet "Projektkonfiguration wird geschrieben" bash -c "cd '${PROJECT_ROOT}' && SETUP_CONFIG_ONLY=true npm run --silent setup:instance"
}

prepare_node_modules() {
  if [[ -d "${PROJECT_ROOT}/node_modules" ]]; then
    run_quiet "Alte node_modules werden entfernt" rm -rf "${PROJECT_ROOT}/node_modules"
  fi

  run_quiet "Node-Abhängigkeiten werden installiert" bash -c "cd '${PROJECT_ROOT}' && npm install --silent"
  chmod +x "${PROJECT_ROOT}/node_modules/.bin/next" "${PROJECT_ROOT}/node_modules/next/dist/bin/next" 2>/dev/null || true
}

postgres_as_admin() {
  runuser -u postgres -- "$@"
}

prepare_postgres() {
  local database_name database_user database_password escaped_password

  database_name="$(read_config_value "POSTGRES_DB")"
  database_name="${database_name:-kistaro}"
  database_user="$(read_config_value "POSTGRES_USER")"
  database_user="${database_user:-kistaro}"
  database_password="$(read_config_value "POSTGRES_PASSWORD")"
  database_password="${database_password:-kistaro}"

  if ! validate_pg_identifier "${database_name}" || ! validate_pg_identifier "${database_user}"; then
    echo "POSTGRES_DB und POSTGRES_USER dürfen aktuell nur Buchstaben, Zahlen und Unterstriche enthalten und nicht mit einer Zahl beginnen."
    exit 1
  fi

  escaped_password="$(sql_literal_escape "${database_password}")"

  run_quiet "PostgreSQL wird gestartet" systemctl restart postgresql
  run_quiet "PostgreSQL Autostart wird aktiviert" systemctl enable postgresql

  start_step "PostgreSQL Benutzer wird vorbereitet"
  if postgres_as_admin psql --quiet --set=ON_ERROR_STOP=1 >>"${LOG_FILE}" 2>&1 <<SQL
do \$\$
begin
  if not exists (select 1 from pg_roles where rolname = '${database_user}') then
    create role "${database_user}" login password '${escaped_password}';
  else
    alter role "${database_user}" with login password '${escaped_password}';
  end if;
end
\$\$;
SQL
  then
    done_step
  else
    fail_step "PostgreSQL Benutzer wird vorbereitet"
    exit 1
  fi

  start_step "PostgreSQL Datenbank wird leer neu erstellt"
  if postgres_as_admin psql --quiet --set=ON_ERROR_STOP=1 >>"${LOG_FILE}" 2>&1 <<SQL
select pg_terminate_backend(pid)
from pg_stat_activity
where datname = '${database_name}' and pid <> pg_backend_pid();
SQL
  then
    if postgres_as_admin dropdb --if-exists "${database_name}" >>"${LOG_FILE}" 2>&1 &&
      postgres_as_admin createdb --owner "${database_user}" "${database_name}" >>"${LOG_FILE}" 2>&1
    then
      done_step
    else
      fail_step "PostgreSQL Datenbank wird leer neu erstellt"
      exit 1
    fi
  else
    fail_step "PostgreSQL Datenbank wird leer neu erstellt"
    exit 1
  fi
}

build_project() {
  run_quiet "Lokales PostgreSQL-Schema wird angewendet" bash -c "cd '${PROJECT_ROOT}' && npm run --silent db:setup"
  run_quiet "Produktions-Build wird erstellt" bash -c "cd '${PROJECT_ROOT}' && npm run --silent build"
}

write_summary() {
  local app_url service_name service_user

  app_url="$(read_config_value "APP_BASE_URL")"
  service_name="$(read_config_value "SYSTEMD_SERVICE_NAME")"
  service_name="${service_name:-kistaro}"
  service_user="$(read_config_value "SYSTEMD_SERVICE_USER")"
  service_user="${service_user:-root}"

  cat > "${SUMMARY_FILE}" <<EOF
Kistaro Instanz
===============
URL: ${app_url}
Passwort: $(read_config_value "INVENTORY_APP_PASSWORD")
Service: ${service_name}
Service-User: ${service_user}
Projektpfad: ${PROJECT_ROOT}
Umgebungsdatei: ${ENV_FILE}
Logdatei: ${LOG_FILE}
EOF
}

install_systemd_service() {
  local install_service service_name service_user npm_path service_file

  install_service="$(read_config_value "INSTALL_SYSTEM_SERVICE")"

  if [[ -n "${install_service}" ]] && ! is_truthy "${install_service}"; then
    start_step "Systemdienst ist deaktiviert"
    done_step
    return
  fi

  service_name="$(read_config_value "SYSTEMD_SERVICE_NAME")"
  service_name="${service_name:-kistaro}"
  service_user="$(read_config_value "SYSTEMD_SERVICE_USER")"
  service_user="${service_user:-root}"
  npm_path="$(command -v npm)"
  service_file="/etc/systemd/system/${service_name}.service"

  start_step "Systemdienst ${service_name} wird eingerichtet"
  cat > "${service_file}" <<EOF
[Unit]
Description=Kistaro
After=network.target postgresql.service

[Service]
Type=simple
User=${service_user}
WorkingDirectory=${PROJECT_ROOT}
Environment=NODE_ENV=production
EnvironmentFile=${ENV_FILE}
ExecStart=/bin/sh -lc '${npm_path} run start -- --hostname "\${APP_BIND_HOST:-0.0.0.0}" --port "\${APP_PORT:-3000}"'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  if systemctl daemon-reload >>"${LOG_FILE}" 2>&1 &&
    systemctl enable "${service_name}" >>"${LOG_FILE}" 2>&1 &&
    systemctl restart "${service_name}" >>"${LOG_FILE}" 2>&1
  then
    done_step
  else
    fail_step "Systemdienst ${service_name} wird eingerichtet"
    exit 1
  fi
}

handle_reboot() {
  local auto_reboot
  auto_reboot="$(read_config_value "AUTO_REBOOT_AFTER_INSTALL")"

  if [[ -f /var/run/reboot-required ]] && is_truthy "${auto_reboot}"; then
    log "Systemneustart wird ausgelöst"
    reboot
  fi
}

finish_progress() {
  STEP_INDEX="${TOTAL_STEPS}"
  printf '\n%s Installation abgeschlossen\n' "$(progress_prefix)"
}

main() {
  : >"${LOG_FILE}"
  ensure_root
  ensure_supported_os
  prepare_config
  install_system_packages
  install_node
  write_project_config
  prepare_node_modules
  prepare_postgres
  build_project
  install_systemd_service
  write_summary
  handle_reboot

  finish_progress
  log "Die wichtigsten Zugangsdaten stehen in ${SUMMARY_FILE}"
}

main "$@"
