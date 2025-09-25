# CI/CD Pipeline Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting information for the enhanced GitHub Actions CI/CD pipeline. It covers common issues, diagnostic procedures, and resolution steps.

## Table of Contents

1. [Quick Diagnosis](#quick-diagnosis)
2. [Build Issues](#build-issues)
3. [Test Failures](#test-failures)
4. [Security Scan Problems](#security-scan-problems)
5. [Deployment Issues](#deployment-issues)
6. [Performance Problems](#performance-problems)
7. [Cache Issues](#cache-issues)
8. [Notification Problems](#notification-problems)
9. [Emergency Procedures](#emergency-procedures)
10. [Diagnostic Tools](#diagnostic-tools)

## Quick Diagnosis

### Pipeline Status Check

Use this quick checklist to identify the problem area:

```bash
# Check overall pipeline status
gh run list --limit 10

# Check specific workflow status
gh run list --workflow=ci-enhanced.yml --limit 5

# View latest run details
gh run view --log
```

### Common Symptoms and Quick Fixes

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Build fails immediately | Syntax error in workflow | Check YAML syntax |
| Tests timeout | Infinite loop or hanging process | Add timeout limits |
| Security scan blocks PR | High severity vulnerability | Run `npm audit fix` |
| Deployment fails | Health check failure | Check service status |
| Cache misses frequently | Cache key changes | Review cache configuration |

## Build Issues

### 1. Compilation Errors

**Symptoms:**
- TypeScript compilation fails
- Build process exits with error code 1
- Missing type definitions

**Diagnosis:**
```bash
# Check TypeScript configuration
npx tsc --noEmit --listFiles

# Verify dependencies
npm ls --depth=0

# Check for type conflicts
npm ls @types/
```

**Solutions:**

1. **Fix TypeScript Errors:**
   ```bash
   # Run TypeScript compiler locally
   npx tsc --noEmit

   # Fix type errors in reported files
   # Update tsconfig.json if needed
   ```

2. **Resolve Dependency Issues:**
   ```bash
   # Clean install
   rm -rf node_modules package-lock.json
   npm install

   # Update dependencies
   npm update
   ```

3. **Fix Type Definition Issues:**
   ```bash
   # Install missing types
   npm install --save-dev @types/node @types/jest

   # Check for conflicting type definitions
   npm ls @types/ | grep -E "(WARN|ERR)"
   ```

### 2. Environment Issues

**Symptoms:**
- Different behavior between local and CI
- Environment-specific failures
- Missing environment variables

**Diagnosis:**
```bash
# Compare local and CI environments
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "OS: $(uname -a)"

# Check environment variables
env | grep -E "(NODE|NPM|CI)"
```

**Solutions:**

1. **Standardize Node.js Version:**
   ```yaml
   # In workflow file
   - uses: actions/setup-node@v3
     with:
       node-version: '20.x'  # Match local version
   ```

2. **Set Required Environment Variables:**
   ```yaml
   env:
     NODE_ENV: production
     CI: true
     FORCE_COLOR: 1
   ```

3. **Use .nvmrc for Version Consistency:**
   ```bash
   # Create .nvmrc file
   echo "20.18.0" > .nvmrc

   # Update workflow to use .nvmrc
   node-version-file: '.nvmrc'
   ```

### 3. Dependency Resolution Failures

**Symptoms:**
- npm install fails
- Package conflicts
- Peer dependency warnings

**Diagnosis:**
```bash
# Check for dependency conflicts
npm ls --depth=0 2>&1 | grep -E "(WARN|ERR)"

# Audit dependencies
npm audit

# Check for outdated packages
npm outdated
```

**Solutions:**

1. **Resolve Peer Dependencies:**
   ```bash
   # Install missing peer dependencies
   npm install --save-dev <missing-peer-dep>

   # Or use --legacy-peer-deps flag
   npm install --legacy-peer-deps
   ```

2. **Fix Version Conflicts:**
   ```bash
   # Use npm overrides in package.json
   {
     "overrides": {
       "package-name": "^1.0.0"
     }
   }
   ```

3. **Clean Dependency Tree:**
   ```bash
   # Remove and reinstall
   rm -rf node_modules package-lock.json
   npm install

   # Or use npm ci for clean install
   npm ci
   ```

## Test Failures

### 1. Unit Test Failures

**Symptoms:**
- Individual tests fail
- Assertion errors
- Mock/stub issues

**Diagnosis:**
```bash
# Run specific test file
npm test -- --run src/path/to/test.test.ts

# Run with verbose output
npm test -- --run --reporter=verbose

# Check test coverage
npm run test:coverage
```

**Solutions:**

1. **Fix Assertion Errors:**
   ```typescript
   // Update expected values
   expect(result).toBe(expectedValue);

   // Use more specific matchers
   expect(result).toMatchObject({ key: 'value' });
   ```

2. **Fix Mock Issues:**
   ```typescript
   // Reset mocks between tests
   beforeEach(() => {
     jest.clearAllMocks();
   });

   // Use proper mock implementations
   jest.mock('./module', () => ({
     functionName: jest.fn().mockReturnValue('mocked value')
   }));
   ```

3. **Update Test Snapshots:**
   ```bash
   # Update all snapshots
   npm test -- --run --update-snapshots

   # Update specific test snapshots
   npm test -- --run --update-snapshots src/path/to/test.test.ts
   ```

### 2. Integration Test Failures

**Symptoms:**
- Database connection errors
- Service unavailable errors
- Timeout issues

**Diagnosis:**
```bash
# Check service dependencies
docker ps
kubectl get pods

# Test database connectivity
npm run test:db-connection

# Check integration test configuration
cat tests/integration/setup.ts
```

**Solutions:**

1. **Fix Database Issues:**
   ```bash
   # Start test database
   docker-compose up -d test-db

   # Run database migrations
   npm run migrate:test

   # Seed test data
   npm run seed:test
   ```

2. **Fix Service Dependencies:**
   ```yaml
   # Add service containers to workflow
   services:
     postgres:
       image: postgres:13
       env:
         POSTGRES_PASSWORD: test
       options: >-
         --health-cmd pg_isready
         --health-interval 10s
         --health-timeout 5s
         --health-retries 5
   ```

3. **Increase Timeouts:**
   ```typescript
   // In test files
   jest.setTimeout(30000); // 30 seconds

   // Or in vitest config
   export default defineConfig({
     test: {
       testTimeout: 30000
     }
   });
   ```

### 3. Flaky Tests

**Symptoms:**
- Tests pass/fail intermittently
- Race conditions
- Timing-dependent failures

**Diagnosis:**
```bash
# Run tests multiple times
for i in {1..10}; do npm test -- --run; done

# Use test retry functionality
npm test -- --run --retry=3

# Check for async/await issues
grep -r "setTimeout\|setInterval" tests/
```

**Solutions:**

1. **Fix Race Conditions:**
   ```typescript
   // Use proper async/await
   await waitFor(() => {
     expect(element).toBeInTheDocument();
   });

   // Use deterministic delays
   await new Promise(resolve => setTimeout(resolve, 100));
   ```

2. **Stabilize Timing-Dependent Tests:**
   ```typescript
   // Use fake timers
   beforeEach(() => {
     jest.useFakeTimers();
   });

   afterEach(() => {
     jest.useRealTimers();
   });
   ```

3. **Add Test Retries:**
   ```yaml
   # In workflow file
   - name: Run Tests
     run: npm test -- --run --retry=3
   ```

## Security Scan Problems

### 1. Vulnerability Detection

**Symptoms:**
- High/critical vulnerabilities found
- Security scan blocks deployment
- False positive alerts

**Diagnosis:**
```bash
# Run security audit locally
npm audit --audit-level high

# Check specific vulnerabilities
npm audit --json | jq '.vulnerabilities'

# Enhanced npm audit with detailed output
npm audit --json | jq '.vulnerabilities' | head -20
```

**Solutions:**

1. **Fix Actual Vulnerabilities:**
   ```bash
   # Auto-fix vulnerabilities
   npm audit fix

   # Force fix breaking changes
   npm audit fix --force

   # Update specific packages
   npm update package-name
   ```

2. **Handle False Positives:**
   ```bash
   # Use npm audit fix with specific packages
   npm audit fix --package-lock-only

   # Override with specific versions if needed
   npm install package-name@version --save-exact
   ```

3. **Temporary Bypass (Use Carefully):**
   ```yaml
   # In workflow file (temporary only)
   - name: Security Scan
     run: npm audit --audit-level moderate  # Lower threshold temporarily
     continue-on-error: true  # Don't block deployment
   ```

### 2. Secret Detection

**Symptoms:**
- GitLeaks finds secrets in code
- API keys or passwords detected
- Historical commits contain secrets

**Diagnosis:**
```bash
# Scan current code
gitleaks detect --source . --verbose

# Scan git history
gitleaks detect --source . --log-opts="--all"

# Check specific files
gitleaks detect --source . --config .gitleaks.toml
```

**Solutions:**

1. **Remove Secrets from Code:**
   ```bash
   # Remove secrets from current code
   # Replace with environment variables

   # For historical commits, use BFG or git-filter-branch
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch path/to/file' \
     --prune-empty --tag-name-filter cat -- --all
   ```

2. **Use Environment Variables:**
   ```typescript
   // Instead of hardcoded secrets
   const apiKey = process.env.API_KEY;

   // Use GitHub secrets in workflows
   env:
     API_KEY: ${{ secrets.API_KEY }}
   ```

3. **Configure GitLeaks Properly:**
   ```toml
   # .gitleaks.toml
   [[rules]]
   description = "Generic API Key"
   regex = '''(?i)api[_-]?key[_-]?=.{0,5}['"]\[0-9a-zA-Z\]{32,45}['"]'''
   tags = ["key", "API"]
   ```

### 3. Code Quality Issues

**Symptoms:**
- CodeQL finds security issues
- Static analysis failures
- Code quality gates fail

**Diagnosis:**
```bash
# Run ESLint with security rules
npx eslint . --ext .ts,.js --config .eslintrc.security.js

# Check TypeScript strict mode
npx tsc --noEmit --strict

# Run custom security linting
npm run lint:security
```

**Solutions:**

1. **Fix Security Linting Issues:**
   ```bash
   # Auto-fix ESLint issues
   npx eslint . --fix

   # Update security rules
   npm install --save-dev eslint-plugin-security
   ```

2. **Address CodeQL Findings:**
   ```typescript
   // Fix SQL injection
   const query = 'SELECT * FROM users WHERE id = ?';
   db.query(query, [userId]);

   // Fix XSS vulnerabilities
   const sanitized = DOMPurify.sanitize(userInput);
   ```

3. **Improve Code Quality:**
   ```bash
   # Enable TypeScript strict mode
   # Update tsconfig.json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "noImplicitReturns": true
     }
   }
   ```

## Deployment Issues

### 1. Health Check Failures

**Symptoms:**
- Deployment fails health checks
- Service doesn't respond to health endpoint
- Timeout during health verification

**Diagnosis:**
```bash
# Test health endpoint locally
curl -f http://localhost:3000/health

# Check service logs
kubectl logs deployment/modporter-ai --tail=50

# Verify service configuration
kubectl describe service modporter-ai
```

**Solutions:**

1. **Fix Health Endpoint:**
   ```typescript
   // Ensure health endpoint is implemented
   app.get('/health', (req, res) => {
     res.status(200).json({
       status: 'healthy',
       timestamp: new Date().toISOString()
     });
   });
   ```

2. **Adjust Health Check Configuration:**
   ```yaml
   # In deployment workflow
   - name: Health Check
     run: |
       for i in {1..30}; do
         if curl -f http://localhost:3000/health; then
           echo "Health check passed"
           exit 0
         fi
         sleep 10
       done
       echo "Health check failed"
       exit 1
   ```

3. **Debug Service Issues:**
   ```bash
   # Check service status
   systemctl status modporter-ai

   # Check port binding
   netstat -tlnp | grep :3000

   # Check environment variables
   env | grep -E "(NODE|PORT|DATABASE)"
   ```

### 2. Rollback Issues

**Symptoms:**
- Rollback script fails
- Previous version not available
- Database migration conflicts

**Diagnosis:**
```bash
# Check rollback script
bash -n scripts/rollback-deployment.sh

# Verify previous deployment artifacts
ls -la deployments/

# Check database migration status
npm run migrate:status
```

**Solutions:**

1. **Fix Rollback Script:**
   ```bash
   # Test rollback script
   ./scripts/rollback-deployment.sh --dry-run

   # Fix script permissions
   chmod +x scripts/rollback-deployment.sh
   ```

2. **Ensure Artifact Availability:**
   ```bash
   # Check artifact storage
   aws s3 ls s3://deployment-artifacts/

   # Download previous version
   aws s3 cp s3://deployment-artifacts/v1.2.3/ ./previous-version/ --recursive
   ```

3. **Handle Database Migrations:**
   ```bash
   # Create rollback migrations
   npm run migrate:rollback

   # Or use database snapshots
   kubectl exec -it postgres-pod -- pg_restore backup.sql
   ```

### 3. Environment Configuration

**Symptoms:**
- Wrong environment variables
- Configuration file not found
- Service dependencies unavailable

**Diagnosis:**
```bash
# Check environment configuration
env | sort

# Verify configuration files
ls -la config/
cat config/production.json

# Test service dependencies
nc -zv database-host 5432
nc -zv redis-host 6379
```

**Solutions:**

1. **Fix Environment Variables:**
   ```bash
   # Set missing environment variables
   export DATABASE_URL="postgresql://user:pass@host:5432/db"
   export REDIS_URL="redis://host:6379"

   # Or use .env file
   cp .env.example .env
   ```

2. **Update Configuration Files:**
   ```json
   // config/production.json
   {
     "database": {
       "host": "${DATABASE_HOST}",
       "port": "${DATABASE_PORT}",
       "name": "${DATABASE_NAME}"
     }
   }
   ```

3. **Verify Service Dependencies:**
   ```bash
   # Check database connectivity
   psql $DATABASE_URL -c "SELECT 1"

   # Check Redis connectivity
   redis-cli -u $REDIS_URL ping
   ```

## Performance Problems

### 1. Slow Build Times

**Symptoms:**
- Builds take longer than expected
- Timeout errors
- Resource exhaustion

**Diagnosis:**
```bash
# Measure build times
time npm run build

# Check resource usage
top -p $(pgrep node)

# Analyze build output
npm run build -- --verbose
```

**Solutions:**

1. **Optimize Build Process:**
   ```json
   // package.json
   {
     "scripts": {
       "build": "tsc --build --verbose",
       "build:parallel": "tsc --build --verbose --parallel"
     }
   }
   ```

2. **Improve Caching:**
   ```yaml
   # Better cache configuration
   - uses: actions/cache@v3
     with:
       path: |
         ~/.npm
         node_modules
         dist
       key: ${{ runner.os }}-build-${{ hashFiles('**/package-lock.json', 'tsconfig.json') }}
   ```

3. **Use Build Optimization:**
   ```typescript
   // webpack.config.js
   module.exports = {
     optimization: {
       splitChunks: {
         chunks: 'all',
       },
     },
     cache: {
       type: 'filesystem',
     },
   };
   ```

### 2. Test Performance Issues

**Symptoms:**
- Tests run slowly
- Memory leaks during testing
- Test timeouts

**Diagnosis:**
```bash
# Profile test execution
npm test -- --run --reporter=verbose --coverage

# Check memory usage
node --max-old-space-size=4096 node_modules/.bin/vitest run

# Identify slow tests
npm test -- --run --reporter=verbose | grep -E "SLOW|[0-9]+ms"
```

**Solutions:**

1. **Optimize Test Configuration:**
   ```typescript
   // vitest.config.ts
   export default defineConfig({
     test: {
       pool: 'threads',
       poolOptions: {
         threads: {
           maxThreads: 4,
           minThreads: 1,
         },
       },
     },
   });
   ```

2. **Fix Memory Leaks:**
   ```typescript
   // Clean up after tests
   afterEach(() => {
     jest.clearAllMocks();
     cleanup(); // React Testing Library
   });

   // Use proper teardown
   afterAll(async () => {
     await server.close();
     await database.disconnect();
   });
   ```

3. **Parallelize Tests:**
   ```bash
   # Run tests in parallel
   npm test -- --run --threads=4

   # Use test sharding
   npm test -- --run --shard=1/4
   ```

## Cache Issues

### 1. Cache Misses

**Symptoms:**
- Frequent cache misses
- Slow dependency installation
- Builds don't use cached artifacts

**Diagnosis:**
```bash
# Check cache hit rates in workflow logs
gh run view --log | grep -i cache

# Verify cache keys
echo "Cache key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}"

# List available caches
gh cache list
```

**Solutions:**

1. **Fix Cache Keys:**
   ```yaml
   # More specific cache keys
   - uses: actions/cache@v3
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/tsconfig.json') }}
       restore-keys: |
         ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}-
         ${{ runner.os }}-node-
   ```

2. **Optimize Cache Paths:**
   ```yaml
   # Cache multiple directories
   - uses: actions/cache@v3
     with:
       path: |
         ~/.npm
         ~/.cache
         node_modules
         dist
       key: ${{ runner.os }}-deps-${{ hashFiles('**/package-lock.json') }}
   ```

3. **Cache Invalidation Strategy:**
   ```yaml
   # Version cache keys
   - uses: actions/cache@v3
     with:
       path: ~/.npm
       key: v2-${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   ```

### 2. Cache Corruption

**Symptoms:**
- Build failures after cache restore
- Inconsistent behavior
- Corrupted dependencies

**Diagnosis:**
```bash
# Clear local cache
npm cache clean --force

# Verify cache integrity
npm cache verify

# Check for corrupted files
find node_modules -name "*.js" -exec file {} \; | grep -v "ASCII\|UTF-8"
```

**Solutions:**

1. **Clear and Rebuild Cache:**
   ```bash
   # Clear GitHub Actions cache
   gh cache delete --all

   # Clear local caches
   rm -rf node_modules ~/.npm
   npm install
   ```

2. **Use Cache Validation:**
   ```yaml
   - name: Validate Cache
     run: |
       if [ -d "node_modules" ]; then
         npm ls --depth=0 || (rm -rf node_modules && npm install)
       fi
   ```

3. **Implement Cache Health Checks:**
   ```yaml
   - name: Cache Health Check
     run: |
       # Verify critical files exist
       test -f node_modules/.bin/tsc || npm install
       test -f dist/index.js || npm run build
   ```

## Notification Problems

### 1. Slack Notifications

**Symptoms:**
- Notifications not sent
- Wrong channel or format
- Authentication failures

**Diagnosis:**
```bash
# Test webhook URL
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message"}' \
  $SLACK_WEBHOOK_URL

# Check workflow logs for notification steps
gh run view --log | grep -i slack
```

**Solutions:**

1. **Fix Webhook Configuration:**
   ```yaml
   - name: Slack Notification
     if: failure()
     uses: 8398a7/action-slack@v3
     with:
       status: failure
       webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
       channel: '#ci-cd'
       username: 'GitHub Actions'
   ```

2. **Update Webhook URL:**
   ```bash
   # Update secret
   gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/services/..."
   ```

3. **Test Notification Format:**
   ```yaml
   - name: Custom Slack Message
     run: |
       curl -X POST -H 'Content-type: application/json' \
         --data "{\"text\":\"Build failed: ${{ github.sha }}\"}" \
         ${{ secrets.SLACK_WEBHOOK_URL }}
   ```

### 2. Email Notifications

**Symptoms:**
- Emails not delivered
- Wrong recipients
- Formatting issues

**Solutions:**

1. **Configure Email Action:**
   ```yaml
   - name: Send Email
     uses: dawidd6/action-send-mail@v3
     with:
       server_address: smtp.gmail.com
       server_port: 587
       username: ${{ secrets.EMAIL_USERNAME }}
       password: ${{ secrets.EMAIL_PASSWORD }}
       subject: Build Failed - ${{ github.repository }}
       body: |
         Build failed for commit ${{ github.sha }}
         View logs: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
       to: devops@company.com
   ```

## Emergency Procedures

### 1. Pipeline Failure During Critical Deployment

**Immediate Actions:**
1. **Stop Current Deployment:**
   ```bash
   # Cancel running workflows
   gh run cancel $RUN_ID

   # Trigger rollback
   ./scripts/rollback-deployment.sh
   ```

2. **Assess Impact:**
   ```bash
   # Check service status
   curl -f https://api.modporter.ai/health

   # Check error rates
   kubectl logs deployment/modporter-ai --tail=100 | grep ERROR
   ```

3. **Communicate Status:**
   ```bash
   # Send alert to team
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"🚨 CRITICAL: Deployment failure, investigating..."}' \
     $SLACK_WEBHOOK_URL
   ```

### 2. Security Breach Detection

**Immediate Actions:**
1. **Isolate Affected Systems:**
   ```bash
   # Disable affected workflows
   gh workflow disable ci-enhanced.yml

   # Revoke compromised secrets
   gh secret delete COMPROMISED_SECRET
   ```

2. **Investigate Breach:**
   ```bash
   # Check recent commits
   git log --oneline --since="1 day ago"

   # Scan for secrets
   gitleaks detect --source . --verbose
   ```

3. **Implement Fixes:**
   ```bash
   # Rotate all secrets
   gh secret set API_KEY --body "new-secure-key"

   # Update security policies
   git add .github/workflows/security.yml
   git commit -m "Enhanced security policies"
   ```

### 3. Complete Pipeline Breakdown

**Recovery Steps:**
1. **Switch to Manual Process:**
   ```bash
   # Disable all automated workflows
   find .github/workflows -name "*.yml" -exec gh workflow disable {} \;

   # Use manual deployment
   ./scripts/manual-deploy.sh
   ```

2. **Diagnose Root Cause:**
   ```bash
   # Check GitHub status
   curl -s https://www.githubstatus.com/api/v2/status.json

   # Review recent changes
   git log --oneline --since="1 week ago" .github/workflows/
   ```

3. **Gradual Recovery:**
   ```bash
   # Re-enable workflows one by one
   gh workflow enable ci-enhanced.yml
   # Test and validate
   gh workflow enable security.yml
   # Test and validate
   ```

## Diagnostic Tools

### 1. Built-in GitHub Tools

```bash
# View workflow runs
gh run list --limit 20

# View specific run
gh run view $RUN_ID --log

# Download run logs
gh run download $RUN_ID

# List workflow files
gh workflow list

# View workflow details
gh workflow view ci-enhanced.yml
```

### 2. Custom Diagnostic Scripts

```bash
# Pipeline health check
./scripts/pipeline-health-check.sh

# Performance analysis
./scripts/analyze-pipeline-performance.sh

# Security audit
./scripts/security-audit.sh

# Cache analysis
./scripts/analyze-cache-performance.sh
```

### 3. Monitoring and Alerting

```bash
# Check pipeline metrics
curl -s "https://api.github.com/repos/owner/repo/actions/runs" | jq '.workflow_runs[0].conclusion'

# Monitor build times
./scripts/monitor-build-times.sh

# Check failure rates
./scripts/calculate-failure-rates.sh
```

### 4. Log Analysis Tools

```bash
# Parse workflow logs
gh run view --log | grep -E "(ERROR|WARN|FAIL)"

# Analyze performance
gh run view --log | grep -E "took [0-9]+ms"

# Extract timing information
gh run view --log | grep -oE "[0-9]+m[0-9]+s" | sort -n
```

---

*This troubleshooting guide is maintained by the DevOps team. For additional support, contact devops@company.com or create an issue in the repository.*
