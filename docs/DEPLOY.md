# Deploying Voltio for a client

One deployment is one shop: a small VPS with Docker is enough. Nothing here
depends on a specific cloud provider.

## First deploy

```bash
cp .env.example .env
```

Set, at minimum:

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `APP_ORIGIN` | The public URL, for example `https://taller.example.com` |
| `DEMO_MODE` | `0` |
| `SMTP_*`, `MAIL_FROM_*` | A real SMTP provider (see below) |

```bash
docker compose up -d --build db migrate app worker
docker compose run --rm migrate npm run owner:create -- "Owner Name" owner@example.com
```

The second command prints the owner's temporary password once. Do not run the
seed: it loads the fictional shop and its public passwords. On a real server,
remove from `docker-compose.yml` the `mailhog` service, the worker's
`depends_on` entry for it, and the `SEED_CONFIRM` line.

Then sign in at `/admin/login` and fill in **Ajustes**: name, address, hours,
services, tax rate, warranty days and the receipt's terms.

## Reverse proxy and HTTPS

The app listens on plain HTTP (`APP_PORT`, 3100 by default). Put Caddy or
nginx in front of it for TLS. Two things matter:

- **The proxy must overwrite `x-forwarded-for`**, not append to whatever the
  client sent. Caddy does by default; nginx needs
  `proxy_set_header X-Forwarded-For $remote_addr;`. The rate limits and the
  address recorded with a quote approval read that header from the right
  (`lib/security/client-ip.ts`), counting `TRUSTED_PROXY_COUNT` proxies.
- **Do not expose the app's port directly** once a proxy is in front: bind it
  to localhost (`127.0.0.1:3100:3000` in the compose file). Otherwise a
  request that skips the proxy brings its own `x-forwarded-for`.

A minimal Caddyfile:

```
taller.example.com {
  reverse_proxy 127.0.0.1:3100
}
```

## Email

The worker sends through any SMTP server. With a real provider set `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM_EMAIL` (an address on a
domain with SPF and DKIM configured for that provider) and `SMTP_SECURE=1`
for port 465. A failed email is retried five times with backoff and then
marked `FAILED` with the error, in the `Notification` table.

Not verified end to end against a real provider yet: only against MailHog.

## Updating

```bash
git pull
docker compose up -d --build db migrate app worker
```

`migrate` applies new migrations and exits before `app` and `worker` restart.

## Backups

Two things hold state: the `pgdata` volume and the `media` volume (photos).

```bash
docker compose exec db pg_dump -U voltio voltio | gzip > voltio-$(date +%F).sql.gz
```

Scheduled, encrypted, off-site backups with a tested restore are not part of
this repository yet.

## Health

`GET /api/health` answers `200 {"status":"ok"}` when the app can reach its
database, `503` otherwise. The compose healthcheck uses it.
