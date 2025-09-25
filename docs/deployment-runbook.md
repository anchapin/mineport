# ModPorter-AI Integration Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying, monitoring, and troubleshooting the ModPorter-AI integration in the mineport system.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Procedures](#deployment-procedures)
3. [Monitoring and Health Checks](#monitoring-and-health-checks)
4. [Rollback Procedures](#rollback-procedures)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Emergency Procedures](#emergency-procedures)

## Pre-Deployment Checklist {#pre-deployment-checklist}

### Prerequisites

- [ ] Node.js version 18.0.0 or higher installed
- [ ] Database connectivity verified
- [ ] All dependencies installed (`npm install`)
- [ ] Environment variables configured
- [ ] Feature flags configuration reviewed
- [ ] Backup of current system state created

### Environment Verification

```bash
# Check Node.js version
node --version

# Verify database connection
npm run db:check

# Run pre-deployment tests
npm run test:pre-deploy

# Validate configuration
npm run config:validate
```

### Required Environment Variables

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mineport
DB_USER=postgres
DB_PASSWORD=your_password

# Monitoring Configuration
SLACK_WEBHOOK_URL=${{ secrets.SLACK_WEBHOOK_URL }}
SMTP_HOST=smtp.example.com

# Feature Flags
DEPLOYMENT_ENV=production
```

## Deployment Procedures

### 1. Standard Deployment

For full production deployment with all features enabled:

```bash
# Set deployment environment
export DEPLOYMENT_ENV=production

# Run deployment script
./scripts/deploy-modporter-ai.sh --env production

# Verify deployment
curl -f http://localhost:3000/health
```

### 2. Canary Deployment

For gradual rollout with monitoring:

```bash
# Start canary deployment
./scripts/canary-deployment.sh

# Monitor canary progress
tail -f /var/log/mineport/deployment.log

# Check canary metrics
curl http://localhost:3000/metrics
```

### 3. Staging Deployment

For testing in staging environment:

```bash
# Deploy to staging
./scripts/deploy-modporter-ai.sh --env staging

# Run integration tests
npm run test:integration

# Validate staging deployment
npm run test:smoke
```

## Monitoring and Health Checks

### Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Comprehensive health check | 200 OK with detailed status |
| `/ready` | Readiness probe | 200 OK when ready |
| `/live` | Liveness probe | 200 OK when alive |
| `/metrics` | System metrics | 200 OK with metrics data |

### Key Metrics to Monitor

#### System Metrics
- CPU usage (< 80%)
- Memory usage (< 85%)
- Disk usage (< 90%)
- Response time (< 5000ms)
- Error rate (< 5%)

#### ModPorter-AI Specific Metrics
- File processing time (< 30s)
- Security scan failures (< 1%)
- Analysis accuracy (> 85%)
- Conversion success rate (> 80%)
- Validation failures (< 10%)

### Monitoring Commands

```bash
# Check overall health
curl -s http://localhost:3000/health | jq '.status'

# Get detailed metrics
curl -s http://localhost:3000/metrics | jq '.health'

# Check feature flag status
cat config/feature-flags.json | jq '.modporter_ai_rollout_percentage'

# Monitor logs
tail -f logs/app.log | grep -i modporter

# Check database migrations
node scripts/run-migrations.js status
```

## Rollback Procedures

### 1. Standard Rollback

For normal rollback situations:

```bash
# Perform standard rollback
./scripts/rollback-deployment.sh --type standard --reason "performance_issues"

# Verify rollback
curl -s http://localhost:3000/health | jq '.rollback_mode'
```

### 2. Emergency Rollback

For critical situations requiring immediate rollback:

```bash
# Emergency rollback (fastest)
./scripts/rollback-deployment.sh --type emergency --reason "critical_error"

# Manual verification required after emergency rollback
curl -f http://localhost:3000/health
```

### 3. Gradual Rollback

For controlled rollback with traffic reduction:

```bash
# Gradual rollback
./scripts/rollback-deployment.sh --type gradual --reason "error_rate_high"

# Monitor rollback progress
watch -n 30 'curl -s http://localhost:3000/metrics | jq ".health"'
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Deployment Fails During Migration

**Symptoms:**
- Migration script exits with error
- Database connection failures

**Solution:**
```bash
# Check database connectivity
pg_isready -h $DB_HOST -p $DB_PORT

# Manually run migration
node scripts/run-migrations.js up

# Check migration status
node scripts/run-migrations.js status
```

#### 2. Health Checks Failing

**Symptoms:**
- `/health` endpoint returns 503
- Service marked as unhealthy

**Solution:**
```bash
# Check specific health components
curl -s http://localhost:3000/health | jq '.checks[]'

# Restart services
sudo systemctl restart mineport

# Check logs for errors
tail -n 100 logs/error.log
```

#### 3. High Error Rates

**Symptoms:**
- Error rate > 5%
- Increased 500 responses

**Solution:**
```bash
# Disable problematic features
jq '.enhanced_file_processing = false' config/feature-flags.json > tmp.json
mv tmp.json config/feature-flags.json

# Check error logs
grep -i error logs/app.log | tail -20

# Monitor error rate
watch -n 10 'curl -s http://localhost:3000/metrics | jq ".health.unhealthyChecks"'
```

#### 4. Performance Degradation

**Symptoms:**
- Response time > 5000ms
- High CPU/memory usage

**Solution:**
```bash
# Reduce rollout percentage
jq '.modporter_ai_rollout_percentage = 25' config/feature-flags.json > tmp.json
mv tmp.json config/feature-flags.json

# Check resource usage
top -p $(pgrep -f mineport)

# Analyze slow queries (if database related)
# Check database logs for slow queries
```

#### 5. Feature Flags Not Taking Effect

**Symptoms:**
- Changes to feature flags not reflected
- Old behavior persisting

**Solution:**
```bash
# Verify feature flags file
cat config/feature-flags.json | jq '.'

# Restart application to reload flags
sudo systemctl restart mineport

# Check feature flag service logs
grep -i "feature.*flag" logs/app.log
```

## Emergency Procedures

### Critical System Failure

1. **Immediate Actions:**
   ```bash
   # Emergency rollback
   ./scripts/rollback-deployment.sh --type emergency

   # Alert team
   echo "CRITICAL: ModPorter-AI deployment failure" | \
     curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"CRITICAL: ModPorter-AI deployment failure"}' \
     $SLACK_WEBHOOK_URL
   ```

2. **Assessment:**
    - Check system logs
    - Verify database integrity
    - Assess impact scope

3. **Recovery:**
    - Restore from backup if necessary
    - Validate system functionality
    - Document incident

### Security Incident

1. **Immediate Actions:**
   ```bash
   # Disable all ModPorter-AI features
   echo '{"enhanced_file_processing":false,"multi_strategy_analysis":false,"specialized_conversion_agents":false,"comprehensive_validation":false,"modporter_ai_rollout_percentage":0,"security_incident":true}' > config/feature-flags.json

   # Restart services
   sudo systemctl restart mineport
   ```

2. **Investigation:**
    - Review security logs
    - Check for malicious uploads
    - Analyze threat patterns

3. **Remediation:**
    - Apply security patches
    - Update security rules
    - Re-enable features gradually

## Deployment Validation

### Post-Deployment Tests

```bash
# Run smoke tests
npm run test:smoke

# Validate core functionality
curl -X POST http://localhost:3000/api/convert \
  -F "file=@test-mod.jar" \
  -H "Content-Type: multipart/form-data"

# Check feature flag effectiveness
# Upload test file and verify ModPorter-AI processing
```

### Success Criteria

- [ ] All health checks passing
- [ ] Error rate < 5%
- [ ] Response time < 5000ms
- [ ] ModPorter-AI features working as expected
- [ ] No security alerts triggered
- [ ] Database migrations completed successfully

## Monitoring Dashboard URLs

- System Overview: `http://localhost:3000/dashboard/system`
- ModPorter-AI Metrics: `http://localhost:3000/dashboard/modporter-ai`
- Error Tracking: `http://localhost:3000/dashboard/errors`
- Performance Metrics: `http://localhost:3000/dashboard/performance`

## Contact Information

### On-Call Rotation

- **Primary:** DevOps Team - `devops@mineport.com`
- **Secondary:** Development Team - `dev@mineport.com`
- **Escalation:** Engineering Manager - `manager@mineport.com`

### Emergency Contacts

- **Slack:** `#incidents`
- **Phone:** +1-555-0123 (24/7 on-call)
- **Email:** `emergency@mineport.com`

## Appendix

### Useful Commands Reference

```bash
# Check service status
sudo systemctl status mineport

# View real-time logs
journalctl -u mineport -f

# Database connection test
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;"

# Feature flag quick check
jq '.modporter_ai_rollout_percentage' config/feature-flags.json

# Disk space check
df -h /

# Memory usage check
free -h

# Process monitoring
ps aux | grep mineport
```

### Log File Locations

- Application logs: `/var/log/mineport/app.log`
- Error logs: `/var/log/mineport/error.log`
- Deployment logs: `/var/log/mineport/deployment.log`
- Security logs: `/var/log/mineport/security.log`

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-08  
**Next Review:** 2025-02-08
