# chronos-backend

NestJS backend playground for a coworking “smart calendar”: bookings, Google integrations, weather, auth, and observability.

## Features (current)

- MongoDB + Redis via `docker-compose.yml`
- Request metrics + dev-only `GET /stats`
- Full request logging to Mongo (`request_logs`)
- Coverage summary on `/stats` + full HTML report on `/_coverage/` (dev-only)

## Requirements

- Node.js 22+
- Docker (for Mongo/Redis)

## Quick start

```bash
npm install
cp .env.example .env
docker compose up -d
npm run start:dev
```

- API: `http://localhost:3000/`
- Stats (dev only): `http://localhost:3000/stats`

## Tests + coverage

```bash
npm test
npm run test:e2e
npm run test:cov
```

- HTML report (dev only): `http://localhost:3000/_coverage/`

## Environment

See `.env.example`.

## Devlog / ADR

- Devlog: `docs/devlog/`
- ADR: `docs/adr/`
