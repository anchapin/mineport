# Repository Guidelines

## Project Structure & Module Organization
- TypeScript sources live in `src/`; conversion stages under `modules/`, orchestration in `services/`, HTTP endpoints in `api/`, and shared helpers in `types/` and `utils/`.
- Build artifacts emit to `dist/`; automation scripts reside in `scripts/`, config templates in `config/` and `security-config/`, and docs or runnable samples under `docs/` and `examples/`.
- Tests sit in `tests/` grouped by suite (`unit`, `integration`, `security`, `benchmark`, `deployment`) with fixtures in `tests/fixtures/`; reuse them before adding new data.

## Build, Test, and Development Commands
- `npm install` - install dependencies.
- `npm run dev` - start the ts-node-dev loop for local iteration.
- `npm run build` - compile TypeScript to `dist/`.
- `npm start` - execute the compiled entrypoint.
- `npm test`, `npm run test:unit`, `npm run test:integration`, `npm run test:coverage` - run the Vitest suites and enforce coverage thresholds.
- `npm run lint`, `npm run lint:fix`, `npm run format` - apply ESLint and Prettier rules; run before commits.

## Coding Style & Naming Conventions
- Enforce strict TypeScript: resolve `tsc` warnings and document intentional `any` usage.
- Formatting uses Prettier defaults: two space indentation, single quotes, and repository lint rules.
- Naming: PascalCase for types and classes, camelCase for variables and functions, UPPER_SNAKE_CASE for constants; prefer one primary export per file.

## Testing Guidelines
- Vitest drives all specs; name files `*.test.ts` inside the matching suite directory.
- Add unit coverage for new logic and integration tests when workflows cross modules; verify with `npm run test:coverage` before review.
- Extend shared fixtures in `tests/fixtures/` instead of embedding sample data inside `src/`.

## Commit & Pull Request Guidelines
- Follow Conventional Commits such as `fix(transpiler): handle biome registry gap`.
- Scope branches by intent (`feature/...`, `fix/...`, `docs/...`).
- Pull requests should summarize intent, list verification commands run, link related issues, and attach artifacts (logs, screenshots) when behavior changes.

## Security & Configuration Tips
- Keep secrets in untracked `.env` files; never commit credentials.
- Before releases, run `npm run security:audit`, `npm run security:scan`, `npm run test:pre-deploy`, and verify health with `npm run health:check` or `npm run config:validate`.
- Update `security-config/` policies whenever API contracts or dependencies change, and confirm health endpoints before deploying.
