## What changed

<!-- One or two sentences. For a fix, the root cause, not the symptom. -->

## Why

## How to review

<!-- Where to start reading, which file is the real change, what can be skipped. -->

## Checks

- [ ] `npm run typecheck`, `npm run lint` and `npm test` pass locally
- [ ] A schema change comes alone, with its migration
- [ ] A new Server Action starts with `requireRole(...)` (or `publicRateLimit(...)`)
- [ ] Touches money, security or the schema: said so above

## Deploy notes

<!-- New environment variables, migrations, anything to do by hand. "None" is an answer. -->
