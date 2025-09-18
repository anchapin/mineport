# Pre-commit Hooks Setup Guide

This document explains how to set up and use pre-commit hooks for the ModPorter-AI project, with a focus on GitLeaks secret detection.

## Overview

Pre-commit hooks automatically run checks before each commit to ensure code quality and security. Our setup includes:

- **GitLeaks**: Primary secret detection tool
- **Code Quality**: Trailing whitespace, file formatting, YAML/JSON validation
- **Security**: Private key detection, merge conflict detection
- **TypeScript**: ESLint integration

## Installation

### Prerequisites

1. **Python 3.12+** (for pre-commit)
2. **Node.js 18+** (for ESLint)
3. **pre-commit package**

### Setup Steps

1. **Install pre-commit** (if not already installed):
   ```bash
   pip install pre-commit
   ```

2. **Install the hooks**:
   ```bash
   pre-commit install
   ```

3. **Verify installation**:
   ```bash
   pre-commit --version
   ```

## GitLeaks Configuration

### What GitLeaks Detects

Our `.gitleaks.toml` configuration detects:

- **GitHub tokens**: Personal access tokens, OAuth tokens, App tokens
- **Cloud provider keys**: AWS, Azure, GCP credentials
- **API keys**: NPM tokens, generic API keys (Snyk not used)
- **Database URLs**: Connection strings with embedded credentials
- **Private keys**: RSA, EC, DSA, OpenSSH, PGP private keys
- **JWT tokens**: JSON Web Tokens
- **Webhooks**: Slack, Discord webhook URLs
- **Custom patterns**: ModPorter-AI and Minecraft-specific tokens

### False Positive Handling

The configuration includes allowlists for:

- **Test files**: `tests/`, `test/` directories
- **Documentation**: `docs/`, `README.md`, `CHANGELOG.md`
- **Build artifacts**: `dist/`, `coverage/`, `node_modules/`
- **Test patterns**: UUIDs like `00000000-0000-0000-0000-000000000001`
- **Placeholder text**: `example`, `test`, `dummy`, `fake`, `mock`

## Usage

### Automatic Execution

Pre-commit hooks run automatically when you commit:

```bash
git add .
git commit -m "Your commit message"
# Hooks run automatically here
```

### Manual Execution

Run hooks manually on all files:

```bash
pre-commit run --all-files
```

Run specific hooks:

```bash
# Run only GitLeaks
pre-commit run gitleaks --all-files

# Run only code quality checks
pre-commit run trailing-whitespace end-of-file-fixer --all-files
```

### Skip Hooks (Emergency Only)

To skip hooks in emergencies:

```bash
git commit -m "Emergency fix" --no-verify
```

**⚠️ Warning**: Only use `--no-verify` in genuine emergencies. Always run hooks afterward.

## Hook Details

### GitLeaks (Primary Security Hook)

- **Purpose**: Detect hardcoded secrets and credentials
- **Configuration**: `.gitleaks.toml`
- **Execution**: Scans all staged files for secret patterns
- **Failure**: Blocks commit if secrets are detected

### Code Quality Hooks

- **trailing-whitespace**: Removes trailing spaces
- **end-of-file-fixer**: Ensures files end with newline
- **check-yaml**: Validates YAML syntax
- **check-json**: Validates JSON syntax
- **check-toml**: Validates TOML syntax
- **check-merge-conflict**: Detects merge conflict markers
- **check-added-large-files**: Prevents large files (>1MB)
- **detect-private-key**: Detects private key patterns
- **check-case-conflict**: Prevents case-sensitive filename conflicts

### ESLint Integration

- **Purpose**: TypeScript/JavaScript linting
- **Command**: `npm run lint`
- **Files**: `*.ts`, `*.js`
- **Failure**: Blocks commit if linting errors exist

## Troubleshooting

### Common Issues

1. **Python version conflicts**:
   ```bash
   # Check Python version
   python --version
   
   # Set local Python version (if using pyenv)
   echo "3.12.2" > .python-version
   ```

2. **Pre-commit not found**:
   ```bash
   # Reinstall pre-commit
   pip install --upgrade pre-commit
   pre-commit install
   ```

3. **GitLeaks false positives**:
   - Add patterns to `.gitleaks.toml` allowlist
   - Use test-specific UUIDs: `00000000-0000-0000-0000-000000000001`
   - Place test files in `tests/` directory

4. **ESLint failures**:
   ```bash
   # Fix auto-fixable issues
   npm run lint:fix
   
   # Check specific files
   npx eslint src/path/to/file.ts
   ```

### Updating Hooks

Update to latest hook versions:

```bash
pre-commit autoupdate
```

### Debugging Hook Execution

Run with verbose output:

```bash
pre-commit run --all-files --verbose
```

## Security Best Practices

### What to Do If Secrets Are Detected

1. **Don't ignore the warning**
2. **Remove the secret** from the code
3. **Use environment variables** instead:
   ```typescript
   const apiKey = process.env.API_KEY;
   ```
4. **Rotate the secret** if it was real
5. **Update documentation** if needed

### Environment Variable Usage

```typescript
// ✅ Good - Use environment variables
const config = {
  apiKey: process.env.MODPORTER_API_KEY,
  dbUrl: process.env.DATABASE_URL,
  secretKey: process.env.JWT_SECRET
};

// ❌ Bad - Hardcoded secrets
const config = {
  apiKey: "sk-1234567890abcdef",
  dbUrl: "postgres://user:pass@host/db",
  secretKey: "my-secret-key"
};
```

### Test Data Guidelines

```typescript
// ✅ Good - Use placeholder patterns
const testData = {
  userId: "00000000-0000-0000-0000-000000000001",
  apiKey: "test-api-key-placeholder",
  token: "mock-jwt-token"
};

// ❌ Bad - Realistic-looking secrets
const testData = {
  userId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  apiKey: "sk_live_1234567890abcdef",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
};
```

## Configuration Files

### `.pre-commit-config.yaml`

Main configuration file defining all hooks and their settings.

### `.gitleaks.toml`

GitLeaks-specific configuration with:
- Secret detection rules
- Allowlist patterns
- File path exclusions
- Custom rules for ModPorter-AI

### `.python-version`

Specifies Python version for consistent pre-commit execution.

## Integration with CI/CD

Pre-commit hooks complement CI/CD security scanning:

1. **Local development**: Pre-commit hooks catch issues early
2. **CI pipeline**: GitHub Actions run additional security scans
3. **Code review**: Automated checks in pull requests
4. **Deployment**: Final security validation before release

## Support

For issues with pre-commit hooks:

1. Check this documentation
2. Review hook output for specific error messages
3. Test hooks individually to isolate issues
4. Update hook versions if needed
5. Consult the [pre-commit documentation](https://pre-commit.com/)

## Summary

The pre-commit setup provides:

- ✅ **Automatic secret detection** with GitLeaks
- ✅ **Code quality enforcement** with multiple checks
- ✅ **TypeScript linting** integration
- ✅ **False positive handling** for test files
- ✅ **Easy configuration** and maintenance

This ensures that secrets never make it into the repository while maintaining development velocity.