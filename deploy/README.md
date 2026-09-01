# FIN Control deployment

This deployment runs the Next.js application directly on the server. It does not use Docker. The application listens only on `127.0.0.1:4010`; Nginx terminates public HTTP/HTTPS traffic for `fin.aplusict.lk` and proxies it to the application.

## One-time server setup

Run these commands on the server as a sudo-capable administrator. They install the service and Nginx site; do not copy the repository `.env` file to source control.

```bash
sudo install -d -o mdev -g mdev /srv/fin-app
sudo -u mdev git clone https://github.com/warrwijesinghe/my-fin-app.git /srv/fin-app
sudo cp /srv/fin-app/deploy/systemd/fin-app.service /etc/systemd/system/fin-app.service
sudo cp /srv/fin-app/deploy/nginx/fin.aplusict.lk.conf /etc/nginx/sites-available/fin.aplusict.lk.conf
sudo ln -s /etc/nginx/sites-available/fin.aplusict.lk.conf /etc/nginx/sites-enabled/fin.aplusict.lk.conf
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable fin-app
sudo systemctl restart nginx
```

Create `/srv/fin-app/.env` directly on the server using the values required by `.env.example`, then protect it:

```bash
sudo -u mdev touch /srv/fin-app/.env
sudo chown mdev:mdev /srv/fin-app/.env
sudo chmod 600 /srv/fin-app/.env
sudoedit /srv/fin-app/.env
```

The GitHub deployment user must be allowed to restart only this service without a password. Create `/etc/sudoers.d/fin-app-deploy` with:

```sudoers
mdev ALL=(root) NOPASSWD: /bin/systemctl restart fin-app
```

Validate it with `sudo visudo -cf /etc/sudoers.d/fin-app-deploy`.

## HTTPS

After DNS for `fin.aplusict.lk` points to this server and Nginx is serving the HTTP site, issue the certificate:

```bash
sudo certbot --nginx -d fin.aplusict.lk
```

Certbot updates the Nginx site with the HTTPS listener and renewal settings. Confirm the result with:

```bash
curl --fail --silent --show-error https://fin.aplusict.lk/api/health
```

## GitHub Actions deployment

The workflow runs on pushes to `main` and when started manually from GitHub Actions. Configure these repository secrets:

- `MDEV_HOST`
- `MDEV_USER`
- `MDEV_SSH_PORT`
- `MDEV_SSH_KEY`

The server checkout at `/srv/fin-app` must have an `origin` remote that can fetch the `main` branch. Each deployment preserves `/srv/fin-app/.env`, installs locked dependencies with `npm ci`, runs `npm run db:migrate` only when that script exists, builds the app, restarts `fin-app`, and checks `http://127.0.0.1:4010/api/health`.

## Operational commands

```bash
sudo systemctl status fin-app
sudo journalctl -u fin-app -f
sudo systemctl restart fin-app
curl --fail --silent --show-error http://127.0.0.1:4010/api/health
sudo nginx -t && sudo systemctl reload nginx
```
