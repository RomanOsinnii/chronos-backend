# Contributing

## Setup

```bash
npm install
cp .env.example .env
docker compose up -d
```

## Development

```bash
npm run start:dev
```

## Testing

```bash
npm test
npm run test:e2e
npm run test:cov
```

## PR rules

- `main` must stay green (CI).
- Keep PRs small and focused.
- Add/adjust tests for behavior changes.

