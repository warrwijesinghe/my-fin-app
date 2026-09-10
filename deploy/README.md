# FIN Control production CI/CD

The existing application runs without Docker at <https://fin.aplusict.lk>.

| Setting | Production value |
| --- | --- |
| Repository / branch | `my-fin-app` / `main` |
| Checkout | `/srv/fin-app` |
| Linux deployment user | `ubuntu` |
| Node/npm directory | `/home/ubuntu/.nvm/versions/node/v22.23.2/bin` |
| Systemd service | `fin-app` |
| Private health endpoint | `http://127.0.0.1:4010/api/health` |
| Existing environment file | `/srv/fin-app/.env` |

The real `.env` stays only on the server. Never commit, overwrite, print, upload,
or copy it, including for backups during deployment. The script checks that it
exists, is readable and ignored, and is absent from the current Git index and
fetched `origin/main`. Only the existing application tools load its values.
No deployment step seeds data or adds sample records.

## Server prerequisites and initial bootstrap

These are instructions for an administrator using an existing trusted console
or session. Repository changes alone do not install the new script in the
already-running server checkout. Do not reinstall the service or Nginx for this
change: the historical `deploy/systemd/fin-app.service` template uses different
user/npm paths and is not the configuration for this existing production setup.

Before the first successful Actions deployment:

1. Ensure `ubuntu` can update `/srv/fin-app`, including `.git`, and read the
   existing `.env`. The checkout must be on `main` with no tracked or staged
   changes and no local-only commits. Keep `.env` ignored and untracked.
2. Ensure Bash, Git, `flock` (util-linux), curl, GNU `timeout`, sudo, and the
   stated NVM Node/npm installation are available. The installed `fin-app`
   service must already use the correct runtime and listen on `127.0.0.1:4010`.
3. Ensure the checkout's `origin` can fetch `main` noninteractively as `ubuntu`.
   Its GitHub authentication is separate from the Actions-to-server SSH key.
4. Authorize a dedicated deployment public key for `ubuntu`. Restrict that key's
   forwarding/PTY capabilities where practical. Store its private counterpart
   only in the GitHub secret described below.
5. Use `sudo visudo -f /etc/sudoers.d/fin-app-deploy` to allow this exact command:

   ```sudoers
   ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart fin-app
   ```

   Validate with `sudo visudo -cf /etc/sudoers.d/fin-app-deploy`. The deployment
   calls `sudo -n`, so missing authorization fails instead of prompting.
6. After this commit reaches `main`, install the script with a reviewed
   fast-forward in the existing checkout. Run as `ubuntu`, with other deployment
   methods paused. Confirm `origin/main` does not track `.env` before pulling:

   ```bash
   (
     set -Eeuo pipefail
     cd /srv/fin-app
     exec 9>>.git/fin-app-deploy.lock
     flock -n 9
     test "$(git branch --show-current)" = main
     git diff --quiet
     git diff --cached --quiet
     test -f .env && test -r .env
     git check-ignore -q -- .env
     if git ls-files --error-unmatch -- .env >/dev/null 2>&1; then exit 1; fi
     git fetch origin main
     test -z "$(git ls-tree -r --name-only origin/main -- .env)"
     git merge-base --is-ancestor HEAD origin/main
     git pull --ff-only origin main
     test -r scripts/deploy-mdev.sh
   )
   ```

   The workflow invokes the script with `/bin/bash`; no chmod or copying is
   required. An initial workflow run before bootstrap will fail with a missing
   script message. Once setup is complete, rerun it or use **Run workflow** on
   `main`.

## GitHub Actions configuration

In the repository's **Settings → Secrets and variables → Actions**, create these
repository secrets. Never paste secret values into workflow YAML or run logs.

| Secret | Value |
| --- | --- |
| `MDEV_HOST` | Server hostname or IP, without scheme or port; use unbracketed IPv6 if applicable |
| `MDEV_USER` | `ubuntu` |
| `MDEV_SSH_PORT` | Actual SSH port as a number, normally `22` |
| `MDEV_SSH_KEY` | Dedicated SSH private key with actual newlines, usable without a passphrase |
| `MDEV_SSH_FINGERPRINT` | Complete `SHA256:...` fingerprint of a trusted server SSH host public key |

