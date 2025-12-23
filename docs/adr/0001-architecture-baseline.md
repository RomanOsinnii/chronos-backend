# ADR-0001 — Architecture baseline

## Status

Accepted

## Context

We need a backend that can be evolved iteratively: domain logic + integrations (Google/Weather) + observability + security.

## Decision

- NestJS as the web framework
- MongoDB as primary storage (events/logs/booking data)
- Redis for cache/coordination
- Integrations via adapters (ports/adapters) to keep them testable/mocked

## Consequences

- High test coverage focused on domain/adapters
- Local infra via `docker compose`
