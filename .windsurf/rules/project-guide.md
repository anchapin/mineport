---
trigger: always_on
---

# Mineport Project Guide

## Project Overview
Mineport is a sophisticated tool designed to convert Minecraft Java Edition mods to Bedrock Edition addons. The system leverages AI and specialized conversion strategies to transform Java-based mods into Bedrock-compatible formats while maintaining functionality and performance.

## Repository Structure

### Key Directories
- `src/` - Main source code
  - `api/` - API endpoints and routes
  - `database/` - Database models and migrations
  - `modules/` - Core functionality modules
  - `services/` - Business logic and services
- `tests/` - Test suites
  - `benchmark/` - Performance testing
  - `integration/` - Integration tests
  - `fixtures/` - Test data
- `config/` - Configuration files
- `scripts/` - Utility and build scripts
- `docs/` - Documentation
- `.github/` - GitHub workflows and templates

## Development Setup

### Prerequisites
- Node.js (version specified in .nvmrc)
- pnpm (package manager)
- Python (version specified in .python-version)

### Installation
1. Clone the repository
2. Run `pnpm install` to install dependencies
3. Configure environment variables (refer to `.env.example`)

### Development Workflow
- Use `pnpm dev` to start the development server
- Run `pnpm test` to execute tests
- Use `pnpm lint` to check code style
- Run `pnpm build` to create a production build

## Coding Standards

### TypeScript/JavaScript
- Follow the ESLint and Prettier configurations
- Use TypeScript types strictly
- Write JSDoc comments for public APIs
- Follow the repository's existing naming conventions

### Testing
- Write unit tests for all new features
- Include integration tests for critical paths
- Maintain test coverage above 80%
- Use Vitest for testing

### Git Workflow
1. Create a feature branch from `main`
2. Make atomic commits with clear messages
3. Open a pull request for review
4. Ensure all tests pass before merging

## Build and Deployment

### Building
- Run `pnpm build` to create production artifacts
- The output will be in the `dist/` directory

### Deployment
- Follow the CI/CD pipeline in `.github/workflows/`
- Ensure all tests pass before deployment
- Follow semantic versioning for releases

## Contributing

### Issue Reporting
- Search existing issues before creating a new one
- Provide detailed reproduction steps
- Include relevant logs and screenshots

### Pull Requests
- Reference related issues in your PR
- Keep changes focused and small
- Include tests for new features
- Update documentation as needed

## Security

### Reporting Vulnerabilities
- Report security issues to the maintainers
- Follow the security policy in SECURITY.md
- Never include sensitive information in issues or PRs

### Secure Coding
- Validate all user inputs
- Use parameterized queries
- Follow the principle of least privilege
- Keep dependencies updated

## Documentation

### Updating Documentation
- Update documentation when adding new features
- Keep examples up to date
- Document any breaking changes

### Available Documentation
- `README.md` - Project overview and quick start
- `CONTRIBUTING.md` - Contribution guidelines
- `SECURITY.md` - Security policy
- `CHANGELOG.md` - Release history

## Support

### Getting Help
- Check the documentation first
- Search existing issues
- Open a new issue for bugs or feature requests

### Community
- Join our community forum/discord (if applicable)
- Follow project updates on GitHub
- Contribute to discussions

## License
This project is licensed under the terms of the MIT license. See the [LICENSE](../../LICENSE) file for details.
