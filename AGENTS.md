# Repository Guidelines

## Project Structure & Module Organization
Core TypeScript code sits in `src/`: `modules/` for conversion stages, `services/` for orchestration, `api/` for Express endpoints, and shared helpers in `types/` and `utils/`. Builds compile to `dist/`. Automation lives in `scripts/` (deploy, docs, migrations, security). Config templates inhabit `config/` and `security-config/`. Tests live in `tests/` with unit, integration, security, benchmark, deployment suites plus fixtures and mocks. Supplemental references are under `docs/`; runnable flows and CLI samples reside in `examples/`.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Run `npm run dev` for a ts-node-dev loop, `npm run build` to emit JavaScript, and `npm start` to execute the compiled entrypoint. Primary validation commands: `npm test`, `npm run test:unit`, `npm run test:integration`, and `npm run test:coverage`. Lint and formatting checks run via `npm run lint`, `npm run lint:fix`, and `npm run format`. Install pre-commit hooks with `npm run hooks:install` when onboarding.

## Coding Style & Naming Conventions
The repo enforces strict TypeScript; address every `tsc` warning before pushing and document any intentional `any`. Prettier uses two-space indentation and single quotes—avoid manual adjustments. Follow naming conventions in `CONTRIBUTING.md`: PascalCase for types and classes, camelCase for functions and variables, UPPER_SNAKE_CASE for constants. Keep one primary export per file and align folder names with their module namespace.

## Testing Guidelines
Vitest drives all automated testing. Store specs in the matching suite folder, ending filenames with `.test.ts`. New logic needs unit coverage and an integration spec when cross-module behavior shifts. Reuse fixtures from `tests/fixtures/`; extend them instead of committing sample data to `src/`. Run `npm run test:coverage` before feature branches exit review and track thresholds enforced by CI.

## Commit & Pull Request Guidelines
Commits follow Conventional Commits, e.g. `fix(transpiler): handle biome registry gap`. Branch names mirror effort (`feature/...`, `fix/...`, `docs/...`). Pull requests should summarize intent, list verification commands, link related issues, and attach artifacts (screenshots, JSON samples) when outputs change. Keep PR scope small, update relevant docs or configs, and ensure CI passes before requesting review.

## Security & Configuration Tips
Secrets stay in untracked `.env` files. Run `npm run security:audit` and `npm run security:scan` on release-bound work. Update `security-config/` policies when dependency surface or API contracts shift. Before deploying, execute `npm run test:pre-deploy` and verify health endpoints with `npm run health:check` or `npm run config:validate`.
