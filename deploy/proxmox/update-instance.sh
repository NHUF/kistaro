#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/update.log"
ENV_FILE="${PROJECT_ROOT}/.env.local"
TARGET_TAG="${INVENTORY_UPDATE_TARGET_TAG:-}"
TARBALL_URL="${INVENTORY_UPDATE_TARBALL_URL:-}"
SERVICE_NAME="${SYSTEMD_SERVICE_NAME:-kistaro}"
STATUS_FILE="${INVENTORY_UPDATE_STATUS_FILE:-${PROJECT_ROOT}/storage/update-status.json}"
TOTAL_STEPS=6
STEP_INDEX=0

log() {
  printf '[kistaro-update] %s\n' "$1" | tee -a "${LOG_FILE}"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_status() {
  local state="$1"
  local message="$2"
  local progress="$3"
  local finished_at="${4:-null}"
  local escaped_message escaped_target started_at

  mkdir -p "$(dirname "${STATUS_FILE}")"
  escaped_message="$(json_escape "${message}")"
  escaped_target="$(json_escape "${TARGET_TAG:-}")"
  started_at="$(date -Is)"

  if [[ -f "${STATUS_FILE}" ]]; then
    started_at="$(grep -o '"startedAt"[[:space:]]*:[[:space:]]*"[^"]*"' "${STATUS_FILE}" | head -n1 | sed 's/.*: *"//; s/"$//' || true)"
    started_at="${started_at:-$(date -Is)}"
  fi

  cat > "${STATUS_FILE}" <<EOF
{
  "state": "${state}",
  "targetTag": "${escaped_target}",
  "message": "${escaped_message}",
  "progress": ${progress},
  "startedAt": "${started_at}",
  "finishedAt": ${finished_at}
}
EOF
}

fail() {
  local progress=$(( STEP_INDEX * 100 / TOTAL_STEPS ))
  write_status "failed" "$1" "${progress}" "\"$(date -Is)\""
  log "Fehler: $1"
  exit 1
}

run_step() {
  local message="$1"
  shift

  STEP_INDEX=$(( STEP_INDEX + 1 ))
  local progress=$(( STEP_INDEX * 100 / TOTAL_STEPS ))
  write_status "running" "${message}" "${progress}" "null"
  log "${message}"

  if "$@" >>"${LOG_FILE}" 2>&1; then
    log "erledigt"
    return 0
  fi

  tail -n 80 "${LOG_FILE}" || true
  fail "${message}"
}

load_env_file() {
  if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
  fi

  SERVICE_NAME="${SYSTEMD_SERVICE_NAME:-${SERVICE_NAME}}"
}

validate_input() {
  if [[ -z "${TARGET_TAG}" ]]; then
    fail "INVENTORY_UPDATE_TARGET_TAG fehlt."
  fi

  if [[ -z "${TARBALL_URL}" ]]; then
    fail "INVENTORY_UPDATE_TARBALL_URL fehlt."
  fi
}

download_release() {
  WORK_DIR="$(mktemp -d)"
  ARCHIVE_PATH="${WORK_DIR}/release.tar.gz"
  EXTRACT_DIR="${WORK_DIR}/extract"
  AUTH_ARGS=()

  mkdir -p "${EXTRACT_DIR}"

  if [[ -n "${INVENTORY_UPDATE_TOKEN:-}" ]]; then
    AUTH_ARGS=(-H "Authorization: Bearer ${INVENTORY_UPDATE_TOKEN}")
  fi

  run_step "Release ${TARGET_TAG} wird geladen" \
    curl -fsSL "${AUTH_ARGS[@]}" "${TARBALL_URL}" -o "${ARCHIVE_PATH}"
  run_step "Release ${TARGET_TAG} wird entpackt" \
    tar -xzf "${ARCHIVE_PATH}" -C "${EXTRACT_DIR}" --strip-components=1
}

sync_release() {
  run_step "Programmdateien werden aktualisiert" \
    rsync -a --delete \
      --exclude ".env.local" \
      --exclude ".next" \
      --exclude "node_modules" \
      --exclude "storage" \
      --exclude "install-config.txt" \
      --exclude "instance-summary.txt" \
      --exclude "install.log" \
      --exclude "update.log" \
      "${EXTRACT_DIR}/" "${PROJECT_ROOT}/"
}

build_release() {
  run_step "Node-Abhängigkeiten werden aktualisiert" \
    bash -c "cd '${PROJECT_ROOT}' && npm install --silent"
  chmod +x "${PROJECT_ROOT}/node_modules/.bin/next" "${PROJECT_ROOT}/node_modules/next/dist/bin/next" 2>/dev/null || true

  run_step "Sichere Datenbank-Migrationen werden geprüft" \
    bash -c "cd '${PROJECT_ROOT}' && npm run --silent db:migrate"
  run_step "Produktions-Build wird erstellt" \
    bash -c "cd '${PROJECT_ROOT}' && npm run --silent build"
}

restart_service() {
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "${SERVICE_NAME}.service" >/dev/null 2>&1; then
    run_step "Systemdienst ${SERVICE_NAME} wird neu gestartet" systemctl restart "${SERVICE_NAME}"
    return
  fi

  log "Systemdienst ${SERVICE_NAME} wurde nicht gefunden. Bitte App manuell neu starten."
}

cleanup() {
  if [[ -n "${WORK_DIR:-}" && -d "${WORK_DIR}" ]]; then
    rm -rf "${WORK_DIR}"
  fi
}

trap cleanup EXIT

main() {
  : >"${LOG_FILE}"
  load_env_file
  validate_input
  log "Update auf ${TARGET_TAG} startet"
  write_status "running" "Update auf ${TARGET_TAG} startet" 5 "null"
  log "Vorheriges Backup: ${INVENTORY_PRE_UPDATE_BACKUP:-nicht bekannt}"
  download_release
  sync_release
  build_release
  restart_service
  write_status "completed" "Update auf ${TARGET_TAG} abgeschlossen." 100 "\"$(date -Is)\""
  log "Update auf ${TARGET_TAG} abgeschlossen"
}

main "$@"
