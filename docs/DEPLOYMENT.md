# ModPorter-AI Integration Deployment Guide

## Overview

This document provides comprehensive guidance for deploying the ModPorter-AI integration to the mineport system. The deployment infrastructure supports multiple environments, gradual rollouts, automated rollbacks, and comprehensive monitoring.

## Quick Start

### Prerequisites

1. **System Requirements:**
    - Node.js 18.0.0 or higher
    - PostgreSQL database
    - npm 8.0.0 or higher

2. **Environment Setup:**
   ```bash
   # Install dependencies
   npm install

   # Set up environment variables
   cp .env.example .env
   # Edit .env with your configuration

   # Validate prerequisites
   npm run validate:deployment
   ```

### Basic Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production

# Deploy with canary rollout
npm run deploy:canary
```

## Deployment Strategies

### 1. Standard Deployment

Full deployment with all features enabled:

```bash
# Production deployment
./scripts/deploy-modporter-ai.sh --env production

# Staging deployment
./scripts/deploy-modporter-ai.sh --env staging
```

**Features:**
- Complete feature rollout
- Database migrations
- Health checks
- Automatic rollback on failure

### 2. Canary Deployment

Gradual rollout with monitoring:

```bash
# Start canary deployment
./scripts/canary-deployment.sh

# Custom canary parameters
./scripts/canary-deployment.sh \
  --percentage 10 \
  --duration 600 \
  --error-threshold 0.02
```

**Phases:**
1. 5% traffic for 5 minutes
2. 10% traffic for 5 minutes  
3. 25% traffic for 10 minutes
4. 50% traffic for 10 minutes
5. 100% traffic for 5 minutes

### 3. Blue-Green Deployment

Zero-downtime deployment (manual process):

```bash
# Deploy to green environment
DEPLOYMENT_ENV=green ./scripts/deploy-modporter-ai.sh

# Switch traffic to green
# (Load balancer configuration required)

# Verify green environment
curl -f http://green.mineport.com/health
```

## Configuration Management

### Feature Flags

Located in `config/feature-flags.json`:

```json
{
  "enhanced_file_processing": true,
  "multi_strategy_analysis": true,
  "specialized_conversion_agents": true,
  "comprehensive_validation": true,
  "modporter_ai_rollout_percentage": 100
}
```

**Component-Level Flags:**
```json
{
  "component_flags": {
    "file_processor": {
      "security_scanning": true,
      "malware_detection": true
    },
    "java_analyzer": {
      "multi_strategy_extraction": true,
      "bytecode_analysis": false
    }
  }
}
```

### Environment Configuration

Located in `config/deployment.json`:

- **Canary:** 5% rollout, basic features
- **Staging:** 25% rollout, most features
- **Production:** 100% rollout, all features

## Database Management

### Migrations

```bash
# Run migrations
npm run db:migrate

# Check migration status
npm run db:status

# Rollback last migration
npm run db:rollback

# Validate migrations
npm run db:validate
```

### Migration Files

- `src/database/migrations/001_modporter_ai_integration.sql`
- `src/database/migrations/001_modporter_ai_integration.rollback.sql`

## Monitoring and Health Checks

### Health Endpoints

| Endpoint | Purpose | Timeout |
|----------|---------|---------|
| `/health` | Comprehensive health check | 30s |
| `/ready` | Kubernetes readiness probe | 5s |
| `/live` | Kubernetes liveness probe | 3s |
| `/metrics` | Prometheus metrics | 10s |

### Key Metrics

```bash
# Check system health
npm run health:check

# Get detailed metrics
curl http://localhost:3000/metrics

# Monitor specific components
curl http://localhost:3000/health | jq '.checks[]'
```

### Monitoring Configuration

Located in `config/monitoring.json`:

- **System Metrics:** CPU, memory, disk usage
- **Application Metrics:** Response time, error rate, throughput
- **ModPorter-AI Metrics:** Processing time, accuracy, security scans

## Rollback Procedures

### Automatic Rollback

Triggered by:
- Health check failures
- Error rate > 5%
- Response time > 5000ms

### Manual Rollback

```bash
# Standard rollback
npm run rollback

# Emergency rollback (fastest)
npm run rollback:emergency

