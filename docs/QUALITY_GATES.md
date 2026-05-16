# Quality Gates and Workflow Compliance (Bot)

This repository now enforces the global workflow with automated gates.

## Implemented gates

1. `npm run lint`
   - Syntax lint over JS/MJS/CJS files.

2. `npm run typecheck`
   - Structural i18n consistency check for critical help keys in `es` and `en`.

3. `npm test`
   - Unit/regression suite.

4. `npm run test:integration`
   - Integration test for `music-memory` service (`health`, ingest event, top stats).

5. `npm run build`
   - Build artifact check (required runtime/docs files present).

## CI pipeline

Workflow: `.github/workflows/ci-quality-gates.yml`

Triggers:
- Push to `main` and `develop`
- Pull requests to `main` and `develop`

## Deployment gate policy

A deployment must not proceed if any gate fails:
- lint
- typecheck
- unit tests
- integration tests
- build check

## Rollback baseline

If production issue occurs:
1. identify failing commit
2. rollback container image/commit
3. re-run full gate suite
4. deploy controlled fix
