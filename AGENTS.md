# AGENTS.md

## Project workflow rules

- Always work from the latest main branch.
- Never commit directly to main.
- Create a dedicated feature/fix branch for each change.
- Open a Pull Request into main.
- Do not merge if CI Quality Gates fail.
- Do not use --allow-unrelated-histories.
- Do not force push to main.
- Keep PRs small and focused.
- Do not mix bugfix, refactor, and new feature unless explicitly requested.

## Required commands before PR

Run when applicable:

- npm ci
- npm run lint
- npm run typecheck
- npm test
- npm run test:integration
- npm run build

If any command is unavailable, report it clearly and do not pretend it passed.

## CI workflow

The repository uses:

.github/workflows/quality-gates.yml

The workflow validates:

- Node.js 20
- npm ci
- lint
- typecheck
- unit tests
- integration tests
- build

If the workflow uses cache: npm, package-lock.json must exist and be versioned in Git.
Use:

cache-dependency-path: package-lock.json

## Debugging process

Before fixing a bug:

1. Reproduce the issue.
2. Identify affected files.
3. Form 2-3 hypotheses.
4. Confirm the root cause.
5. Apply the smallest safe fix.
6. Add or update tests if possible.
7. Run quality gates.
8. Summarize cause, fix, and risk.

## Refactoring rules

- Do not change external behavior unless requested.
- Separate controllers/routes, application/use cases, domain logic, and infrastructure.
- Extract reusable functions/classes when code is duplicated or too large.
- Keep modules cohesive and low-coupled.
- Add tests around behavior before large refactors.

## Pull Request summary format

Every PR should include:

- Problem
- Root cause
- Solution
- Files changed
- Tests/checks run
- Risks
- Rollback plan

## Safety rules

- Do not modify secrets.
- Do not commit .env files.
- Do not expose tokens or credentials.
- Do not delete files unless the reason is explicit.
- Ask before making destructive changes.