# Gradual rollback
npm run rollback:gradual
```

### Rollback Types

1. **Standard:** Disable features, rollback DB, restart services
2. **Emergency:** Immediate feature disable, force restart
3. **Gradual:** Reduce traffic percentage gradually

## Testing and Validation

### Pre-Deployment Tests

```bash
# Run all pre-deployment tests
npm run test:pre-deploy

# Individual test suites
npm run test:unit
npm run test:integration
npm run test:security
```

### Post-Deployment Validation

```bash
# Smoke tests
npm run test:smoke

# Comprehensive validation
npm run validate:deployment

# Performance validation
npm run test:performance
```

### Test Categories

- **Unit Tests:** Component functionality
- **Integration Tests:** Service interactions
- **Security Tests:** Vulnerability scanning
- **Performance Tests:** Load and stress testing
- **Smoke Tests:** Basic functionality verification

## Troubleshooting

### Common Issues

#### 1. Migration Failures

```bash
# Check database connectivity
npm run db:check

# Manually run migration
node scripts/run-migrations.js up

# Check for conflicts
node scripts/run-migrations.js validate
```

#### 2. Health Check Failures

```bash
# Check specific components
curl http://localhost:3000/health | jq '.checks[]'

# Restart services
sudo systemctl restart mineport

# Check logs
tail -f logs/app.log
```

#### 3. Feature Flag Issues

```bash
# Validate feature flags
cat config/feature-flags.json | jq '.'

# Reset to safe defaults
cp config/feature-flags.json.backup config/feature-flags.json

# Restart to reload flags
sudo systemctl restart mineport
```

### Log Locations

- Application: `logs/app.log`
- Errors: `logs/error.log`
- Deployment: `logs/deployment.log`
- Security: `logs/security.log`

### Debug Commands

```bash
# Service status
sudo systemctl status mineport

# Real-time logs
journalctl -u mineport -f

# Process information
ps aux | grep mineport

# Network connectivity
netstat -tlnp | grep 3000
```

## Security Considerations

### Deployment Security

- All scripts validate inputs
- Database credentials encrypted
- Feature flags validated
- Security scanning enabled

### Runtime Security

- File upload validation
- Malware detection
- Path traversal protection
- ZIP bomb prevention

### Monitoring Security

- Security event logging
- Threat detection alerts
- Audit trail maintenance
- Incident response procedures

## Performance Optimization

### Deployment Performance

- Parallel test execution
- Incremental builds
- Cached dependencies
- Optimized Docker layers

### Runtime Performance

- Connection pooling
- Query optimization
- Memory management
- Resource allocation

## Environment-Specific Notes

### Development

```bash
# Local development setup
npm run dev

# Watch mode testing
npm run test:watch

# Debug mode
DEBUG=* npm run dev
```

### Staging

```bash
# Staging deployment
npm run deploy:staging

# Staging-specific tests
TEST_ENV=staging npm run test:integration
```

### Production

```bash
# Production deployment
npm run deploy:production

# Production monitoring
npm run health:check
curl http://localhost:3000/metrics
```

## Automation and CI/CD

### GitHub Actions Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy ModPorter-AI
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy
        run: npm run deploy:production
```

### Webhook Integration

```bash
# Slack notifications
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."

# Email alerts
export SMTP_HOST="smtp.example.com"
```

## Best Practices

### Deployment

1. Always run pre-deployment tests
2. Use canary deployments for major changes
3. Monitor metrics during rollout
4. Have rollback plan ready
5. Document all changes

### Monitoring

1. Set up comprehensive alerting
2. Monitor business metrics
3. Track deployment success rates
4. Maintain audit logs
5. Regular health check reviews

### Security

1. Validate all inputs
2. Encrypt sensitive data
3. Regular security scans
4. Incident response procedures
5. Access control reviews

## Support and Escalation

### Contact Information

- **DevOps Team:** devops@mineport.com
- **Development Team:** dev@mineport.com
- **Emergency:** emergency@mineport.com
- **Slack:** #incidents

### Escalation Procedures

1. **Level 1:** Automated alerts, on-call engineer
2. **Level 2:** Team lead notification
3. **Level 3:** Management escalation
4. **Level 4:** Executive notification

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-08  
**Maintained By:** DevOps Team