Obtain the host fingerprint through the trusted server console or administrator,
for example with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256`.
Set only the `SHA256:...` field, without the bit count, comment, or key type.
ECDSA and RSA host keys are also supported. Do not establish trust from an
unverified network scan. On a legitimate host-key rotation, independently
verify the new fingerprint before updating the secret.

The workflow discovers host public keys with `ssh-keyscan`, computes each
SHA256 fingerprint, and writes only matching keys into a temporary
`known_hosts`. SSH uses strict host checking and this verified file, with system
known-hosts files disabled. A mismatch stops deployment before SSH login. This
follows the [OpenSSH guidance on verifying scanned keys](https://man.openbsd.org/ssh-keyscan).
The private key is written to a restricted temporary file on the ephemeral
runner, never echoed, and removed on exit along with the temporary host-key files.

## Deployment behavior

`.github/workflows/deploy-mdev.yml` runs on pushes to `main` and manual dispatch
on `main`. Other manual refs are skipped. CI uses the production Node version,
checks Bash syntax, installs locked dependencies, runs the existing TypeScript
check (`npm run lint`), and builds without a production environment file or
database access. Only successful CI proceeds to SSH deployment. Actions are
pinned to commit SHAs and repository permissions are read-only.

GitHub Actions serializes production runs without cancelling an active run.
The server script also takes a nonblocking `flock` on
`/srv/fin-app/.git/fin-app-deploy.lock`, covering manual and automated invocations.
A second invocation fails clearly; retry after the active deployment finishes.
Do not delete this lock file while a deployment is running.

The server runs `/bin/bash /srv/fin-app/scripts/deploy-mdev.sh`, which:

1. Validates the runtime, server checkout, and environment-file protections.
2. Saves any tracked working-tree or staged server edits in a timestamped Git
   stash, then runs `git fetch origin main` and `git pull --ff-only origin
   main`. Ignored files, including `.env`, are never stashed or altered. A
   diverged or locally ahead checkout still requires manual reconciliation;
   there is no force checkout, hard reset, or clean. Review preserved edits
   with `git stash list` and `git stash show -p stash@{0}` from `/srv/fin-app`.
3. Runs `npm ci --include=dev` so the build has its TypeScript tools, even when
   `NODE_ENV=production` is inherited.
4. Runs the existing `npm run db:migrate` only if declared in `package.json`.
   This command loads the existing server `.env` and applies pending SQL schema
   migrations, recording them in `_fin_migrations`. It never invokes a seed.
5. Runs `npm run build`, then `sudo -n /usr/bin/systemctl restart fin-app`.
6. Waits three seconds, then attempts the loopback health check up to 12 times,
   with two-second gaps and a five-second request timeout. Only HTTP 200 passes;
   redirects and proxy settings are ignored, and response bodies are discarded.
   The endpoint checks the database as well as the application.

Git, install, migration, build, and restart output is suppressed on the server
to keep configuration values out of Actions logs. Logs report progress and the
failed phase with a nonzero exit status. The remote command is bounded to 20
minutes, followed by a 30-second termination grace period; the Actions deploy
job is bounded to 25 minutes.

The server follows the latest `origin/main` at fetch/pull time, which may be
newer than the revision that started a queued workflow. Manual reruns also
deploy current `main`, not an old workflow revision.

## Failure handling and recovery

Failures stop subsequent steps. A dependency, migration, or build failure does
not restart the service. This is an in-place deployment: installing dependencies
and rebuilding `.next` can affect the running process, so it is not zero downtime
or an atomic release. Database migrations may already have applied when a later
step fails; MySQL DDL can also partially apply within a failed migration.

After a restart or health failure, the workflow stays failed and does not roll
back automatically. An administrator should inspect `fin-app` through a trusted
server session, diagnose the failed phase locally without sharing environment
values, and repair the issue or prepare a reviewed revert on `main`. Database
recovery requires separate consideration; do not blindly replay or reverse SQL.
Rerun the workflow after the checkout and database are ready. Never resolve a
deployment failure by moving, restoring, or copying `.env`.

Useful server-side checks are `sudo systemctl status fin-app`,
`sudo journalctl -u fin-app --since '10 minutes ago'`, and
`curl --fail --silent --output /dev/null http://127.0.0.1:4010/api/health`.
Review diagnostic output locally before sharing it. Manual deployments use
`/bin/bash /srv/fin-app/scripts/deploy-mdev.sh` as `ubuntu` and take the same lock.
