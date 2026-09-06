#!/usr/bin/env bash
set -Eeuo pipefail

# Parse the function before git pull updates this script on disk.
main() {
  local stage='preflight'
  trap 'printf "[deploy] ERROR: %s failed (line %s, exit %s). Deployment stopped.\n" "$stage" "$LINENO" "$?" >&2' ERR
  trap 'printf "[deploy] ERROR: Deployment interrupted during %s.\n" "$stage" >&2; exit 130' INT
  trap 'printf "[deploy] ERROR: Deployment terminated during %s.\n" "$stage" >&2; exit 143' TERM

  export PATH='/home/ubuntu/.nvm/versions/node/v22.23.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
  export GIT_TERMINAL_PROMPT=0
  umask 077
  fail() { printf '[deploy] ERROR: %s\n' "$1" >&2; exit 1; }
  log() { printf '[deploy] %s\n' "$1"; }

  [[ "$(id -un)" == ubuntu ]] || fail 'Run this script as ubuntu.'
  cd /srv/fin-app || fail 'Cannot enter /srv/fin-app.'
  local command_name
  for command_name in git flock node npm curl sudo; do
    command -v "$command_name" >/dev/null || fail "Required command is missing: $command_name."
  done
  [[ -x /home/ubuntu/.nvm/versions/node/v22.23.2/bin/node &&
     -x /home/ubuntu/.nvm/versions/node/v22.23.2/bin/npm ]] || fail 'The configured NVM Node/npm installation is missing.'
  [[ "$(node --version)" == v22.23.2 ]] || fail 'Node v22.23.2 is required.'
  [[ -d .git ]] || fail 'Expected an existing Git checkout with a .git directory.'

  # Keep the lock inode in place; the descriptor is released on exit.
  exec 9>>.git/fin-app-deploy.lock
  flock -n 9 || fail 'Another deployment holds the lock; retry after it finishes.'

  [[ -f .env && -r .env ]] || fail 'The existing server .env is missing or unreadable.'
  if git ls-files --error-unmatch -- .env >/dev/null 2>&1; then
    fail 'The server .env must never be tracked by Git.'
  fi
  git check-ignore -q -- .env || fail 'The server .env must be ignored by Git.'
  [[ "$(git branch --show-current)" == main ]] || fail 'The server checkout must be on main.'
  git diff --quiet --ignore-submodules -- || fail 'Tracked server files have local changes; resolve them before deploying.'
  git diff --cached --quiet --ignore-submodules -- || fail 'The server index has staged changes; resolve them before deploying.'

  stage='fetch origin/main'
  log 'Fetching origin/main.'
  git fetch origin main >/dev/null 2>&1
  local tracked_environment
  tracked_environment="$(git ls-tree -r --name-only origin/main -- .env)"
  [[ -z "$tracked_environment" ]] || fail 'origin/main tracks .env; refusing to update the checkout.'
  git merge-base --is-ancestor HEAD origin/main || fail 'Server main has local-only commits or has diverged; manual reconciliation is required.'

  stage='fast-forward main'
  git pull --ff-only origin main >/dev/null 2>&1

  # Suppress tools that load production configuration to avoid logging secrets.
  stage='npm ci'
  log 'Installing locked dependencies.'
  npm ci --include=dev >/dev/null 2>&1

  stage='migration command detection'
  local has_migration
  has_migration="$(node -e 'const p = require("./package.json"); console.log(typeof p.scripts?.["db:migrate"] === "string" && p.scripts["db:migrate"].trim() ? "yes" : "no")')"
  if [[ "$has_migration" == yes ]]; then
    stage='npm run db:migrate'
    log 'Applying production schema migrations.'
    npm run db:migrate >/dev/null 2>&1
  else
    log 'No db:migrate command exists; skipping migrations.'
  fi

  stage='npm run build'
  log 'Building the production application.'
  npm run build >/dev/null 2>&1

  stage='restart fin-app'
  log 'Restarting fin-app.'
  sudo -n /usr/bin/systemctl restart fin-app >/dev/null 2>&1

  stage='health check'
  log 'Waiting for application and database health.'
  sleep 3
  local attempt status
  for attempt in {1..12}; do
    # Do not follow redirects, use proxy environment variables, or print bodies.
    if status="$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' \
      --connect-timeout 2 --max-time 5 http://127.0.0.1:4010/api/health)" && [[ "$status" == 200 ]]; then
      log 'Deployment succeeded; health endpoint returned HTTP 200.'
      return 0
    fi
    if (( attempt < 12 )); then sleep 2; fi
  done
  fail 'Health endpoint did not return HTTP 200 within the retry window. Inspect fin-app on the server; no automatic rollback was attempted.'
}

main "$@"
